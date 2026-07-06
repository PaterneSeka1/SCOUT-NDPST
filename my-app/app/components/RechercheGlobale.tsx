'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ROLES_TOUT_STAFF, ROLES_GROUPE } from '@/lib/roles'
import { LABELS_BRANCHES } from '@/lib/branches'
import { LABELS_ROLES } from '@/lib/roles'

interface ScoutResultat {
  id: string; nom: string; prenom: string; matricule: string | null; brancheType: string
}
interface UtilisateurResultat {
  id: string; nom: string; prenom: string; matricule: string | null; role: string
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
    if (requete.trim().length < TAILLE_MIN_REQUETE) {
      setScouts([])
      setUtilisateurs([])
      return
    }

    const identifiant = setTimeout(() => {
      setChargement(true)
      const q = encodeURIComponent(requete.trim())
      const requetes: Promise<void>[] = [
        fetch(`/api/scouts?recherche=${q}&limite=5`)
          .then((r) => r.json())
          .then((data) => setScouts(data.scouts ?? []))
          .catch(() => setScouts([])),
      ]
      if (peutVoirUtilisateurs) {
        requetes.push(
          fetch(`/api/utilisateurs?recherche=${q}&limite=5`)
            .then((r) => r.json())
            .then((data) => setUtilisateurs(data.utilisateurs ?? []))
            .catch(() => setUtilisateurs([])),
        )
      }
      Promise.all(requetes).finally(() => setChargement(false))
    }, DELAI_DEBOUNCE_MS)

    return () => clearTimeout(identifiant)
  }, [requete, peutVoirUtilisateurs])

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', surClicExterieur)
    return () => document.removeEventListener('mousedown', surClicExterieur)
  }, [])

  if (!estStaff) return null

  const aucunResultat = requete.trim().length >= TAILLE_MIN_REQUETE && !chargement && scouts.length === 0 && utilisateurs.length === 0

  const allerA = (chemin: string) => {
    router.push(chemin)
    setRequete('')
    setOuvert(false)
  }

  return (
    <div ref={conteneurRef} className="relative w-full max-w-xs">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="search"
          value={requete}
          onChange={(e) => { setRequete(e.target.value); setOuvert(true) }}
          onFocus={() => setOuvert(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOuvert(false) }}
          placeholder="Rechercher un scout, un utilisateur…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent focus:bg-white transition-colors"
        />
      </div>

      {ouvert && requete.trim().length >= TAILLE_MIN_REQUETE && (
        <div className="absolute z-40 mt-1.5 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {chargement && (
            <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              Recherche…
            </div>
          )}

          {!chargement && aucunResultat && (
            <div className="px-4 py-3 text-sm text-gray-400">Aucun résultat pour « {requete.trim()} »</div>
          )}

          {scouts.length > 0 && (
            <div className="py-1.5">
              <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Scouts</p>
              {scouts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => allerA(`/dashboard/scouts/${s.id}`)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-gray-800 truncate">{s.prenom} {s.nom}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{LABELS_BRANCHES[s.brancheType] ?? s.brancheType}</span>
                </button>
              ))}
            </div>
          )}

          {utilisateurs.length > 0 && (
            <div className="py-1.5 border-t border-gray-100">
              <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Utilisateurs</p>
              {utilisateurs.map((u) => (
                <button
                  key={u.id}
                  onClick={() => allerA(`/dashboard/utilisateurs/${u.id}`)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-gray-800 truncate">{u.prenom} {u.nom}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{LABELS_ROLES[u.role] ?? u.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
