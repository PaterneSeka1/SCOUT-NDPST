import { LABELS_STATUT_COTISATION, COULEURS_STATUT_COTISATION } from '@/lib/cotisations'

/**
 * Statut du droit d'adhésion (année pastorale en cours) pour une ligne de
 * liste (scouts, utilisateurs...). `statut` null = aucune cotisation
 * ADHESION_ANNUELLE générée pour cette personne cette année — affiché
 * identiquement à NON_A_JOUR (même sens pratique : personne n'a rien réglé).
 */
export function BadgeAdhesion({ statut }: { statut: string | null }) {
  const valeur = statut ?? 'NON_A_JOUR'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${COULEURS_STATUT_COTISATION[valeur] ?? 'bg-gray-100 text-gray-700'}`}>
      {LABELS_STATUT_COTISATION[valeur] ?? valeur}
    </span>
  )
}
