'use client'

import Image from 'next/image'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useScout, useModifierScout, type Scout } from '@/hooks/useScouts'
import { LABELS_BRANCHES } from '@scout/shared'
import { BackLink } from '@/app/components/ui/BackLink'

const BRANCHES = Object.keys(LABELS_BRANCHES)

const CLS_INPUT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

export default function ModifierScoutPage() {
  const { id } = useParams<{ id: string }>()
  const { data: scout, isLoading } = useScout(id)

  if (isLoading)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )

  if (!scout) return <div className="text-sm text-red-700">Scout introuvable.</div>

  return <FormulaireScout key={id} id={id} scout={scout} />
}

function FormulaireScout({ id, scout }: { id: string; scout: Scout }) {
  const router = useRouter()
  const { mutateAsync, isPending } = useModifierScout(id)

  const [form, setForm] = useState({
    nom: scout.nom,
    prenom: scout.prenom,
    dateNaissance: scout.dateNaissance.split('T')[0],
    sexe: scout.sexe,
    brancheType: scout.brancheType,
    allergies: scout.allergies ?? '',
    traitementsMedicaux: scout.traitementsMedicaux ?? '',
  })
  const [photo, setPhoto] = useState<string | null>(scout.photo)
  const [photoPreview, setPhotoPreview] = useState(scout.photo ?? '')
  const [consentementImage, setConsentementImage] = useState(scout.consentementImage)
  const [uploadEnCours, setUploadEnCours] = useState(false)

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
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur upload')
        setPhotoPreview(scout?.photo ?? '')
        return
      }
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 sm:px-0">
      <BackLink href={`/dashboard/scouts/${id}`}>Retour à la fiche</BackLink>

      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Modifier le scout</h1>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="border-b border-gray-100 pb-3 text-sm font-semibold text-gray-800">Informations du scout</h2>

          {/* Photo */}
          <div>
            <label className={CLS_LABEL}>
              Photo <span className="text-xs font-normal text-gray-400">(optionnel)</span>
            </label>
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                {photoPreview ? (
                  <Image
                    width={80}
                    height={80}
                    unoptimized
                    src={photoPreview}
                    alt="Aperçu"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {uploadEnCours ? 'Envoi…' : photoPreview ? 'Changer la photo' : 'Choisir une photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhoto}
                    className="sr-only"
                    disabled={uploadEnCours}
                  />
                </label>
                <p className="mt-1.5 text-xs text-gray-400">JPEG, PNG, WebP · Max 5 Mo</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                name="nom"
                type="text"
                value={form.nom}
                onChange={handleChange}
                required
                placeholder="Nom de famille"
                className={CLS_INPUT}
              />
            </div>
            <div>
              <label className={CLS_LABEL}>
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                name="prenom"
                type="text"
                value={form.prenom}
                onChange={handleChange}
                required
                placeholder="Prénom"
                className={CLS_INPUT}
              />
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>
              Date de naissance <span className="text-red-500">*</span>
            </label>
            <input
              name="dateNaissance"
              type="date"
              value={form.dateNaissance}
              onChange={handleChange}
              required
              className={CLS_INPUT}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Sexe <span className="text-red-500">*</span>
              </label>
              <select name="sexe" value={form.sexe} onChange={handleChange} required className={CLS_SELECT}>
                <option value="">Sélectionner</option>
                <option value="MASCULIN">Garçon</option>
                <option value="FEMININ">Fille</option>
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>
                Branche <span className="text-red-500">*</span>
              </label>
              <select
                name="brancheType"
                value={form.brancheType}
                onChange={handleChange}
                required
                className={CLS_SELECT}
              >
                <option value="">Sélectionner une branche</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {LABELS_BRANCHES[b]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Allergies <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <textarea
                name="allergies"
                value={form.allergies}
                onChange={handleChange}
                rows={2}
                placeholder="Ex : arachides, pénicilline…"
                className={CLS_INPUT}
              />
            </div>
            <div>
              <label className={CLS_LABEL}>
                Traitements en cours <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <textarea
                name="traitementsMedicaux"
                value={form.traitementsMedicaux}
                onChange={handleChange}
                rows={2}
                placeholder="Ex : inhalateur pour asthme, à prendre matin et soir"
                className={CLS_INPUT}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 border-t border-gray-100 pt-4">
            <input
              type="checkbox"
              checked={consentementImage}
              onChange={(e) => setConsentementImage(e.target.checked)}
              className="h-4 w-4 rounded accent-(--cp)"
            />
            <span className="text-sm text-gray-700">
              Droit à l&apos;image accordé (photo utilisable dans l&apos;application et les communications de la
              paroisse)
            </span>
          </label>
          {scout?.consentementImageDate && (
            <p className="-mt-2 text-xs text-gray-400">
              Dernière confirmation le {new Date(scout.consentementImageDate).toLocaleDateString('fr-FR')}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={isPending || uploadEnCours}
              className="w-full rounded-lg bg-(--cp) px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60 sm:w-auto sm:flex-none"
            >
              {isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
            <Link
              href={`/dashboard/scouts/${id}`}
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
