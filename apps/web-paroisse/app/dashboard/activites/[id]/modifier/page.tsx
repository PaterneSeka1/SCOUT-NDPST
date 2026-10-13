'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useActivite, useModifierActivite, type Activite } from '@/hooks/useActivites'
import { LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { LABELS_BRANCHES } from '@scout/shared'
import { BackLink } from '@/app/components/ui/BackLink'

const CLS_INPUT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_TEXTAREA =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent resize-none'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

export default function PageModifierActivite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: activite, isLoading } = useActivite(id)

  if (isLoading)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )

  if (!activite)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Activité introuvable.
      </div>
    )

  return <FormulaireActivite key={id} id={id} activite={activite} />
}

function FormulaireActivite({ id, activite }: { id: string; activite: Activite }) {
  const router = useRouter()
  const modifierActivite = useModifierActivite(id)

  const [titre, setTitre] = useState(activite.titre ?? '')
  const [type, setType] = useState(activite.type ?? 'REUNION')
  const [dateDebut, setDateDebut] = useState(activite.dateDebut ? activite.dateDebut.slice(0, 16) : '')
  const [dateFin, setDateFin] = useState(activite.dateFin ? activite.dateFin.slice(0, 16) : '')
  const [lieu, setLieu] = useState(activite.lieu ?? '')
  const [brancheType, setBrancheType] = useState(activite.brancheType ?? '')
  const [description, setDescription] = useState(activite.description ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || !dateDebut) {
      toast.error('Le titre et la date de début sont obligatoires.')
      return
    }
    try {
      await modifierActivite.mutateAsync({
        titre: titre.trim(),
        // Champs optionnels vidés : null (ou chaîne vide) pour que l'API les
        // efface — undefined signifierait « inchangé ».
        description: description.trim() || null,
        dateDebut,
        // PUT /api/activites/[id] refuse dateFin: null (contrôle typeof
        // string) mais traite la chaîne vide comme un effacement.
        dateFin: dateFin || '',
        lieu: lieu.trim() || null,
        type,
        brancheType: brancheType || null,
      })
      toast.success('Activité mise à jour.')
      router.push(`/dashboard/activites/${id}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 sm:px-0">
      <BackLink href={`/dashboard/activites/${id}`}>Retour à l&apos;activité</BackLink>

      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Modifier l&apos;activité</h1>
        <p className="mt-0.5 truncate text-sm text-gray-500">{activite.titre}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          {/* Titre */}
          <div>
            <label className={CLS_LABEL}>
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre de l'activité"
              className={CLS_INPUT}
              required
            />
          </div>

          {/* Type + Branche */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Type <span className="text-red-500">*</span>
              </label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={CLS_SELECT}>
                {Object.entries(LABELS_TYPE_ACTIVITE).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>
                Branche <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <select value={brancheType} onChange={(e) => setBrancheType(e.target.value)} className={CLS_SELECT}>
                <option value="">Toutes les branches</option>
                {Object.entries(LABELS_BRANCHES).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Date de début <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className={CLS_INPUT}
                required
              />
            </div>
            <div>
              <label className={CLS_LABEL}>
                Date de fin <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <input
                type="datetime-local"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className={CLS_INPUT}
              />
            </div>
          </div>

          {/* Lieu */}
          <div>
            <label className={CLS_LABEL}>
              Lieu <span className="text-xs font-normal text-gray-400">(optionnel)</span>
            </label>
            <input
              type="text"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="Ex. Salle paroissiale Saint-Paul"
              className={CLS_INPUT}
            />
          </div>

          {/* Description */}
          <div>
            <label className={CLS_LABEL}>
              Description <span className="text-xs font-normal text-gray-400">(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails supplémentaires…"
              rows={3}
              className={CLS_TEXTAREA}
            />
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={modifierActivite.isPending}
              className="w-full rounded-lg bg-(--cp) px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60 sm:w-auto sm:flex-none"
            >
              {modifierActivite.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
            <Link
              href={`/dashboard/activites/${id}`}
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
            >
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
