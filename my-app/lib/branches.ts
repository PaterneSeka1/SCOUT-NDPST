export const LABELS_BRANCHES: Record<string, string> = {
  OISILLONS: 'Oisillons',
  LOUVETEAUX: 'Louveteaux',
  ECLAIREURS: 'Éclaireurs',
  CHEMINOTS: 'Cheminots',
  COMPAGNONS: 'Compagnons (Routiers)',
}

export const COULEURS_BRANCHES: Record<string, string> = {
  OISILLONS: 'bg-yellow-100 text-yellow-800',
  LOUVETEAUX: 'bg-orange-100 text-orange-800',
  ECLAIREURS: 'bg-green-100 text-green-800',
  CHEMINOTS: 'bg-blue-100 text-blue-800',
  COMPAGNONS: 'bg-purple-100 text-purple-800',
}

// Ordre de progression des branches, du plus jeune au plus âgé.
export const ORDRE_BRANCHES = ['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS']

// Tranches d'âge indicatives par branche, utilisées pour proposer le passage
// de branche en fin d'année scoute. Ce sont des valeurs par défaut modifiables
// au cas par cas lors de la validation — aucun scout n'est jamais déplacé
// automatiquement sans confirmation explicite d'un responsable de groupe.
export const TRANCHES_AGE_BRANCHES: Record<string, { min: number; max: number }> = {
  OISILLONS: { min: 6, max: 7 },
  LOUVETEAUX: { min: 8, max: 10 },
  ECLAIREURS: { min: 11, max: 13 },
  CHEMINOTS: { min: 14, max: 16 },
  COMPAGNONS: { min: 17, max: 20 },
}

/** Âge atteint à la date de référence (méthode classique jour/mois, pas une approximation à 365 jours). */
export function calculerAge(dateNaissance: Date, dateReference: Date): number {
  let age = dateReference.getFullYear() - dateNaissance.getFullYear()
  const pasEncoreAnniversaire =
    dateReference.getMonth() < dateNaissance.getMonth() ||
    (dateReference.getMonth() === dateNaissance.getMonth() && dateReference.getDate() < dateNaissance.getDate())
  if (pasEncoreAnniversaire) age -= 1
  return age
}

/** Branche correspondant à un âge donné, ou null si hors de toutes les tranches (trop jeune ou trop âgé). */
export function brancheSelonAge(age: number): string | null {
  for (const branche of ORDRE_BRANCHES) {
    const tranche = TRANCHES_AGE_BRANCHES[branche]
    if (age >= tranche.min && age <= tranche.max) return branche
  }
  return null
}
