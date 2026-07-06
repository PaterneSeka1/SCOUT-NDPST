'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES, COULEURS_BRANCHES, ORDRE_BRANCHES } from '@/lib/branches'
import { ROLES_GROUPE } from '@/lib/roles'

const LABELS_ROLE: Record<string, string> = {
  RESPONSABLE: 'Responsable',
  ADJOINT: 'Adjoint',
  ASSISTANT: 'Assistant',
}

interface Poste {
  id: string
  brancheType: string
  role: string
  fonction: string | null
  utilisateur: { id: string; nom: string; prenom: string; email: string | null; telephone: string | null }
}

export default function PageBranches() {
  const { data: session } = useSession()
  const [postes, setPostes] = useState<Poste[]>([])
  const [comptes, setComptes] = useState<Record<string, number>>({})
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/branches')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { toast.error(data.erreur); return }
        setPostes(data.postes)
        setComptes(data.comptesParBranche)
      })
      .catch(() => toast.error('Impossible de charger les branches'))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organisation des branches scouts de la paroisse</p>
        </div>
        {session?.user && ROLES_GROUPE.includes(session.user.role) && (
          <Link href="/dashboard/branches/passage"
            className="flex-shrink-0 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium">
            Passage de branche
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ORDRE_BRANCHES.map((branche) => {
          const postesbranche = postes.filter((p) => p.brancheType === branche)
          const responsable = postesbranche.find((p) => p.role === 'RESPONSABLE')
          const adjoint = postesbranche.find((p) => p.role === 'ADJOINT')
          const assistants = postesbranche.filter((p) => p.role === 'ASSISTANT')
          const nbScouts = comptes[branche] ?? 0
          const couleur = COULEURS_BRANCHES[branche] ?? 'bg-gray-100 text-gray-700'
          const [bgCls, textCls] = couleur.split(' ')

          return (
            <div key={branche} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* En-tête branche */}
              <div className={`${bgCls} px-5 py-4 flex items-center justify-between`}>
                <div>
                  <h2 className={`font-bold text-base ${textCls}`}>{LABELS_BRANCHES[branche]}</h2>
                  <p className={`text-xs mt-0.5 ${textCls} opacity-75`}>{nbScouts} scout{nbScouts > 1 ? 's' : ''} actif{nbScouts > 1 ? 's' : ''}</p>
                </div>
                <Link href={`/dashboard/scouts?branche=${branche}`}
                  className={`text-xs ${textCls} underline underline-offset-2 hover:opacity-80`}>
                  Voir les scouts →
                </Link>
              </div>

              {/* Encadrants */}
              <div className="divide-y divide-gray-100">
                {postesbranche.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400 italic">Aucun encadrant assigné</p>
                ) : (
                  [responsable, adjoint, ...assistants].filter(Boolean).map((p) => p && (
                    <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                        {p.utilisateur.prenom[0]}{p.utilisateur.nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.utilisateur.prenom} {p.utilisateur.nom}</p>
                        <p className="text-xs text-gray-500">{LABELS_ROLE[p.role]}{p.fonction ? ` — ${p.fonction}` : ''}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        p.role === 'RESPONSABLE' ? 'bg-[#1a4731] text-white' :
                        p.role === 'ADJOINT' ? 'bg-gray-200 text-gray-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{LABELS_ROLE[p.role]}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
