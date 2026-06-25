'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'

const LABELS_TYPE: Record<string, string> = {
  REUNION: 'Réunion', SORTIE: 'Sortie', CAMP: 'Camp', MESSE: 'Messe',
  CEREMONIE: 'Cérémonie', FORMATION: 'Formation', AUTRE: 'Autre',
}

interface Scout {
  id: string; nom: string; prenom: string; brancheType: string
  photo: string | null; actif: boolean; matricule: string | null
  _count: { presences: number }
  presences: { activite: { titre: string; dateDebut: string; type: string } }[]
}

interface Activite {
  id: string; titre: string; dateDebut: string; lieu: string | null; type: string; brancheType: string | null
}

export default function PageMesEnfants() {
  const [enfants, setEnfants] = useState<Scout[]>([])
  const [prochaines, setProchaines] = useState<Activite[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    fetch('/api/mes-enfants')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { setErreur(data.erreur); return }
        setEnfants(data.enfants ?? [])
        setProchaines(data.prochaines ?? [])
      })
      .catch(() => setErreur('Impossible de charger les données'))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erreur) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mes enfants</h1>
        <p className="text-sm text-gray-500 mt-0.5">Suivez la progression de vos enfants scouts</p>
      </div>

      {enfants.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">👨‍👧‍👦</p>
          <p className="text-sm text-gray-500">Aucun enfant lié à votre compte</p>
          <p className="text-xs text-gray-400 mt-1">Contactez un administrateur pour associer vos enfants</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {enfants.map((scout) => {
            const [bgCls, textCls] = (COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700').split(' ')
            return (
              <div key={scout.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-500 flex-shrink-0 overflow-hidden">
                      {scout.photo ? <img src={scout.photo} className="w-full h-full object-cover" alt="" /> : `${scout.prenom[0]}${scout.nom[0]}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{scout.prenom} {scout.nom}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${bgCls} ${textCls}`}>
                          {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${scout.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {scout.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>
                    <Link href={`/dashboard/scouts/${scout.id}`}
                      className="flex-shrink-0 text-xs text-[#1a4731] border border-[#1a4731]/30 px-3 py-1.5 rounded-lg hover:bg-[#1a4731]/5 transition-colors">
                      Voir la fiche
                    </Link>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {scout._count.presences} présence{scout._count.presences > 1 ? 's' : ''} au total
                    </p>
                    {scout.presences.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Aucune participation enregistrée</p>
                    ) : (
                      <div className="space-y-1.5">
                        {scout.presences.slice(0, 4).map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                            <span className="truncate">{p.activite.titre}</span>
                            <span className="flex-shrink-0 text-gray-400">
                              {new Date(p.activite.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Prochaines activités */}
      {prochaines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Prochaines activités</h2>
          <div className="space-y-3">
            {prochaines.map((a) => (
              <div key={a.id} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#1a4731]/10 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-[#1a4731] leading-none">
                    {new Date(a.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit' })}
                  </span>
                  <span className="text-xs text-[#1a4731]/70 leading-none">
                    {new Date(a.dateDebut).toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.titre}</p>
                  <p className="text-xs text-gray-400">
                    {LABELS_TYPE[a.type] ?? a.type}
                    {a.brancheType ? ` · ${LABELS_BRANCHES[a.brancheType] ?? a.brancheType}` : ''}
                    {a.lieu ? ` · ${a.lieu}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
