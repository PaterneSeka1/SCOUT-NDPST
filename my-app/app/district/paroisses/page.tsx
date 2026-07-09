'use client'

import { useEffect, useState } from 'react'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'

interface ChefGroupe {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
}

interface EffectifBranche {
  brancheType: string
  count: number
}

interface ParoisseDistrict {
  id: string
  nom: string
  ville: string
  actif: boolean
  chefGroupe: ChefGroupe | null
  effectifsParBranche: EffectifBranche[]
}

function StatutParoisse({ actif }: { actif: boolean }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
      {actif ? 'Active' : 'Désactivée'}
    </span>
  )
}

function BadgeBranche({ effectif }: { effectif: EffectifBranche }) {
  const label = LABELS_BRANCHES[effectif.brancheType] ?? effectif.brancheType
  const couleur = COULEURS_BRANCHES[effectif.brancheType] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${couleur}`}>
      {label}
      <span className="font-bold">{effectif.count}</span>
    </span>
  )
}

export default function ParoissesDuDistrict() {
  const [paroisses, setParoisses] = useState<ParoisseDistrict[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/district/paroisses')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.erreur ?? 'Erreur serveur')
        return data
      })
      .then((data) => setParoisses(data.paroisses))
      .catch((e) => setErreur(e.message ?? 'Impossible de charger les paroisses.'))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
        <p className="text-sm font-medium text-red-600">{erreur}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paroisses du district</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {paroisses.length} paroisse{paroisses.length > 1 ? 's' : ''} dans le district
        </p>
      </div>

      {paroisses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-700">Aucune paroisse dans ce district</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paroisses.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 leading-snug break-words">{p.nom}</h2>
                  <p className="text-xs text-gray-500 mt-1">{p.ville}</p>
                </div>
                <StatutParoisse actif={p.actif} />
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-[11px] uppercase font-semibold text-gray-400">Chef de Groupe</p>
                {p.chefGroupe ? (
                  <div className="mt-0.5">
                    <p className="text-sm font-medium text-gray-800">{p.chefGroupe.prenom} {p.chefGroupe.nom}</p>
                    {[p.chefGroupe.matricule, p.chefGroupe.telephone, p.chefGroupe.email].filter(Boolean).length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[p.chefGroupe.matricule, p.chefGroupe.telephone, p.chefGroupe.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-orange-600 mt-0.5">À désigner</p>
                )}
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-[11px] uppercase font-semibold text-gray-400 mb-2">Effectifs par branche</p>
                {p.effectifsParBranche.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun scout actif</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {p.effectifsParBranche.map((e) => (
                      <BadgeBranche key={e.brancheType} effectif={e} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
