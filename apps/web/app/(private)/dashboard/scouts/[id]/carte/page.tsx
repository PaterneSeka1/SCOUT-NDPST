'use client'

import Image from 'next/image'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useScout } from '@/hooks/useScouts'
import { LABELS_BRANCHES } from '@scout/shared'
import { QRCodeScout } from '@/components/QRCodeScout'
import { BackLink } from '@/components/ui/BackLink'

export default function CarteScoutPage() {
  const { id } = useParams<{ id: string }>()
  const { data: scout, isLoading } = useScout(id)
  // Nom de la PAROISSE (pas de la plateforme) : une carte de membre porte
  // l'identité de qui la délivre.
  const [nomParoisse, setNomParoisse] = useState('')

  useEffect(() => {
    fetch('/api/paroisse')
      .then((r) => r.json())
      .then((data) => {
        if (data.nom) setNomParoisse(data.nom)
      })
      .catch(() => {})
  }, [])

  if (isLoading)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )

  if (!scout)
    return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">Fiche introuvable.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <BackLink href={`/dashboard/scouts/${id}`}>Retour à la fiche</BackLink>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-(--cp) px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
        >
          Imprimer la carte
        </button>
      </div>

      <div className="flex justify-center">
        <div className="w-80 space-y-3 rounded-2xl border-2 border-(--cp) bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-(--cp) uppercase">{nomParoisse}</p>
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-(--cp)/10">
            {scout.photo ? (
              <Image
                width={80}
                height={80}
                unoptimized
                src={scout.photo}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-(--cp)">
                {scout.prenom[0]}
                {scout.nom[0]}
              </span>
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              {scout.prenom} {scout.nom}
            </p>
            <p className="text-sm text-gray-500">{LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}</p>
            {scout.matricule && <p className="mt-0.5 font-mono text-xs text-gray-400">{scout.matricule}</p>}
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
