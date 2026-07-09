'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_TEXTAREA = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent resize-none'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface ParoisseDistrict {
  id: string
  nom: string
  ville: string
}

export default function PageNouvelleActiviteBranche() {
  const router = useRouter()

  const [paroisses, setParoisses] = useState<ParoisseDistrict[]>([])
  const [paroisseId, setParoisseId] = useState('')
  const [titre, setTitre] = useState('')
  const [type, setType] = useState('REUNION')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [lieu, setLieu] = useState('')
  const [description, setDescription] = useState('')
  const [erreursChamps, setErreursChamps] = useState<{ titre?: string; dateDebut?: string; paroisseId?: string }>({})
  const [soumission, setSoumission] = useState(false)

  useEffect(() => {
    fetch('/api/district/paroisses')
      .then((r) => r.json())
      .then((data) => setParoisses(data.paroisses ?? []))
      .catch(() => toast.error('Impossible de charger les paroisses du district.'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: { titre?: string; dateDebut?: string; paroisseId?: string } = {}
    if (!titre.trim()) errs.titre = 'Le titre est requis'
    if (!dateDebut) errs.dateDebut = 'La date de début est requise'
    if (!paroisseId) errs.paroisseId = 'La paroisse est requise'
    if (Object.keys(errs).length) { setErreursChamps(errs); return }
    setErreursChamps({})

    setSoumission(true)
    try {
      const res = await fetch('/api/activites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: titre.trim(),
          description: description.trim() || undefined,
          dateDebut,
          dateFin: dateFin || undefined,
          lieu: lieu.trim() || undefined,
          type,
          paroisseId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur serveur'); return }
      router.push('/district/ma-branche')
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/district/ma-branche" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à ma branche
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouvelle activité de branche</h1>
        <p className="text-sm text-gray-500 mt-0.5">Planifiez une activité pour une paroisse de votre district</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">

          {/* Paroisse */}
          <div>
            <label className={CLS_LABEL}>Paroisse <span className="text-red-500">*</span></label>
            <select
              value={paroisseId}
              onChange={(e) => { setParoisseId(e.target.value); setErreursChamps((p) => ({ ...p, paroisseId: undefined })) }}
              className={erreursChamps.paroisseId ? CLS_INPUT_ERR : CLS_SELECT}
            >
              <option value="">Sélectionner une paroisse…</option>
              {paroisses.map((p) => (
                <option key={p.id} value={p.id}>{p.nom} — {p.ville}</option>
              ))}
            </select>
            {erreursChamps.paroisseId && <p className="mt-1 text-xs text-red-600">{erreursChamps.paroisseId}</p>}
          </div>

          {/* Titre */}
          <div>
            <label className={CLS_LABEL}>Titre <span className="text-red-500">*</span></label>
            <input type="text" value={titre} onChange={(e) => { setTitre(e.target.value); setErreursChamps((p) => ({ ...p, titre: undefined })) }}
              placeholder="Ex. Réunion hebdomadaire Louveteaux"
              className={erreursChamps.titre ? CLS_INPUT_ERR : CLS_INPUT} />
            {erreursChamps.titre && <p className="mt-1 text-xs text-red-600">{erreursChamps.titre}</p>}
          </div>

          {/* Type */}
          <div>
            <label className={CLS_LABEL}>Type <span className="text-red-500">*</span></label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={CLS_SELECT}>
              {Object.entries(LABELS_TYPE_ACTIVITE).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Date de début <span className="text-red-500">*</span></label>
              <input type="datetime-local" value={dateDebut}
                onChange={(e) => { setDateDebut(e.target.value); setErreursChamps((p) => ({ ...p, dateDebut: undefined })) }}
                className={erreursChamps.dateDebut ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreursChamps.dateDebut && <p className="mt-1 text-xs text-red-600">{erreursChamps.dateDebut}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Date de fin <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
              <input type="datetime-local" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={CLS_INPUT} />
            </div>
          </div>

          {/* Lieu */}
          <div>
            <label className={CLS_LABEL}>Lieu <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
            <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)}
              placeholder="Ex. Salle paroissiale Saint-Paul" className={CLS_INPUT} />
          </div>

          {/* Description */}
          <div>
            <label className={CLS_LABEL}>Description <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails supplémentaires sur l'activité…" rows={3} className={CLS_TEXTAREA} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={soumission}
              className="sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#15392a] transition-colors text-sm font-medium disabled:opacity-60">
              {soumission ? 'Création…' : "Créer l'activité"}
            </button>
            <Link href="/district/ma-branche"
              className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
