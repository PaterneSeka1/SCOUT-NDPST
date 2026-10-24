// URL de l'API joignable depuis le serveur Next.js (réseau interne, jamais
// exposée au navigateur, qui passe par le proxy /api de ce frontend).
// Partagée par next.config.ts (import relatif), proxy.ts et lib/api-serveur.ts :
// aucune dépendance Node ni « server-only », pour rester importable partout.
//
// En production, l'absence de API_URL_INTERNE est une erreur de configuration :
// un repli silencieux vers 127.0.0.1 masquerait le problème (pages vides,
// sessions perdues). Le repli local n'est conservé qu'en développement.
const URL_API_DEVELOPPEMENT = 'http://127.0.0.1:4000'

// Délai maximal d'un appel serveur à l'API interne : au-delà, l'appel est
// abandonné et traité comme une API indisponible (erreur réseau).
export const DELAI_API_INTERNE_MS = 5000

export function urlApiInterne(): string {
  const configuree = process.env.API_URL_INTERNE?.trim()
  if (configuree) return configuree.replace(/\/$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      "API_URL_INTERNE manquante : cette variable est obligatoire en production (URL interne de l'API, par exemple http://127.0.0.1:4000).",
    )
  }
  return URL_API_DEVELOPPEMENT
}
