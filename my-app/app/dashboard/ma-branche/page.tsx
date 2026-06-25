'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'

const LABELS_TYPE: Record<string, string> = {
  REUNION: 'Réunion', SORTIE: 'Sortie', CAMP: 'Camp', MESSE: 'Messe',
  CEREMONIE: 'Cérémonie', FORMATION: 'Formation', AUTRE: 'Autre',
}

export default function PageMaBranche() {
  const { data: session } = useSession()
  const [scouts, setScouts] = useState<any[]>([])
  const [activites, setActivites] = useState<any[]>([])
  const [brancheType, setBrancheType] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    // Récupère le type de branche depuis les postes de l'utilisateur courant
    fetch('/api/branches')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { setErreur(data.erreur); return }
        const monPoste = data.postes.find((p: any) => p.utilisateur.id === session?.user?.id)
        if (!monPoste) { setErreur('Aucune branche assignée à votre compte'); setChargement(false); return }
        const type = monPoste.brancheType
        setBrancheType(type)
        return Promise.all([
          fetch(`/api/scouts?branche=${type}&limite=100`).then((r) => r.json()),
          fetch(`/api/activites?brancheType=${type}&limite=10`).then((r) => r.json()),
        ])
      })
      .then((results) => {
        if (!results) return
        const [scoutsData, activitesData] = results
        setScouts(scoutsData.scouts ?? [])
        setActivites(activitesData.activites ?? [])
      })
      .catch(() => setErreur('Impossible de charger les données'))
      .finally(() => setChargement(false))
  }, [session])

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erreur) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>

  const couleur = brancheType ? COULEURS_BRANCHES[brancheType] : 'bg-gray-100 text-gray-700'
  const [bgCls, textCls] = couleur.split(' ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ma branche</h1>
        {brancheType && (
          <span className={`inline-block mt-1 text-sm font-medium px-3 py-0.5 rounded-full ${bgCls} ${textCls}`}>
            {LABELS_BRANCHES[brancheType] ?? brancheType}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liste des scouts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Scouts ({scouts.length})</h2>
            <Link href="/dashboard/scouts" className="text-xs text-[#1a4731] hover:underline">Voir tout →</Link>
          </div>
          {scouts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun scout dans cette branche</p>
          ) : (
            <div className="space-y-2">
              {scouts.slice(0, 12).map((s: any) => (
                <Link key={s.id} href={`/dashboard/scouts/${s.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0 overflow-hidden">
                    {s.photo ? <img src={s.photo} className="w-full h-full object-cover" alt="" /> : `${s.prenom[0]}${s.nom[0]}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.prenom} {s.nom}</p>
                    <p className="text-xs text-gray-400">{s.matricule ?? 'Sans matricule'}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${s.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.actif ? 'Actif' : 'Inactif'}
                  </span>
                </Link>
              ))}
              {scouts.length > 12 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{scouts.length - 12} autres</p>
              )}
            </div>
          )}
        </div>

        {/* Activités récentes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Activités récentes</h2>
            <Link href="/dashboard/activites" className="text-xs text-[#1a4731] hover:underline">Voir tout →</Link>
          </div>
          {activites.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucune activité enregistrée</p>
          ) : (
            <div className="space-y-3">
              {activites.map((a: any) => (
                <Link key={a.id} href={`/dashboard/activites/${a.id}`}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-[#1a4731]/10 flex items-center justify-center text-lg flex-shrink-0">
                    {a.type === 'CAMP' ? '⛺' : a.type === 'SORTIE' ? '🥾' : a.type === 'MESSE' ? '✝️' : '📅'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.titre}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}{LABELS_TYPE[a.type] ?? a.type}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
