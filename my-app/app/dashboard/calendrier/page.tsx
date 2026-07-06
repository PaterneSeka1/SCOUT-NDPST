'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { LABELS_BRANCHES } from '@/lib/branches'

interface EvenementCalendrier {
  id: string
  source: 'activite' | 'reunion'
  titre: string
  description: string | null
  debut: string
  fin: string | null
  lieu: string | null
  brancheType: string | null
  meta: string
}

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function cleMois(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function construireGrille(annee: number, mois: number): Date[] {
  const premierJour = new Date(annee, mois, 1)
  const decalage = (premierJour.getDay() + 6) % 7 // lundi = 0
  const debutGrille = new Date(annee, mois, 1 - decalage)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debutGrille)
    d.setDate(debutGrille.getDate() + i)
    return d
  })
}

export default function PageCalendrier() {
  const [reference, setReference] = useState(() => new Date())
  const [evenements, setEvenements] = useState<EvenementCalendrier[]>([])
  const [chargement, setChargement] = useState(true)
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(null)
  const [lienAbonnement, setLienAbonnement] = useState('')
  const [genereEnCours, setGenereEnCours] = useState(false)

  useEffect(() => {
    setChargement(true)
    fetch(`/api/calendrier?mois=${cleMois(reference)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { toast.error(data.erreur); return }
        setEvenements(data.evenements ?? [])
      })
      .catch(() => toast.error('Impossible de charger le calendrier'))
      .finally(() => setChargement(false))
  }, [reference])

  const grille = useMemo(() => construireGrille(reference.getFullYear(), reference.getMonth()), [reference])

  const evenementsParJour = useMemo(() => {
    const map = new Map<string, EvenementCalendrier[]>()
    for (const e of evenements) {
      const cle = new Date(e.debut).toDateString()
      if (!map.has(cle)) map.set(cle, [])
      map.get(cle)!.push(e)
    }
    return map
  }, [evenements])

  const evenementsJourSelectionne = jourSelectionne
    ? evenements.filter((e) => new Date(e.debut).toDateString() === jourSelectionne)
    : []

  const genererLien = async () => {
    setGenereEnCours(true)
    try {
      const res = await fetch('/api/calendrier/token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur'); return }
      const urlComplete = `${window.location.origin}${data.url}`
      setLienAbonnement(urlComplete)
    } catch {
      toast.error('Impossible de générer le lien')
    } finally {
      setGenereEnCours(false)
    }
  }

  const copierLien = async () => {
    await navigator.clipboard.writeText(lienAbonnement)
    toast.success('Lien copié')
  }

  const aujourdHui = new Date().toDateString()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Calendrier</h1>
          <p className="text-sm text-gray-500 mt-0.5">Activités et réunions du mois</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReference((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-gray-800 min-w-[140px] text-center capitalize">
            {reference.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setReference((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            ›
          </button>
          <button
            onClick={() => setReference(new Date())}
            className="text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
          >
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Abonnement calendrier externe</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ajoutez ce lien dans Google Calendar, Apple Calendar ou Outlook pour voir les activités et réunions se synchroniser automatiquement.
            </p>
          </div>
          <button
            onClick={genererLien}
            disabled={genereEnCours}
            className="flex-shrink-0 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60"
          >
            {genereEnCours ? 'Génération…' : lienAbonnement ? 'Régénérer le lien' : 'Obtenir mon lien'}
          </button>
        </div>
        {lienAbonnement && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <input readOnly value={lienAbonnement} className="flex-1 min-w-0 bg-transparent text-xs text-gray-600 outline-none" />
            <button onClick={copierLien} className="text-xs text-[#1a4731] font-medium hover:underline flex-shrink-0">Copier</button>
          </div>
        )}
      </div>

      {chargement ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
            {JOURS_SEMAINE.map((j) => (
              <div key={j} className="text-center text-xs font-medium text-gray-500 py-2">{j}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grille.map((jour) => {
              const cle = jour.toDateString()
              const evenementsJour = evenementsParJour.get(cle) ?? []
              const dansLeMois = jour.getMonth() === reference.getMonth()
              const estAujourdHui = cle === aujourdHui
              return (
                <button
                  key={cle}
                  onClick={() => setJourSelectionne(cle)}
                  className={`min-h-[84px] border-b border-r border-gray-100 p-1.5 text-left align-top hover:bg-gray-50 transition-colors ${
                    dansLeMois ? '' : 'bg-gray-50/50'
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                      estAujourdHui ? 'bg-[#1a4731] text-white font-semibold' : dansLeMois ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    {jour.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {evenementsJour.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        className={`text-[10px] px-1 py-0.5 rounded truncate ${
                          e.source === 'reunion' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {e.titre}
                      </div>
                    ))}
                    {evenementsJour.length > 3 && (
                      <p className="text-[10px] text-gray-400 px-1">+{evenementsJour.length - 3} autre(s)</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {jourSelectionne && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 capitalize">
              {new Date(jourSelectionne).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <button onClick={() => setJourSelectionne(null)} className="text-xs text-gray-400 hover:text-gray-600">Fermer</button>
          </div>
          {evenementsJourSelectionne.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun événement ce jour-là.</p>
          ) : (
            <div className="space-y-2">
              {evenementsJourSelectionne.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                    e.source === 'reunion' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {e.source === 'reunion' ? 'Réunion' : 'Activité'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{e.titre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(e.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {e.lieu ? ` · ${e.lieu}` : ''}
                      {e.brancheType ? ` · ${LABELS_BRANCHES[e.brancheType] ?? e.brancheType}` : ' · Toutes branches'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
