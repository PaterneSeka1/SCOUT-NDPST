import { anneeScolaireCourante, LABELS_BRANCHES, ORDRE_CATEGORIES_SCOUTS } from '@scout/shared'
import type { Ton } from '@/components/ui'

// Éléments partagés par les onglets de la page Cotisations.

export const TONS_STATUT_COTISATION: Record<string, Ton> = {
  EN_ATTENTE: 'attention',
  PARTIELLEMENT_PAYEE: 'info',
  PAYEE: 'succes',
  EXONEREE: 'neutre',
}

/** Année scolaire précédente, courante et suivante (format AAAA-AAAA). */
export function optionsAnnees(): { valeur: string; libelle: string }[] {
  const [debut] = anneeScolaireCourante().split('-').map(Number)
  return [debut - 1, debut, debut + 1].map((a) => ({ valeur: `${a}-${a + 1}`, libelle: `${a}-${a + 1}` }))
}

export const OPTIONS_BRANCHES = ORDRE_CATEGORIES_SCOUTS.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] ?? b }))

export function messageErreur(erreur: unknown, defaut = 'Une erreur est survenue.'): string {
  return erreur instanceof Error ? erreur.message : defaut
}
