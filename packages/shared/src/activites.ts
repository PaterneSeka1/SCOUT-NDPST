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

// Les icônes par type d'activité vivent désormais dans lib/icons.ts
// (ICONES_TYPE_ACTIVITE, composants lucide-react) — un seul endroit pour ne
// pas faire diverger pictogramme texte et pictogramme SVG d'un écran à l'autre.
