'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from './session-types'

type Statut = 'loading' | 'authenticated' | 'unauthenticated'

interface ValeurSession {
  data: Session | null
  status: Statut
  update: () => Promise<Session | null>
}

const ContexteSession = createContext<ValeurSession | null>(null)

async function lireSession(): Promise<Session | null> {
  try {
    const reponse = await fetch('/api/auth/session', { cache: 'no-store' })
    if (!reponse.ok) return null
    const { utilisateur } = (await reponse.json()) as { utilisateur: Session['user'] }
    return { user: utilisateur }
  } catch {
    return null
  }
}

// Fournit la session aux composants client. `sessionInitiale` (lue côté
// serveur par le layout) évite un aller-retour et l'état « loading » au
// premier rendu des pages protégées.
export function SessionProvider({
  children,
  sessionInitiale,
}: {
  children: React.ReactNode
  sessionInitiale?: Session | null
}) {
  const [session, setSession] = useState<Session | null | undefined>(sessionInitiale)

  const update = useCallback(async () => {
    const nouvelle = await lireSession()
    setSession(nouvelle)
    return nouvelle
  }, [])

  useEffect(() => {
    if (sessionInitiale !== undefined) return
    let actif = true
    lireSession().then((s) => {
      if (actif) setSession(s)
    })
    return () => {
      actif = false
    }
  }, [sessionInitiale])

  const valeur = useMemo<ValeurSession>(
    () => ({
      data: session ?? null,
      status: session === undefined ? 'loading' : session ? 'authenticated' : 'unauthenticated',
      update,
    }),
    [session, update],
  )

  return <ContexteSession.Provider value={valeur}>{children}</ContexteSession.Provider>
}

export function useSession(): ValeurSession {
  const valeur = useContext(ContexteSession)
  if (!valeur) throw new Error('useSession doit être utilisé sous <SessionProvider>')
  return valeur
}

// Ferme la session côté API (révocation du jeton de session) puis recharge
// la page cible : un rechargement complet vide aussi les caches React Query.
export async function signOut({ callbackUrl = '/login' }: { callbackUrl?: string } = {}) {
  try {
    await fetch('/api/auth/deconnexion', { method: 'POST' })
  } finally {
    window.location.assign(callbackUrl)
  }
}
