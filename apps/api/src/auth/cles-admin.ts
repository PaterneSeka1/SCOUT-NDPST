import { readFileSync } from 'fs'
import { createPrivateKey, createPublicKey, type KeyObject } from 'crypto'
import { env } from '../config/env'

// Clés de l'administrateur plateforme partagé entre installations (voir
// config/env.ts). Chargées une seule fois ; une clé illisible ou d'un autre
// type qu'ECDSA P-256 empêche le démarrage (appel dans main.ts).

export const ALGORITHME_ADMIN = 'ES256'

interface ClesAdmin {
  // Présente uniquement sur l'installation qui héberge le compte admin.
  clePrivee: KeyObject | null
  // Émetteur → clé publique acceptée pour les jetons ADMIN_PLATEFORME
  // (y compris celle de cette installation, si elle signe).
  clesPubliques: Map<string, KeyObject>
}

let cles: ClesAdmin | null = null

function verifierCourbe(cle: KeyObject, fichier: string) {
  if (cle.asymmetricKeyType !== 'ec' || cle.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error(`${fichier} : clé ECDSA P-256 attendue (voir docs/deploiement-ovh.md).`)
  }
}

export function chargerClesAdmin(): ClesAdmin {
  const config = env()
  const clesPubliques = new Map<string, KeyObject>()
  let clePrivee: KeyObject | null = null

  if (config.ADMIN_CLE_PRIVEE_FICHIER?.trim()) {
    const fichier = config.ADMIN_CLE_PRIVEE_FICHIER.trim()
    clePrivee = createPrivateKey(readFileSync(fichier))
    verifierCourbe(clePrivee, fichier)
    clesPubliques.set(config.INSTALLATION_ID, createPublicKey(clePrivee))
  }

  if (config.ADMIN_EMETTEUR_CONFIANCE?.trim() && config.ADMIN_CLE_PUBLIQUE_FICHIER?.trim()) {
    const fichier = config.ADMIN_CLE_PUBLIQUE_FICHIER.trim()
    const clePublique = createPublicKey(readFileSync(fichier))
    verifierCourbe(clePublique, fichier)
    clesPubliques.set(config.ADMIN_EMETTEUR_CONFIANCE.trim(), clePublique)
  }

  cles = { clePrivee, clesPubliques }
  return cles
}

export function clesAdmin(): ClesAdmin {
  return cles ?? chargerClesAdmin()
}

// Réservé aux tests : force un rechargement après modification de l'environnement.
export function reinitialiserClesAdmin() {
  cles = null
}
