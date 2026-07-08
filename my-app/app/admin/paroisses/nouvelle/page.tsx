'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface FormParoisse {
  nom: string; ville: string; diocese: string; ocean: string; doyenne: string
  adresse: string; telephone: string; email: string
}

const VIDE: FormParoisse = { nom: '', ville: '', diocese: '', ocean: '', doyenne: '', adresse: '', telephone: '', email: '' }

export default function NouvelleParoissePage() {
  const router = useRouter()
  const [form, setForm] = useState<FormParoisse>(VIDE)
  const [soumission, setSoumission] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom.trim() || !form.ville.trim() || !form.diocese.trim()) {
      toast.error('Le nom, la ville et le diocèse sont obligatoires.')
      return
    }
    setSoumission(true)
    try {
      const res = await fetch('/api/admin/paroisses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('Paroisse créée. Vous pouvez maintenant lui désigner un Chef de Groupe.')
      router.push(`/admin/paroisses/${data.id}`)
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/admin/paroisses" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux paroisses</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">Nouvelle paroisse</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          La désignation du Chef de Groupe se fait juste après, depuis la fiche de la paroisse.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={CLS_LABEL}>Nom de la paroisse *</label>
            <input className={CLS_INPUT} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
          </div>
          <div>
            <label className={CLS_LABEL}>Ville *</label>
            <input className={CLS_INPUT} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} required />
          </div>
          <div>
            <label className={CLS_LABEL}>Diocèse *</label>
            <input className={CLS_INPUT} value={form.diocese} onChange={(e) => setForm({ ...form, diocese: e.target.value })} required />
          </div>
          <div>
            <label className={CLS_LABEL}>Doyenné</label>
            <input className={CLS_INPUT} value={form.doyenne} onChange={(e) => setForm({ ...form, doyenne: e.target.value })} />
          </div>
          <div>
            <label className={CLS_LABEL}>Océan / secteur</label>
            <input className={CLS_INPUT} value={form.ocean} onChange={(e) => setForm({ ...form, ocean: e.target.value })} />
          </div>
          <div>
            <label className={CLS_LABEL}>Téléphone</label>
            <input className={CLS_INPUT} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
          </div>
          <div>
            <label className={CLS_LABEL}>E-mail</label>
            <input type="email" className={CLS_INPUT} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={CLS_LABEL}>Adresse</label>
            <input className={CLS_INPUT} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
          <Link href="/admin/paroisses" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={soumission}
            className="rounded-lg px-6 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--cp)' }}
          >
            {soumission && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
            {soumission ? 'Création…' : 'Créer la paroisse'}
          </button>
        </div>
      </form>
    </div>
  )
}
