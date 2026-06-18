'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useActivite, useModifierActivite } from '@/hooks/useActivites'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_BRANCHES } from '@/lib/branches'

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
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (activite) {
      setTitre(activite.titre ?? '')
      setType(activite.type ?? 'REUNION')
      setDateDebut(activite.dateDebut ? activite.dateDebut.slice(0, 16) : '')
      setDateFin(activite.dateFin ? activite.dateFin.slice(0, 16) : '')
      setLieu(activite.lieu ?? '')
      setBrancheType(activite.brancheType ?? '')
      setDescription(activite.description ?? '')
    }
  }, [activite])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')

    if (!titre.trim() || !dateDebut) {
      setErreur('Le titre et la date de début sont obligatoires.')
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
      router.push(`/dashboard/activites/${id}`)
    } catch (err) {
      setErreur((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-gray-500">
        Chargement de l'activité...
      </div>
    )
  }

  if (!activite) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-red-600">
        Activité introuvable
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/activites/${id}`}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modifier l'activité</h1>
          <p className="text-sm text-gray-500 mt-1">{activite.titre}</p>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {erreur && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {erreur}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          >
            {Object.entries(LABELS_TYPE_ACTIVITE).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de début <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input
              type="datetime-local"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
          <input
            type="text"
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branche</label>
          <select
            value={brancheType}
            onChange={(e) => setBrancheType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          >
            <option value="">Toutes les branches (inter-branches)</option>
            {Object.entries(LABELS_BRANCHES).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731] resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={modifierActivite.isPending}
            className="flex-1 bg-[#1a4731] text-white py-2 px-4 rounded-lg hover:bg-[#15392a] disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {modifierActivite.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
          <Link
            href={`/dashboard/activites/${id}`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
