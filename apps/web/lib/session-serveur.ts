import 'server-only'
import { cache } from 'react'
import { appelApiServeur } from './api-serveur'
import type { Session } from './session-types'

// Session de l'utilisateur courant, validée par l'API (signature, expiration).
// Le frontend ne détient aucun secret : il ne fait que relayer le cookie.
// Mis en cache pour la durée d'un rendu (layout + page = un seul appel).
export const getSession = cache(async (): Promise<Session | null> => {
  try {
    const reponse = await appelApiServeur('/api/auth/session')
    if (!reponse.ok) return null
    const { utilisateur } = (await reponse.json()) as { utilisateur: Session['user'] }
    return { user: utilisateur }
  } catch {
    return null
  }
})
