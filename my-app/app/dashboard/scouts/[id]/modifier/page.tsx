'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useScout, useModifierScout } from '@/hooks/useScouts'
import { LABELS_BRANCHES } from '@/lib/branches'
import { BackLink } from '@/app/components/ui/BackLink'

const BRANCHES = Object.keys(LABELS_BRANCHES)

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] focus:border-transparent'
const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

export default function ModifierScoutPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: scout, isLoading } = useScout(id)
  const { mutateAsync, isPending } = useModifierScout(id)

  const [form, setForm] = useState({ nom: '', prenom: '', dateNaissance: '', sexe: '', brancheType: '', allergies: '', traitementsMedicaux: '' })
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [consentementImage, setConsentementImage] = useState(false)
  const [uploadEnCours, setUploadEnCours] = useState(false)

  useEffect(() => {
    if (scout) {
      setForm({
        nom: scout.nom,
        prenom: scout.prenom,
        dateNaissance: scout.dateNaissance.split('T')[0],
        sexe: scout.sexe,
        brancheType: scout.brancheType,
        allergies: scout.allergies ?? '',
        traitementsMedicaux: scout.traitementsMedicaux ?? '',
      })
      if (scout.photo) {
        setPhoto(scout.photo)
        setPhotoPreview(scout.photo)
      }
      setConsentementImage(scout.consentementImage)
    }
  }, [scout])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setPhotoPreview(URL.createObjectURL(fichier))
    setUploadEnCours(true)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur upload'); setPhotoPreview(scout?.photo ?? ''); return }
      setPhoto(data.url)
      toast.success('Photo téléversée.')
    } catch {
      toast.error("Erreur lors de l'envoi du fichier")
      setPhotoPreview(scout?.photo ?? '')
    } finally {
      setUploadEnCours(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutateAsync({ ...form, photo: photo ?? undefined, consentementImage })
      toast.success('Modifications enregistrées.')
      router.push(`/dashboard/scouts/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[var(--cp)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 sm:px-0">
      <BackLink href={`/dashboard/scouts/${id}`}>Retour à la fiche</BackLink>

      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Modifier le scout</h1>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Informations du scout</h2>

          {/* Photo */}
          <div>
            <label className={CLS_LABEL}>Photo <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <label className="cursor-pointer inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {uploadEnCours ? 'Envoi…' : photoPreview ? 'Changer la photo' : 'Choisir une photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhoto} className="sr-only" disabled={uploadEnCours} />
                </label>
                <p className="mt-1.5 text-xs text-gray-400">JPEG, PNG, WebP · Max 5 Mo</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Nom <span className="text-red-500">*</span></label>
              <input name="nom" type="text" value={form.nom} onChange={handleChange} required placeholder="Nom de famille" className={CLS_INPUT} />
            </div>
            <div>
              <label className={CLS_LABEL}>Prénom <span className="text-red-500">*</span></label>
              <input name="prenom" type="text" value={form.prenom} onChange={handleChange} required placeholder="Prénom" className={CLS_INPUT} />
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>Date de naissance <span className="text-red-500">*</span></label>
            <input name="dateNaissance" type="date" value={form.dateNaissance} onChange={handleChange} required className={CLS_INPUT} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Sexe <span className="text-red-500">*</span></label>
              <select name="sexe" value={form.sexe} onChange={handleChange} required className={CLS_SELECT}>
                <option value="">Sélectionner</option>
                <option value="MASCULIN">Garçon</option>
                <option value="FEMININ">Fille</option>
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Branche <span className="text-red-500">*</span></label>
              <select name="brancheType" value={form.brancheType} onChange={handleChange} required className={CLS_SELECT}>
                <option value="">Sélectionner une branche</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{LABELS_BRANCHES[b]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <label className={CLS_LABEL}>Allergies <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
              <textarea name="allergies" value={form.allergies} onChange={handleChange} rows={2}
                placeholder="Ex : arachides, pénicilline…" className={CLS_INPUT} />
            </div>
            <div>
              <label className={CLS_LABEL}>Traitements en cours <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
              <textarea name="traitementsMedicaux" value={form.traitementsMedicaux} onChange={handleChange} rows={2}
                placeholder="Ex : inhalateur pour asthme, à prendre matin et soir" className={CLS_INPUT} />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer border-t border-gray-100 pt-4">
            <input type="checkbox" checked={consentementImage} onChange={(e) => setConsentementImage(e.target.checked)}
              className="w-4 h-4 accent-[var(--cp)] rounded" />
            <span className="text-sm text-gray-700">
              Droit à l&apos;image accordé (photo utilisable dans l&apos;application et les communications de la paroisse)
            </span>
          </label>
          {scout?.consentementImageDate && (
            <p className="text-xs text-gray-400 -mt-2">
              Dernière confirmation le {new Date(scout.consentementImageDate).toLocaleDateString('fr-FR')}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={isPending || uploadEnCours}
              className="w-full sm:w-auto sm:flex-none bg-[var(--cp)] text-white px-5 py-2.5 rounded-lg hover:brightness-110 transition-all text-sm font-medium disabled:opacity-60">
              {isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
            <Link href={`/dashboard/scouts/${id}`}
              className="inline-flex w-full items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:w-auto">
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
