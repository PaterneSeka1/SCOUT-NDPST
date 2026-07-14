import { LABELS_STATUT_COTISATION, COULEURS_STATUT_COTISATION } from '@/lib/cotisations'

/**
 * Statut du droit d'adhésion (année pastorale en cours) pour une ligne de
 * liste (scouts, utilisateurs...). `statut` null = aucune cotisation
 * ADHESION_ANNUELLE générée pour cette personne cette année — affiché comme
 * "Pas à jour" : par défaut, sans enregistrement, personne n'est à jour.
 */
export function BadgeAdhesion({ statut }: { statut: string | null }) {
  if (!statut) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Pas à jour</span>
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${COULEURS_STATUT_COTISATION[statut] ?? 'bg-gray-100 text-gray-700'}`}>
      {LABELS_STATUT_COTISATION[statut] ?? statut}
    </span>
  )
}
