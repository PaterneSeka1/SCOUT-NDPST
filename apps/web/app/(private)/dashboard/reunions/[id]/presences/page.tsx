'use client'

import Image from 'next/image'

import { useState, useEffect, use } from 'react'
import { toast } from 'sonner'
import { ScannerQR } from '@/components/ScannerQR'
import { decoderQrScout } from '@/lib/qr'
import { LABELS_BRANCHES as BRANCHES } from '@scout/shared'
import { BackLink } from '@/components/ui/BackLink'
import { Download, Camera } from '@/lib/icons'

const STATUTS = [
  {
    value: 'PRESENT',
    label: 'Présent',
    cls: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
    active: 'bg-green-500 text-white border-green-500 hover:bg-green-600',
  },
  {
    value: 'EXCUSE',
    label: 'Excusé',
    cls: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200',
    active: 'bg-orange-400 text-white border-orange-400 hover:bg-orange-500',
  },
  {
    value: 'ABSENT',
    label: 'Absent',
    cls: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200',
    active: 'bg-red-500 text-white border-red-500 hover:bg-red-600',
  },
] as const

interface Scout {
  id: string
  prenom: string
  nom: string
  photo: string | null
  brancheType: string
}

interface Reunion {
  id: string
  titre: string | null
  brancheType: string | null
  dateHeure: string
  dateReportee: string | null
  lieu: string | null
  statut: string
}

type PresenceMap = Record<string, { statut: string; note: string | null }>
type StatutMap = Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSE'>

