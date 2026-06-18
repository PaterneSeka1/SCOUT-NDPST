'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useScout, useModifierScout } from '@/hooks/useScouts'
import { LABELS_BRANCHES } from '@/lib/branches'

const BRANCHES = Object.keys(LABELS_BRANCHES)

export default function ModifierScoutPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: scout, isLoading } = useScout(id)
  const { mutateAsync: modifierScout, isPending } = useModifierScout(id)

  const [form, setForm] = useState({ nom: '', prenom: '', dateNaissance: '', sexe: '', brancheType: '' })
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')

  useEffect(() => {
    if (scout) {
      setForm({
        nom: scout.nom,
        prenom: scout.prenom,
        dateNaissance: scout.dateNaissance.split('T')[0],
        sexe: scout.sexe,
        brancheType: scout.brancheType,
      })
    }
  }, [scout])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setSucces('')
    try {
      await modifierScout(form)
      setSucces('Modifications enregistrées.')
      setTimeout(() => router.push(`/dashboard/scouts/${id}`), 1200)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/scouts/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Retour à la fiche
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Modifier le scout</h1>

      {succes && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">{succes}</div>}
      {erreur && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{erreur}</div>}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
              <input name="nom" type="text" value={form.nom} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom <span className="text-red-500">*</span></label>
              <input name="prenom" type="text" value={form.prenom} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance <span className="text-red-500">*</span></label>
            <input name="dateNaissance" type="date" value={form.dateNaissance} onChange={handleChange} required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sexe <span className="text-red-500">*</span></label>
              <select name="sexe" value={form.sexe} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]">
                <option value="">Sélectionner</option>
                <option value="MASCULIN">Garçon</option>
                <option value="FEMININ">Fille</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branche <span className="text-red-500">*</span></label>
              <select name="brancheType" value={form.brancheType} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]">
                <option value="">Sélectionner</option>
                {BRANCHES.map(b => <option key={b} value={b}>{LABELS_BRANCHES[b]}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={isPending}
              className="bg-[#1a4731] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#163d29] transition-colors disabled:opacity-60">
              {isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
            <Link href={`/dashboard/scouts/${id}`} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors">
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
