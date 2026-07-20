'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { LABELS_BRANCHES, ORDRE_BRANCHES } from '@/lib/branches'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

const BRANCHES = [
  { value: '', label: 'Programme du groupe' },
  ...ORDRE_BRANCHES.map((branche) => ({ value: branche, label: LABELS_BRANCHES[branche] })),
]

const ROLES_BRANCHE = ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']

export default function PageNouveauProgramme() {
  const router = useRouter()
  const { data: session } = useSession()
  const estBranche = ROLES_BRANCHE.includes(session?.user?.role ?? '')

  const [brancheVerrouillee, setBrancheVerrouillee] = useState<string | null>(null)
  const [brancheType, setBrancheType] = useState('')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [periodeDebut, setPeriodeDebut] = useState('')
  const [periodeFin, setPeriodeFin] = useState('')
  const [soumission, setSoumission] = useState(false)

  useEffect(() => {
    if (!estBranche) return
    fetch('/api/me/branche').then((r) => r.json()).then((data) => {
      if (data?.brancheType) {
        setBrancheVerrouillee(data.brancheType)
        setBrancheType(data.brancheType)
      }
    })
  }, [estBranche])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titre || !periodeDebut || !periodeFin) { toast.error('Le titre et la période sont obligatoires'); return }
    if (new Date(periodeFin) <= new Date(periodeDebut)) { toast.error('La date de fin doit être après la date de début'); return }

    const ok = await confirmer({
      titre: 'Créer ce programme ?',
      description: `Le programme "${titre}" sera créé pour la période du ${periodeDebut} au ${periodeFin}.`,
      labelConfirmer: 'Créer',
    })
    if (!ok) return

    setSoumission(true)
    try {
      const res = await fetch('/api/programmes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre,
          description: description || null,
          periodeDebut: new Date(periodeDebut).toISOString(),
          periodeFin: new Date(periodeFin).toISOString(),
          brancheType: brancheType || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      router.push(`/dashboard/programmes/${data.id}`)
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/programmes" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouveau programme</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Portée</label>
              {brancheVerrouillee ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700 font-medium">
                    {BRANCHES.find((b) => b.value === brancheVerrouillee)?.label ?? brancheVerrouillee}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">Votre branche</span>
                </div>
              ) : (
                <select value={brancheType} onChange={(e) => setBrancheType(e.target.value)} className={CLS_SELECT}>
                  {BRANCHES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className={CLS_LABEL}>Titre <span className="text-red-500">*</span></label>
              <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Programme annuel 2026" className={CLS_INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Début de période <span className="text-red-500">*</span></label>
              <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} className={CLS_INPUT} />
            </div>
            <div>
              <label className={CLS_LABEL}>Fin de période <span className="text-red-500">*</span></label>
              <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} className={CLS_INPUT} />
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>Description / objectifs <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Objectifs pédagogiques généraux de ce programme…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] resize-none" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={soumission}
              className="sm:flex-none bg-[#1a4731] text-white px-6 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
              {soumission ? 'Création…' : 'Créer le programme'}
            </button>
            <Link href="/dashboard/programmes"
              className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
