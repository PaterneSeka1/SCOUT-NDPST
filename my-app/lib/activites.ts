export const LABELS_TYPE_ACTIVITE: Record<string, string> = {
  REUNION: 'Réunion',
  SORTIE: 'Sortie',
  CAMP: 'Camp',
  SERVICE: 'Service',
  CELEBRATION: 'Célébration',
  FORMATION: 'Formation',
  AUTRE: 'Autre',
}

export const COULEURS_TYPE_ACTIVITE: Record<string, string> = {
  REUNION: 'bg-blue-100 text-blue-800',
  SORTIE: 'bg-green-100 text-green-800',
  CAMP: 'bg-yellow-100 text-yellow-800',
  SERVICE: 'bg-purple-100 text-purple-800',
  CELEBRATION: 'bg-pink-100 text-pink-800',
  FORMATION: 'bg-indigo-100 text-indigo-800',
  AUTRE: 'bg-gray-100 text-gray-700',
}

// Reprend les pictogrammes déjà utilisés au fil de l'eau (tableau de bord,
// widget flottant) — centralisés ici pour éviter qu'une future icône ne
// diverge d'un écran à l'autre (même principe que ICONES_TYPE_DOCUMENT).
export const ICONES_TYPE_ACTIVITE: Record<string, string> = {
  REUNION: '📋',
  SORTIE: '🥾',
  CAMP: '⛺',
  SERVICE: '🤝',
  CELEBRATION: '🎉',
  FORMATION: '📚',
  AUTRE: '📋',
}
