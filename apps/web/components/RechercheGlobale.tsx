'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-client'
import { ROLES_TOUT_STAFF, ROLES_GROUPE } from '@scout/shared'
import { LABELS_BRANCHES } from '@scout/shared'
import { LABELS_ROLES } from '@scout/shared'

interface ScoutResultat {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  brancheType: string
}
interface UtilisateurResultat {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  role: string
}

const DELAI_DEBOUNCE_MS = 300
const TAILLE_MIN_REQUETE = 2

export function RechercheGlobale() {
  const { data: session } = useSession()
  const router = useRouter()
  const conteneurRef = useRef<HTMLDivElement>(null)

  const [requete, setRequete] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [scouts, setScouts] = useState<ScoutResultat[]>([])
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurResultat[]>([])

  const role = session?.user?.role ?? ''
  const estStaff = ROLES_TOUT_STAFF.includes(role)
  const peutVoirUtilisateurs = ROLES_GROUPE.includes(role)

  useEffect(() => {
    if (requete.trim().length < TAILLE_MIN_REQUETE) return

    const controller = new AbortController()
    const identifiant = setTimeout(() => {
      setChargement(true)
      const q = encodeURIComponent(requete.trim())
      const requetes: Promise<void>[] = [
        fetch(`/api/scouts?recherche=${q}&limite=5`, { signal: controller.signal })
          .then((r) => r.json())
          .then((data) => {
            if (!controller.signal.aborted) setScouts(data.scouts ?? [])
          })
          .catch(() => {
            if (!controller.signal.aborted) setScouts([])
          }),
      ]
      if (peutVoirUtilisateurs) {
        requetes.push(
          fetch(`/api/utilisateurs?recherche=${q}&limite=5`, { signal: controller.signal })
            .then((r) => r.json())
            .then((data) => {
              if (!controller.signal.aborted) setUtilisateurs(data.utilisateurs ?? [])
            })
            .catch(() => {
              if (!controller.signal.aborted) setUtilisateurs([])
            }),
        )
      }
      Promise.all(requetes).finally(() => {
        if (!controller.signal.aborted) setChargement(false)
      })
    }, DELAI_DEBOUNCE_MS)

    return () => {
      clearTimeout(identifiant)
      controller.abort()
    }
  }, [requete, peutVoirUtilisateurs])

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', surClicExterieur)
    return () => document.removeEventListener('mousedown', surClicExterieur)
  }, [])

  if (!estStaff) return null

  const aucunResultat =
    requete.trim().length >= TAILLE_MIN_REQUETE && !chargement && scouts.length === 0 && utilisateurs.length === 0

  const allerA = (chemin: string) => {
    router.push(chemin)
    setRequete('')
    setScouts([])
    setUtilisateurs([])
    setChargement(false)
    setOuvert(false)
  }

  return (
    <div ref={conteneurRef} className="relative w-full max-w-sm">
      <div className="relative">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-encre-pale"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        <input
          type="search"
          value={requete}
          onChange={(e) => {
            setRequete(e.target.value)
            setScouts([])
            setUtilisateurs([])
            setChargement(false)
            setOuvert(true)
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOuvert(false)
          }}
          placeholder="Rechercher un scout, un membre…"
          aria-label="Rechercher un scout ou un membre de la maîtrise"
          className="w-full rounded-md border border-ligne bg-papier py-2 pr-3 pl-9 text-sm transition-colors focus:border-transparent focus:bg-white focus:ring-2 focus:ring-(--cp) focus:outline-none"
        />
      </div>

      {ouvert && requete.trim().length >= TAILLE_MIN_REQUETE && (
        <div className="absolute z-40 mt-1.5 max-h-96 w-full overflow-y-auto rounded-lg border border-ligne bg-white shadow-lg">
          {chargement && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-encre-pale">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-transparent" />
              Recherche…
            </div>
          )}

          {!chargement && aucunResultat && (
            <div className="px-4 py-3 text-sm text-encre-pale">Aucun résultat pour « {requete.trim()} »</div>
          )}

          {scouts.length > 0 && (
            <div className="py-1.5">
              <p className="px-4 py-1 text-xs font-semibold tracking-wide text-encre-pale uppercase">Scouts</p>
              {scouts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => allerA(`/dashboard/scouts/${s.id}`)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors hover:bg-papier"
                >
                  <span className="truncate text-sm text-encre">
                    {s.prenom} {s.nom}
                  </span>
                  <span className="shrink-0 text-xs text-encre-pale">
                    {LABELS_BRANCHES[s.brancheType] ?? s.brancheType}
                  </span>
                </button>
              ))}
            </div>
          )}

          {utilisateurs.length > 0 && (
            <div className="border-t border-ligne py-1.5">
              <p className="px-4 py-1 text-xs font-semibold tracking-wide text-encre-pale uppercase">Membres</p>
              {utilisateurs.map((u) => (
                <button
                  key={u.id}
                  onClick={() =>
                    allerA(u.role === 'PARENT' ? `/dashboard/parents/${u.id}` : `/dashboard/utilisateurs/${u.id}`)
                  }
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors hover:bg-papier"
                >
                  <span className="truncate text-sm text-encre">
                    {u.prenom} {u.nom}
                  </span>
                  <span className="shrink-0 text-xs text-encre-pale">{LABELS_ROLES[u.role] ?? u.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
