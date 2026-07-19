'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useActivite, useModifierActivite } from '@/hooks/useActivites'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_BRANCHES } from '@/lib/branches'
import { useGardeModifications } from '@/hooks/useGardeModifications'
import { CompteurCaracteres } from '@/app/components/CompteurCaracteres'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_TEXTAREA = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent resize-none'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

export default function PageModifierActivite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: activite, isLoading } = useActivite(id)
  const modifierActivite = useModifierActivite(id)

  const [titre, setTitre] = useState('')
  const [type, setType] = useState('REUNION')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [lieu, setLieu] = useState('')
  const [brancheType, setBrancheType] = useState('')
  const [description, setDescription] = useState('')

  const etatFormulaire = { titre, type, dateDebut, dateFin, lieu, brancheType, description }
  const { estModifie, definirReference, partirVers } = useGardeModifications(etatFormulaire)

  useEffect(() => {
    if (activite) {
      const donnees = {
        titre: activite.titre ?? '',
        type: activite.type ?? 'REUNION',
        dateDebut: activite.dateDebut ? activite.dateDebut.slice(0, 16) : '',
        dateFin: activite.dateFin ? activite.dateFin.slice(0, 16) : '',
        lieu: activite.lieu ?? '',
        brancheType: activite.brancheType ?? '',
        description: activite.description ?? '',
      }
      setTitre(donnees.titre)
      setType(donnees.type)
      setDateDebut(donnees.dateDebut)
      setDateFin(donnees.dateFin)
      setLieu(donnees.lieu)
      setBrancheType(donnees.brancheType)
      setDescription(donnees.description)
      definirReference(donnees)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activite])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || !dateDebut) {
      toast.error('Le titre et la date de début sont obligatoires.')
      return
    }
    try {
      await modifierActivite.mutateAsync({
        titre: titre.trim(),
        description: description.trim() || undefined,
        dateDebut,
        dateFin: dateFin || undefined,
        lieu: lieu.trim() || undefined,
        type,
        brancheType: brancheType || undefined,
      })
      definirReference(etatFormulaire)
      toast.success('Activité mise à jour.')
      router.push(`/dashboard/activites/${id}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!activite) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">Activité introuvable.</div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 sm:px-0">
      <button type="button" onClick={() => partirVers(`/dashboard/activites/${id}`)} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à l&apos;activité
      </button>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Modifier l&apos;activité</h1>
        <p className="text-sm text-gray-500 mt-0.5 truncate">{activite.titre}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">

          {/* Titre */}
          <div>
            <label className={CLS_LABEL}>Titre <span className="text-red-500">*</span></label>
            <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre de l'activité" className={CLS_INPUT} required />
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
              <select value={brancheType} onChange={(e) => setBrancheType(e.target.value)} className={CLS_SELECT}>
                <option value="">Toutes les branches</option>
                {Object.entries(LABELS_BRANCHES).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Date de début <span className="text-red-500">*</span></label>
              <input type="datetime-local" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={CLS_INPUT} required />
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
              placeholder="Détails supplémentaires…" rows={3} className={CLS_TEXTAREA} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={modifierActivite.isPending || !estModifie}
              className="w-full sm:w-auto sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#15392a] transition-colors text-sm font-medium disabled:opacity-60">
              {modifierActivite.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
            <button type="button" onClick={() => partirVers(`/dashboard/activites/${id}`)}
              className="inline-flex w-full items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:w-auto">
              Annuler
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
