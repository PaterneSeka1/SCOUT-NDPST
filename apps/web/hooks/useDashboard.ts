'use client'

import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { useSession } from '@/lib/session-client'
import { lireDashboard } from '@/lib/dashboard'

const abonnementHydratation = () => () => {}
const snapshotClient = () => true
const snapshotServeur = () => false

/** Une requête commune à la page et au widget, cloisonnée par compte et périmètre. */
export function useDashboard() {
  const { data: session } = useSession()
  const utilisateur = session?.user
  const hydrate = useSyncExternalStore(abonnementHydratation, snapshotClient, snapshotServeur)
  const requete = useQuery({
    queryKey: ['tableau-de-bord', utilisateur?.id, utilisateur?.role, utilisateur?.mandatId, utilisateur?.brancheType],
    enabled: Boolean(utilisateur?.id),
    retry: false,
    retryOnMount: false,
    staleTime: 60_000,
    // Laisser la promesse se terminer pendant un démontage permet de la
    // partager lors du remontage StrictMode ; sa clé conserve le périmètre initial.
    queryFn: async () => {
      const reponse = await fetch('/api/tableau-de-bord')
      return lireDashboard(reponse)
    },
  })
  // Le widget peut avoir rempli le cache avant l’hydratation de la page.
  // Garder le squelette SSR au premier rendu évite une divergence de HTML.
  return { ...requete, hydrate }
}
