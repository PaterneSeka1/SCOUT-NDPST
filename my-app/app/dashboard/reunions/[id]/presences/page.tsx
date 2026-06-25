'use client'

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'

const STATUTS = [
  { value: 'PRESENT', label: 'Présent', cls: 'bg-green-100 text-green-700 border-green-200', active: 'bg-green-500 text-white border-green-500' },
  { value: 'EXCUSE', label: 'Excusé', cls: 'bg-orange-100 text-orange-700 border-orange-200', active: 'bg-orange-400 text-white border-orange-400' },
  { value: 'ABSENT', label: 'Absent', cls: 'bg-red-100 text-red-700 border-red-200', active: 'bg-red-500 text-white border-red-500' },
]

const BRANCHES: Record<string, string> = {
  OISILLONS: 'Oisillons', LOUVETEAUX: 'Louveteaux', ECLAIREURS: 'Éclaireurs',
  CHEMINOTS: 'Cheminots', COMPAGNONS: 'Compagnons',
}

interface Scout {
  id: string; prenom: string; nom: string; photo: string | null; brancheType: string
}

interface Reunion {
  id: string; titre: string | null; brancheType: string | null
  dateHeure: string; dateReportee: string | null; lieu: string | null; statut: string
}

type PresenceMap = Record<string, { statut: string; note: string | null }>
type StatutMap = Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSE'>

export default function PagePresencesReunion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()

  const [reunion, setReunion] = useState<Reunion | null>(null)
  const [scouts, setScouts] = useState<Scout[]>([])
  const [statuts, setStatuts] = useState<StatutMap>({})
  const [chargement, setChargement] = useState(true)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [modifie, setModifie] = useState(false)

  useEffect(() => {
    fetch(`/api/reunions/${id}/presences`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { toast.error(data.erreur); return }
        setReunion(data.reunion)
        setScouts(data.scouts)
        const init: StatutMap = {}
        data.scouts.forEach((s: Scout) => {
          init[s.id] = (data.presencesMap as PresenceMap)[s.id]?.statut as any ?? 'ABSENT'
        })
        setStatuts(init)
      })
      .catch(() => toast.error('Impossible de charger la feuille de présences'))
      .finally(() => setChargement(false))
  }, [id])

  const toggleStatut = (scoutId: string) => {
    setModifie(true)
    setStatuts((prev) => {
      const actuel = prev[scoutId] ?? 'ABSENT'
      const suivant: Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSE'> = {
        ABSENT: 'PRESENT', PRESENT: 'EXCUSE', EXCUSE: 'ABSENT',
      }
      return { ...prev, [scoutId]: suivant[actuel] }
    })
  }

  const setStatut = (scoutId: string, val: 'PRESENT' | 'ABSENT' | 'EXCUSE') => {
    setModifie(true)
    setStatuts((prev) => ({ ...prev, [scoutId]: val }))
  }

  const marquerTous = (val: 'PRESENT' | 'ABSENT') => {
    setModifie(true)
    const next: StatutMap = {}
    scouts.forEach((s) => { next[s.id] = val })
    setStatuts(next)
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
    window.location.href = `/api/reunions/${id}/presences/export`
  }

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!reunion) return null

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/reunions" className="text-gray-400 hover:text-gray-600 mt-1 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">
            {reunion.titre || `Réunion ${reunion.brancheType ? BRANCHES[reunion.brancheType] : ''}`}
          </h1>
          {dateAffichee && (
            <p className="text-sm text-gray-500 mt-0.5">
              {dateAffichee.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' à '}
              {dateAffichee.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {reunion.lieu ? ` · ${reunion.lieu}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Bouton export */}
      <div className="flex justify-end">
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exporter CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.present}</p>
          <p className="text-xs text-green-600 mt-0.5">Présent{stats.present > 1 ? 's' : ''}</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{stats.excuse}</p>
          <p className="text-xs text-orange-500 mt-0.5">Excusé{stats.excuse > 1 ? 's' : ''}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.absent}</p>
          <p className="text-xs text-red-500 mt-0.5">Absent{stats.absent > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Actions rapides */}
      {scouts.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">Tout marquer :</span>
          <button onClick={() => marquerTous('PRESENT')}
            className="text-xs border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors font-medium">
            Tous présents
          </button>
          <button onClick={() => marquerTous('ABSENT')}
            className="text-xs border border-red-200 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium">
            Tous absents
          </button>
        </div>
      )}

      {/* Liste scouts */}
      {scouts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">Aucun scout actif dans cette branche</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {scouts.map((scout, i) => {
            const statut = statuts[scout.id] ?? 'ABSENT'
            return (
              <div key={scout.id} className="flex items-center gap-3 px-4 py-3">
                {/* Numéro */}
                <span className="flex-shrink-0 w-5 text-xs text-gray-300 text-right">{i + 1}</span>

                {/* Avatar */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden bg-[#1a4731]/10 flex items-center justify-center">
                  {scout.photo ? (
                    <img src={scout.photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-[#1a4731]">{scout.prenom[0]}{scout.nom[0]}</span>
                  )}
                </div>

                {/* Nom */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{scout.prenom} {scout.nom}</p>
                  <p className="text-xs text-gray-400">{BRANCHES[scout.brancheType] ?? scout.brancheType}</p>
                </div>

                {/* Boutons statut */}
                <div className="flex-shrink-0 flex gap-1">
                  {STATUTS.map((s) => (
                    <button key={s.value} onClick={() => setStatut(scout.id, s.value as any)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${statut === s.value ? s.active : s.cls}`}>
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
          <button onClick={handleSauvegarder} disabled={sauvegarde || !modifie}
            className="w-full bg-[#1a4731] text-white py-3.5 rounded-xl font-medium text-sm hover:bg-[#163d29] transition-colors disabled:opacity-60 shadow-lg shadow-[#1a4731]/20">
            {sauvegarde ? 'Enregistrement…' : `Enregistrer les présences (${stats.present} présent${stats.present > 1 ? 's' : ''})`}
          </button>
        </div>
      )}
    </div>
  )
}