export default function PagePresencesReunion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [reunion, setReunion] = useState<Reunion | null>(null)
  const [scouts, setScouts] = useState<Scout[]>([])
  const [statuts, setStatuts] = useState<StatutMap>({})
  const [chargement, setChargement] = useState(true)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [modifie, setModifie] = useState(false)
  const [scannerOuvert, setScannerOuvert] = useState(false)

  useEffect(() => {
    fetch(`/api/reunions/${id}/presences`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) {
          toast.error(data.erreur)
          return
        }
        setReunion(data.reunion)
        setScouts(data.scouts)
        const init: StatutMap = {}
        data.scouts.forEach((s: Scout) => {
          const statut = (data.presencesMap as PresenceMap)[s.id]?.statut
          init[s.id] = statut === 'PRESENT' || statut === 'EXCUSE' ? statut : 'ABSENT'
        })
        setStatuts(init)
      })
      .catch(() => toast.error('Impossible de charger la feuille de présences'))
      .finally(() => setChargement(false))
  }, [id])

  const setStatut = (scoutId: string, val: 'PRESENT' | 'ABSENT' | 'EXCUSE') => {
    setModifie(true)
    setStatuts((prev) => ({ ...prev, [scoutId]: val }))
  }

  const marquerTous = (val: 'PRESENT' | 'ABSENT') => {
    setModifie(true)
    const next: StatutMap = {}
    scouts.forEach((s) => {
      next[s.id] = val
    })
    setStatuts(next)
  }

  const handleScan = (contenu: string) => {
    const scoutId = decoderQrScout(contenu)
    if (!scoutId) {
      toast.error('QR code non reconnu')
      return
    }
    const scout = scouts.find((s) => s.id === scoutId)
    if (!scout) {
      toast.error('Ce scout ne fait pas partie de cette liste')
      return
    }
    setStatut(scoutId, 'PRESENT')
    toast.success(`${scout.prenom} ${scout.nom} — présent`)
  }

  const handleSauvegarder = async () => {
    setSauvegarde(true)
    try {
      const presences = scouts.map((s) => ({ scoutId: s.id, statut: statuts[s.id] ?? 'ABSENT' }))
      const res = await fetch(`/api/reunions/${id}/presences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presences }),
      })
      if (res.ok) {
        toast.success('Présences enregistrées.')
        setModifie(false)
      } else {
        const d = await res.json()
        toast.error(d.erreur ?? 'Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSauvegarde(false)
    }
  }

  const stats = {
    present: scouts.filter((s) => statuts[s.id] === 'PRESENT').length,
    excuse: scouts.filter((s) => statuts[s.id] === 'EXCUSE').length,
    absent: scouts.filter((s) => statuts[s.id] === 'ABSENT').length,
  }

  const dateAffichee = reunion ? new Date(reunion.dateReportee ?? reunion.dateHeure) : null

  const handleExportCSV = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- téléchargement d'un fichier servi par l'API, pas une page
    window.location.href = `/api/reunions/${id}/presences/export`
  }

  if (chargement)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )

  if (!reunion) return null

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <div className="mt-1 shrink-0">
          <BackLink href="/dashboard/reunions">Retour</BackLink>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">
            {reunion.titre || `Réunion ${reunion.brancheType ? BRANCHES[reunion.brancheType] : ''}`}
          </h1>
          {dateAffichee && (
            <p className="mt-0.5 text-sm text-stone-500">
              {dateAffichee.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
              {' à '}
              {dateAffichee.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {reunion.lieu ? ` · ${reunion.lieu}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Bouton export */}
      <div className="flex justify-end">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
        >
          <Download className="h-4 w-4" strokeWidth={2} />
          Exporter CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.present}</p>
          <p className="mt-0.5 text-xs text-green-600">Présent{stats.present > 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{stats.excuse}</p>
          <p className="mt-0.5 text-xs text-orange-500">Excusé{stats.excuse > 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.absent}</p>
          <p className="mt-0.5 text-xs text-red-500">Absent{stats.absent > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Actions rapides */}
      {scouts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-stone-500">Tout marquer :</span>
          <button
            onClick={() => marquerTous('PRESENT')}
            className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-50"
          >
            Tous présents
          </button>
          <button
            onClick={() => marquerTous('ABSENT')}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            Tous absents
          </button>
          <button
            onClick={() => setScannerOuvert(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-(--cp) px-3 py-1.5 text-xs font-medium text-white transition-all hover:brightness-110"
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2} />
            Scanner un QR
          </button>
        </div>
      )}

      {scannerOuvert && <ScannerQR onDetection={handleScan} onFermer={() => setScannerOuvert(false)} />}

      {/* Liste scouts */}
      {scouts.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-sm text-stone-400">Aucun scout actif dans cette branche</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-50 rounded-xl border border-stone-200 bg-white">
          {scouts.map((scout, i) => {
            const statut = statuts[scout.id] ?? 'ABSENT'
            return (
              <div key={scout.id} className="flex items-center gap-3 px-4 py-3">
                {/* Numéro */}
                <span className="w-5 shrink-0 text-right text-xs text-stone-300">{i + 1}</span>

                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--cp)/10">
                  {scout.photo ? (
                    <Image
                      width={36}
                      height={36}
                      unoptimized
                      src={scout.photo}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-(--cp)">
                      {scout.prenom[0]}
                      {scout.nom[0]}
                    </span>
                  )}
                </div>

                {/* Nom */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {scout.prenom} {scout.nom}
                  </p>
                  <p className="text-xs text-stone-400">{BRANCHES[scout.brancheType] ?? scout.brancheType}</p>
                </div>

                {/* Boutons statut */}
                <div className="flex shrink-0 gap-1">
                  {STATUTS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStatut(scout.id, s.value)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${statut === s.value ? s.active : s.cls}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bouton enregistrer — sticky en bas */}
      {scouts.length > 0 && (
        <div className="sticky bottom-4">
          <button
            onClick={handleSauvegarder}
            disabled={sauvegarde || !modifie}
            className="w-full rounded-xl bg-(--cp) py-3.5 text-sm font-medium text-white shadow-(--cp)/20 shadow-lg transition-all hover:brightness-110 disabled:opacity-60"
          >
            {sauvegarde
              ? 'Enregistrement…'
              : `Enregistrer les présences (${stats.present} présent${stats.present > 1 ? 's' : ''})`}
          </button>
        </div>
      )}
    </div>
  )
}
