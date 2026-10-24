import type { Theme } from '@scout/shared'

// Logo de repli tant qu'aucun logo n'est configuré (Administration >
// Identité et configuration). Il s'agit de l'emblème du groupe scout fourni
// comme référence graphique, pas nécessairement du logo officiel de la
// paroisse. Les icônes PNG de public/icons/ et app/favicon.ico en dérivent.
export const LOGO_PAR_DEFAUT = '/wiradjuri.webp'

// Identité publique de l'installation, servie par GET /api/public/identite.
export interface Identite {
  nomParoisse: string
  nomGroupe: string
  ville: string | null
  diocese: string | null
  presentation: string | null
  messageBienvenue: string | null
  anneeHistorique: number | null
  // Présent uniquement quand il est confirmé par une source (sinon null).
  rangHistorique: string | null
  sourceHistorique: string | null
  adresse: string | null
  telephone: string | null
  email: string | null
  horaires: string | null
  logoUrl: string | null
  theme: Theme
  accueil: { titre: string | null; sousTitre: string | null; imageUrl: string | null; imageAlt: string | null }
  reseauxSociaux: Record<string, string>
  inscriptionsOuvertes: boolean
}

/** Nom principal affiché : le groupe scout, à défaut la paroisse. */
export function nomAffiche(identite: Pick<Identite, 'nomGroupe' | 'nomParoisse'>): string {
  return identite.nomGroupe || identite.nomParoisse || 'Groupe scout'
}

/** Sous-titre : la paroisse (si le groupe a un nom propre) et la ville. */
export function sousTitreAffiche(identite: Pick<Identite, 'nomGroupe' | 'nomParoisse' | 'ville'>): string {
  const morceaux = [identite.nomGroupe ? identite.nomParoisse : null, identite.ville].filter(Boolean)
  return morceaux.join(' · ')
}
