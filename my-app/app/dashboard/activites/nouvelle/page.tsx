'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { useCreerActivite } from '@/hooks/useActivites'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_BRANCHES } from '@/lib/branches'
import { ROLES_BRANCHE } from '@/lib/roles'
import { useGardeModifications } from '@/hooks/useGardeModifications'
import { CompteurCaracteres } from '@/app/components/CompteurCaracteres'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_TEXTAREA = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent resize-none'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

export default function PageNouvelleActivite() {
  const router = useRouter()
  const { data: session } = useSession()
  const creerActivite = useCreerActivite()
  const estBranche = ROLES_BRANCHE.includes(session?.user?.role ?? '')

  const [titre, setTitre] = useState('')
  const [type, setType] = useState('REUNION')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [lieu, setLieu] = useState('')
  const [brancheVerrouillee, setBrancheVerrouillee] = useState<string | null>(null)
  const [brancheType, setBrancheType] = useState('')
  const [description, setDescription] = useState('')
  const [erreursChamps, setErreursChamps] = useState<{ titre?: string; dateDebut?: string }>({})

  const etatFormulaire = { titre, type, dateDebut, dateFin, lieu, brancheType, description }
  const { estModifie, definirReference, partirVers } = useGardeModifications(etatFormulaire)
  const etatInitialRef = useRef(etatFormulaire)

  useEffect(() => {
    definirReference(etatInitialRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!estBranche) return
    fetch('/api/me/branche')
      .then((r) => r.json())
      .then((data) => {
        if (data?.brancheType) {
          setBrancheVerrouillee(data.brancheType)
          setBrancheType(data.brancheType)
        }
      })
      .catch(() => toast.error('Impossible de charger votre branche.'))
  }, [estBranche])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: { titre?: string; dateDebut?: string } = {}
    if (!titre.trim()) errs.titre = 'Le titre est requis'
    if (!dateDebut) errs.dateDebut = 'La date de début est requise'
    if (Object.keys(errs).length) { setErreursChamps(errs); return }
    setErreursChamps({})

    try {
      await creerActivite.mutateAsync({
        titre: titre.trim(),
        description: description.trim() || undefined,
        dateDebut,
        dateFin: dateFin || undefined,
        lieu: lieu.trim() || undefined,
        type,
        brancheType: brancheType || undefined,
      })
      definirReference(etatFormulaire)
      router.push('/dashboard/activites')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => partirVers('/dashboard/activites')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour aux activités
      </button>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouvelle activité</h1>
        <p className="text-sm text-gray-500 mt-0.5">Planifiez une nouvelle activité pour votre groupe</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">

          {/* Titre */}
          <div>
            <label className={CLS_LABEL}>Titre <span className="text-red-500">*</span></label>
            <input type="text" value={titre} onChange={(e) => { setTitre(e.target.value); setErreursChamps((p) => ({ ...p, titre: undefined })) }}
              placeholder="Ex. Réunion hebdomadaire Louveteaux"
              className={erreursChamps.titre ? CLS_INPUT_ERR : CLS_INPUT} />
            {erreursChamps.titre && <p className="mt-1 text-xs text-red-600">{erreursChamps.titre}</p>}
          </div>

          {/* Type + Branche */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Type <span className="text-red-500">*</span></label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={CLS_SELECT}>
                {Object.entries(LABELS_TYPE_ACTIVITE).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Branche <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
              {estBranche ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700 font-medium">
                    {brancheVerrouillee ? LABELS_BRANCHES[brancheVerrouillee] ?? brancheVerrouillee : 'Chargement de votre branche…'}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">Votre branche</span>
                </div>
              ) : (
                <select value={brancheType} onChange={(e) => setBrancheType(e.target.value)} className={CLS_SELECT}>
                  <option value="">Toutes les branches</option>
                  {Object.entries(LABELS_BRANCHES).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              )}
            </div>
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
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
              <span>Description <span className="text-xs text-gray-400 font-normal">(optionnel)</span></span>
              <CompteurCaracteres valeur={description} max={500} />
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails supplémentaires sur l'activité…" rows={3} className={CLS_TEXTAREA} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={creerActivite.isPending || !estModifie}
              className="sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#15392a] transition-colors text-sm font-medium disabled:opacity-60">
              {creerActivite.isPending ? 'Création…' : "Créer l'activité"}
            </button>
            <button type="button" onClick={() => partirVers('/dashboard/activites')}
              className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              Annuler
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
