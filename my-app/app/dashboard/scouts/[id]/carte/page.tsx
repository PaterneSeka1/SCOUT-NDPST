'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useScout } from '@/hooks/useScouts'
import { LABELS_BRANCHES } from '@/lib/branches'
import { QRCodeScout } from '@/app/components/QRCodeScout'

export default function CarteScoutPage() {
  const { id } = useParams<{ id: string }>()
  const { data: scout, isLoading } = useScout(id)
  // Nom de la PAROISSE (pas de la plateforme) : une carte de membre porte
  // l'identité de qui la délivre.
  const [nomParoisse, setNomParoisse] = useState('')

  useEffect(() => {
    fetch('/api/paroisse')
      .then((r) => r.json())
      .then((data) => { if (data.nom) setNomParoisse(data.nom) })
      .catch(() => {})
  }, [])

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!scout) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
      Fiche introuvable.
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/dashboard/scouts/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Retour à la fiche
        </Link>
        <button
          onClick={() => window.print()}
          className="bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
        >
          Imprimer la carte
        </button>
      </div>

      <div className="flex justify-center">
        <div className="w-80 bg-white border-2 border-[#1a4731] rounded-2xl p-6 text-center space-y-3 shadow-sm">
          <p className="text-xs font-semibold text-[#1a4731] uppercase tracking-wide">{nomParoisse}</p>
          <div className="w-20 h-20 mx-auto rounded-full bg-[#1a4731]/10 flex items-center justify-center overflow-hidden">
            {scout.photo ? (
              <img src={scout.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-[#1a4731]">{scout.prenom[0]}{scout.nom[0]}</span>
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{scout.prenom} {scout.nom}</p>
            <p className="text-sm text-gray-500">{LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}</p>
            {scout.matricule && <p className="text-xs text-gray-400 font-mono mt-0.5">{scout.matricule}</p>}
          </div>
          <div className="flex justify-center py-2">
            <QRCodeScout scoutId={scout.id} taille={140} />
          </div>
          <p className="text-[10px] text-gray-400">À présenter pour l&apos;émargement aux réunions et activités</p>
        </div>
      </div>
    </div>
  )
}
