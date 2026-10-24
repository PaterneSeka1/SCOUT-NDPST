// Parcours de la page « Nous rejoindre ». Chaque parcours correspond à un
// type de demande de l'API (POST /api/public/demandes) ; « contact » et
// « information » partagent le type INFORMATION mais pas la même intention.

export type ObjetParcours = 'inscription' | 'chef' | 'information' | 'contact'
export type TypeDemande = 'INSCRIPTION_JEUNE' | 'ENGAGEMENT_ADULTE' | 'INFORMATION'

export interface Parcours {
  objet: ObjetParcours
  type: TypeDemande
  titre: string
  titreCourt: string
  texte: string
  /** Ouvert uniquement pendant la période d'inscription. */
  soumisAuxInscriptions: boolean
}

export const PARCOURS_REJOINDRE: Parcours[] = [
  {
    objet: 'inscription',
    type: 'INSCRIPTION_JEUNE',
    titre: 'Inscrire un jeune',
    titreCourt: 'Inscrire un jeune',
    texte: 'Pour un enfant ou un adolescent de 6 à 20 ans. La branche est confirmée par la direction selon l’âge.',
    soumisAuxInscriptions: true,
  },
  {
    objet: 'chef',
    type: 'ENGAGEMENT_ADULTE',
    titre: 'Devenir chef ou cheftaine',
    titreCourt: 'Devenir chef',
    texte: 'Vous souhaitez encadrer, former ou soutenir le groupe comme adulte bénévole.',
    soumisAuxInscriptions: true,
  },
  {
    objet: 'information',
    type: 'INFORMATION',
    titre: 'Demander une information',
    titreCourt: 'Demander une information',
    texte: 'Une question sur les branches, les réunions, les camps ou les cotisations.',
    soumisAuxInscriptions: false,
  },
  {
    objet: 'contact',
    type: 'INFORMATION',
    titre: 'Contacter le groupe',
    titreCourt: 'Contacter le groupe',
    texte: 'Un message pour la direction du groupe : partenariat, invitation, presse, ancien scout…',
    soumisAuxInscriptions: false,
  },
]

/** Parcours valide à partir du paramètre `?objet=` (repli : information). */
export function parcoursDepuis(objet: string, inscriptionsOuvertes: boolean): Parcours {
  const trouve = PARCOURS_REJOINDRE.find((p) => p.objet === objet)
  if (!trouve) return PARCOURS_REJOINDRE[inscriptionsOuvertes ? 0 : 2]
  if (trouve.soumisAuxInscriptions && !inscriptionsOuvertes) return PARCOURS_REJOINDRE[2]
  return trouve
}
