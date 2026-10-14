import Redis from 'ioredis'
import { logger } from './logger'

// Limiteur de tentatives (fenêtre fixe), pour protéger les endpoints sensibles
// (connexion, demande de réinitialisation de mot de passe, flux iCal) contre
// le brute-force et les abus.
//
// Deux magasins de compteurs :
//   - mémoire (par défaut) : suffisant pour une instance unique de l'API ;
//   - Redis, si REDIS_URL est défini : compteurs partagés entre plusieurs
//     instances (pm2 en cluster). Clés préfixées par l'installation, toujours
//     avec une durée de vie.
// Si Redis est injoignable, le limiteur bascule sur la mémoire plutôt que de
// laisser passer (limite affaiblie) ou de tout bloquer (connexion impossible).

interface Magasin {
  // Incrémente le compteur et renvoie sa nouvelle valeur ; la fenêtre démarre
  // au premier incrément.
  incrementer(cle: string, fenetreMs: number): Promise<number>
  lire(cle: string): Promise<number>
}

type Entree = { compte: number; resetAt: number }

const compteurs = new Map<string, Entree>()

const magasinMemoire: Magasin = {
  async incrementer(cle, fenetreMs) {
    const maintenant = Date.now()
    const entree = compteurs.get(cle)
    if (!entree || entree.resetAt < maintenant) {
      compteurs.set(cle, { compte: 1, resetAt: maintenant + fenetreMs })
      return 1
    }
    entree.compte += 1
    return entree.compte
  },
  async lire(cle) {
    const entree = compteurs.get(cle)
    return entree && entree.resetAt >= Date.now() ? entree.compte : 0
  },
}

// INCR + expiration posée au premier incrément, en une seule opération atomique.
const SCRIPT_INCREMENT = `
local compte = redis.call('INCR', KEYS[1])
if compte == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return compte`

let clientRedis: Redis | null = null
let urlRedis: string | undefined

function magasinRedis(url: string): Magasin {
  if (!clientRedis || urlRedis !== url) {
    clientRedis?.disconnect()
    // Échec rapide plutôt qu'une file d'attente de commandes : le repli
    // mémoire prend le relais pendant l'indisponibilité.
    clientRedis = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false })
    clientRedis.on('error', (erreur) => logger.warn('rate_limit.redis_erreur', { message: erreur.message }))
    urlRedis = url
  }
  const client = clientRedis
  const prefixe = `scout:${process.env.INSTALLATION_ID ?? 'local'}:limite:`
  return {
    async incrementer(cle, fenetreMs) {
      return Number(await client.eval(SCRIPT_INCREMENT, 1, prefixe + cle, String(fenetreMs)))
    },
    async lire(cle) {
      return Number((await client.get(prefixe + cle)) ?? 0)
    },
  }
}

async function avecRepli<T>(operation: (magasin: Magasin) => Promise<T>): Promise<T> {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return operation(magasinMemoire)
  try {
    return await operation(magasinRedis(url))
  } catch (erreur) {
    logger.warn('rate_limit.repli_memoire', { message: erreur instanceof Error ? erreur.message : String(erreur) })
    return operation(magasinMemoire)
  }
}

// Compte une tentative et indique si elle reste dans la limite.
export async function limiterTaux(
  cle: string,
  maxTentatives: number,
  fenetreMs: number,
): Promise<{ autorise: boolean; resteTentatives: number }> {
  const compte = await avecRepli((magasin) => magasin.incrementer(cle, fenetreMs))
  return { autorise: compte <= maxTentatives, resteTentatives: Math.max(0, maxTentatives - compte) }
}

// Indique si la limite est déjà atteinte, sans compter de tentative : pour ne
// compter que les échecs (connexion), une tentative réussie ne consomme rien.
export async function limiteAtteinte(cle: string, maxTentatives: number): Promise<boolean> {
  return (await avecRepli((magasin) => magasin.lire(cle))) >= maxTentatives
}

// Fermeture propre (arrêt de l'API, tests).
export async function fermerLimiteur(): Promise<void> {
  await clientRedis?.quit().catch(() => undefined)
  clientRedis = null
  urlRedis = undefined
}

// Purge périodique pour éviter une fuite mémoire sur un serveur longue durée.
if (!globalThis.__scoutRateLimitCleanupStarted) {
  globalThis.__scoutRateLimitCleanupStarted = true
  setInterval(
    () => {
      const maintenant = Date.now()
      for (const [cle, entree] of compteurs) {
        if (entree.resetAt < maintenant) compteurs.delete(cle)
      }
    },
    10 * 60 * 1000,
  ).unref()
}

declare global {
  var __scoutRateLimitCleanupStarted: boolean | undefined
}
