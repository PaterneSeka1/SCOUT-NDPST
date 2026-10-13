// Limiteur de tentatives en mémoire (fenêtre fixe), pour protéger les endpoints
// sensibles (connexion, demande de réinitialisation de mot de passe) contre le
// brute-force et les abus. Suffisant pour une instance unique du serveur ; une
// solution partagée (Redis) serait nécessaire en cas de déploiement multi-instance.

type Entree = { compte: number; resetAt: number }

const compteurs = new Map<string, Entree>()

export function limiterTaux(
  cle: string,
  maxTentatives: number,
  fenetreMs: number,
): { autorise: boolean; resteTentatives: number } {
  const maintenant = Date.now()
  const entree = compteurs.get(cle)

  if (!entree || entree.resetAt < maintenant) {
    compteurs.set(cle, { compte: 1, resetAt: maintenant + fenetreMs })
    return { autorise: true, resteTentatives: maxTentatives - 1 }
  }

  if (entree.compte >= maxTentatives) {
    return { autorise: false, resteTentatives: 0 }
  }

  entree.compte += 1
  return { autorise: true, resteTentatives: maxTentatives - entree.compte }
}

// Purge périodique pour éviter une fuite mémoire sur un serveur longue durée.
if (!globalThis.__scoutRateLimitCleanupStarted) {
  globalThis.__scoutRateLimitCleanupStarted = true
  setInterval(() => {
    const maintenant = Date.now()
    for (const [cle, entree] of compteurs) {
      if (entree.resetAt < maintenant) compteurs.delete(cle)
    }
  }, 10 * 60 * 1000).unref()
}

declare global {
  var __scoutRateLimitCleanupStarted: boolean | undefined
}
