import 'server-only'
import { cache } from 'react'
import { THEME_DEFAUT, type Theme } from '@scout/shared'
import { DELAI_API_INTERNE_MS, urlApiInterne } from './api-interne'
import { logger } from './logger'

export interface IdentitePlateforme {
  nomSite: string
  sousTitreSite: string
  logoUrl: string | null
  theme: Theme
  accueil: {
    badge: string | null
    titre: string | null
    sousTitre: string | null
    imageUrl: string | null
    imageAlt: string | null
    stats: { value: string; label: string }[] | null
  }
}

const IDENTITE_DEFAUT: IdentitePlateforme = {
  nomSite: 'SCOUT ASCCI',
  sousTitreSite: "Côte d'Ivoire",
  logoUrl: null,
  theme: THEME_DEFAUT,
  accueil: { badge: null, titre: null, sousTitre: null, imageUrl: null, imageAlt: null, stats: null },
}

// Identité de la PLATEFORME (thème, nom, contenu de l'accueil), servie par
// l'API. Un visiteur non connecté n'a aucun moyen d'indiquer sa paroisse :
// les pages publiques affichent toujours cette identité commune. Une API
// indisponible (ou trop lente : délai dépassé) ne doit pas empêcher
// l'affichage : identité par défaut.
export const getIdentitePlateforme = cache(async (): Promise<IdentitePlateforme> => {
  try {
    const reponse = await fetch(`${urlApiInterne()}/api/public/identite`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_API_INTERNE_MS),
    })
    if (!reponse.ok) throw new Error(`Statut ${reponse.status}`)
    return (await reponse.json()) as IdentitePlateforme
  } catch (erreur) {
    logger.error('identite_plateforme.indisponible', erreur)
    return IDENTITE_DEFAUT
  }
})
