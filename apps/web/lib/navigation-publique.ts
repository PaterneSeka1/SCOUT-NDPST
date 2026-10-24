// Architecture de la navigation publique.
// Quatre rubriques éditoriales (dont deux regroupements) et une action
// principale « Nous rejoindre ». Le contact est intégré à « Nous rejoindre »
// (et au pied de page) ; l'espace membres reste un accès secondaire.

export interface LienPublic {
  libelle: string
  href: string
  description?: string
}

export interface RubriquePublique {
  libelle: string
  /** Lien direct (rubrique simple) ou liste de sous-liens (regroupement). */
  href?: string
  liens?: LienPublic[]
}

export const RUBRIQUES_PUBLIQUES: RubriquePublique[] = [
  {
    libelle: 'Le groupe',
    liens: [
      { libelle: 'Notre histoire', href: '/notre-histoire', description: 'Les grandes étapes depuis la fondation' },
      { libelle: 'La maîtrise', href: '/notre-equipe', description: 'Chefs, cheftaines et responsables' },
    ],
  },
  { libelle: 'Nos branches', href: '/nos-branches' },
  {
    libelle: 'Activités',
    liens: [
      { libelle: 'Agenda', href: '/activites', description: 'Rendez-vous à venir et passés' },
      { libelle: 'Actualités', href: '/actualites', description: 'Nouvelles et récits du groupe' },
    ],
  },
  { libelle: 'Galerie', href: '/galerie' },
]

export const LIEN_REJOINDRE: LienPublic = { libelle: 'Nous rejoindre', href: '/nous-rejoindre' }

/** Liste à plat (pied de page, plan du site). */
export const LIENS_PUBLICS: LienPublic[] = RUBRIQUES_PUBLIQUES.flatMap((r) => r.liens ?? [{ libelle: r.libelle, href: r.href! }])

/** Le chemin courant appartient-il à ce lien ? */
export function lienActif(chemin: string, href: string): boolean {
  return chemin === href || chemin.startsWith(`${href}/`)
}

/** La rubrique (simple ou regroupée) contient-elle la page courante ? */
export function rubriqueActive(chemin: string, rubrique: RubriquePublique): boolean {
  return rubrique.href ? lienActif(chemin, rubrique.href) : !!rubrique.liens?.some((l) => lienActif(chemin, l.href))
}
