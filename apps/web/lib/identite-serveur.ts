import 'server-only'
import { cache } from 'react'
import { THEME_DEFAUT } from '@scout/shared'
import { DELAI_API_INTERNE_MS, urlApiInterne } from './api-interne'
import type { Identite } from './identite'
import { logger } from './logger'

const IDENTITE_DEFAUT: Identite = {
  nomParoisse: '',
  nomGroupe: '',
  ville: null,
  diocese: null,
  presentation: null,
  messageBienvenue: null,
  anneeHistorique: null,
  rangHistorique: null,
  sourceHistorique: null,
  adresse: null,
  telephone: null,
  email: null,
  horaires: null,
  logoUrl: null,
  theme: THEME_DEFAUT,
  accueil: { titre: null, sousTitre: null, imageUrl: null, imageAlt: null },
  reseauxSociaux: {},
  inscriptionsOuvertes: false,
}

// Identité de l'installation (nom, thème, contacts), servie par l'API. Une
// API indisponible (ou trop lente) ne doit pas empêcher l'affichage : repli
// sur une identité neutre, sans aucune information inventée.
export const getIdentite = cache(async (): Promise<Identite> => {
  try {
    const reponse = await fetch(`${urlApiInterne()}/api/public/identite`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_API_INTERNE_MS),
    })
    if (!reponse.ok) throw new Error(`Statut ${reponse.status}`)
    return { ...IDENTITE_DEFAUT, ...((await reponse.json()) as Identite) }
  } catch (erreur) {
    logger.error('identite.indisponible', erreur)
    return IDENTITE_DEFAUT
  }
})
