'use client'

import Image from 'next/image'

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/session-client'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { PERIMETRE_V1 } from '@scout/shared'
import { Church } from '@/lib/icons'

const CLS_INPUT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface Paroisse {
  id: string
  nom: string
  ville: string
  diocese: string
  ocean: string | null
  district: { id: string; nom: string }
  adresse: string | null
  telephone: string | null
  email: string | null
  logo: string | null
  _count: { scouts: number; utilisateurs: number; activites: number }
}

interface Activite {
  id: string
  titre: string
  dateDebut: string
  dateFin: string | null
  lieu: string | null
  type: string
  brancheType: string | null
}

interface FormParoisse {
  nom: string
  ville: string
  diocese: string
  ocean: string
  adresse: string
  telephone: string
  email: string
}

export default function PageParoisse() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const estChefGroupe = role === 'CHEF_GROUPE'
  const estParent = role === 'PARENT'
  const voitStatsDetaillees = estChefGroupe

  const [paroisse, setParoisse] = useState<Paroisse | null>(null)
  const [activitesAVenir, setActivitesAVenir] = useState<Activite[]>([])
  const [chargement, setChargement] = useState(true)
  const [chargementErreur, setChargementErreur] = useState(false)

  const [modeEdition, setModeEdition] = useState(false)
  const [form, setForm] = useState<FormParoisse>({
    nom: '',
    ville: '',
    diocese: '',
    ocean: '',
    adresse: '',
    telephone: '',
    email: '',
  })
  const [soumission, setSoumission] = useState(false)

  const [logoPreview, setLogoPreview] = useState('')
  const [uploadLogo, setUploadLogo] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    // PARENT et SCOUT n'ont pas accès à /api/activites (réservée au staff) : on
    // évite l'appel pour eux et on affiche un renvoi vers leur propre page.
    const inclureActivites = role !== 'PARENT' && role !== 'SCOUT'
    Promise.all([
      fetch('/api/paroisse').then((r) => r.json()),
      inclureActivites ? fetch('/api/activites?page=1&limite=50').then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([paroisseData, activitesData]) => {
        if (paroisseData.erreur) {
          toast.error(paroisseData.erreur)
          setChargementErreur(true)
          return
        }
        setParoisse(paroisseData)
        setForm({
          nom: paroisseData.nom,
          ville: paroisseData.ville,
          diocese: paroisseData.diocese,
          ocean: paroisseData.ocean ?? '',
          adresse: paroisseData.adresse ?? '',
          telephone: paroisseData.telephone ?? '',
          email: paroisseData.email ?? '',
        })
        if (paroisseData.logo) setLogoPreview(paroisseData.logo)

        if (inclureActivites) {
          const maintenant = new Date()
          // L'API trie par date décroissante : on remet les activités à venir
          // dans l'ordre chronologique pour afficher les plus proches en premier.
          const aVenir = (activitesData.activites ?? [])
            .filter((a: Activite) => {
              const fin = a.dateFin ? new Date(a.dateFin) : new Date(a.dateDebut)
              return fin >= maintenant
            })
            .sort((a: Activite, b: Activite) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())
          setActivitesAVenir(aVenir)
        }
      })
      .catch(() => {
        toast.error('Impossible de charger les informations')
        setChargementErreur(true)
      })
      .finally(() => setChargement(false))
  }, [session, role])

  const handleChangeLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setLogoPreview(URL.createObjectURL(fichier))
    setUploadLogo(true)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      fd.append('visibilite', 'publique')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur upload')
        setLogoPreview(paroisse?.logo ?? '')
        return
      }
      const resLogo = await fetch('/api/paroisse', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: data.url }),
      })
      if (!resLogo.ok) {
        const erreur = await resLogo.json().catch(() => ({}))
        toast.error(erreur.erreur ?? 'Impossible d’enregistrer le logo')
        setLogoPreview(paroisse?.logo ?? '')
        return
      }
      setParoisse((p) => (p ? { ...p, logo: data.url } : p))
      setLogoPreview(data.url)
    } catch {
      toast.error("Erreur lors de l'envoi du logo")
      setLogoPreview(paroisse?.logo ?? '')
    } finally {
      setUploadLogo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom.trim() || !form.ville.trim() || !form.diocese.trim()) {
      toast.error('Le nom, la ville et le diocèse sont obligatoires.')
      return
    }
    setSoumission(true)
    try {
      const res = await fetch('/api/paroisse', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      setParoisse((p) => (p ? { ...p, ...data } : data))
      toast.success('Informations mises à jour avec succès.')
      setModeEdition(false)
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSoumission(false)
    }
  }

  if (chargement)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )

  if (chargementErreur) return null
  if (!paroisse) return null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Ma paroisse</h1>
          <p className="mt-0.5 text-sm text-gray-500">Informations du groupe scout</p>
        </div>
        {estChefGroupe && !modeEdition && (
          <button
            onClick={() => setModeEdition(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Modifier
          </button>
        )}
      </div>

      {/* Statistiques */}
      {!estParent && (
        <div className={`grid gap-3 ${voitStatsDetaillees ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
          {voitStatsDetaillees && (
            <>
              <div className="rounded-xl bg-(--cp) p-4 text-center text-white">
                <p className="text-2xl font-bold sm:text-3xl">{paroisse._count.scouts}</p>
                <p className="mt-0.5 text-xs opacity-90 sm:text-sm">Scouts</p>
              </div>
              <div className="rounded-xl bg-(--ca) p-4 text-center text-white">
                <p className="text-2xl font-bold sm:text-3xl">{paroisse._count.utilisateurs}</p>
                <p className="mt-0.5 text-xs opacity-90 sm:text-sm">Utilisateurs</p>
              </div>
            </>
          )}
          <div className="rounded-xl bg-(--ca) p-4 text-center text-white">
            <p className="text-2xl font-bold sm:text-3xl">{paroisse._count.activites}</p>
            <p className="mt-0.5 text-xs opacity-90 sm:text-sm">Activités</p>
          </div>
        </div>
      )}

      {/* Carte identité */}
      {!modeEdition ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-5">
            <div className="shrink-0">
              <div className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 sm:h-24 sm:w-24">
                {logoPreview ? (
                  <Image
                    width={96}
                    height={96}
                    unoptimized
                    src={logoPreview}
                    alt="Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Church className="h-9 w-9 text-gray-300" strokeWidth={2} />
                )}
                {estChefGroupe && (
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleChangeLogo}
                      className="sr-only"
                      disabled={uploadLogo}
                    />
                  </label>
                )}
              </div>
              {uploadLogo && <p className="mt-1 text-center text-xs text-gray-400">Envoi…</p>}
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xl font-bold text-gray-900">{paroisse.nom}</p>
                <p className="text-sm text-gray-500">
                  {paroisse.ville} · Diocèse de {paroisse.diocese}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {paroisse.ocean && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                      <span className="font-medium">Océan :</span> {paroisse.ocean}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                    <span className="font-medium">District :</span> {paroisse.district.nom}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {paroisse.adresse && (
                  <div className="flex items-start gap-2 text-gray-600">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {paroisse.adresse}
                  </div>
                )}
                {paroisse.telephone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="h-4 w-4 shrink-0 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    {paroisse.telephone}
                  </div>
                )}
                {paroisse.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="h-4 w-4 shrink-0 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    {paroisse.email}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="border-b border-gray-100 pb-3 text-sm font-semibold text-gray-800">
              Modifier les informations
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={CLS_LABEL}>
                  Nom de la paroisse <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
                  placeholder="Ex. Paroisse Saint-Paul"
                  className={CLS_INPUT}
                />
              </div>
              <div>
                <label className={CLS_LABEL}>
                  Ville <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.ville}
                  onChange={(e) => setForm((p) => ({ ...p, ville: e.target.value }))}
                  placeholder="Ex. Abidjan"
                  className={CLS_INPUT}
                />
              </div>
              <div>
                <label className={CLS_LABEL}>
                  Diocèse <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.diocese}
                  onChange={(e) => setForm((p) => ({ ...p, diocese: e.target.value }))}
                  placeholder="Ex. Abidjan"
                  className={CLS_INPUT}
                />
              </div>
              <div>
                <label className={CLS_LABEL}>
                  Océan <span className="text-xs font-normal text-gray-400">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={form.ocean}
                  onChange={(e) => setForm((p) => ({ ...p, ocean: e.target.value }))}
                  placeholder="Ex. Océan Atlantique Nord"
                  className={CLS_INPUT}
                />
              </div>
              <div>
                <label className={CLS_LABEL}>District</label>
                <p className={`${CLS_INPUT} bg-gray-50 text-gray-500`}>{paroisse?.district.nom ?? '—'}</p>
                <p className="mt-1 text-xs text-gray-400">
                  Modifiable uniquement par l&apos;administrateur plateforme.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={CLS_LABEL}>
                  Adresse <span className="text-xs font-normal text-gray-400">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={form.adresse}
                  onChange={(e) => setForm((p) => ({ ...p, adresse: e.target.value }))}
                  placeholder="Ex. Rue de l'Église, Cocody"
                  className={CLS_INPUT}
                />
              </div>
              <div>
                <label className={CLS_LABEL}>
                  Téléphone <span className="text-xs font-normal text-gray-400">(optionnel)</span>
                </label>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setForm((p) => ({ ...p, telephone: e.target.value }))}
                  placeholder="07 00 00 00 00"
                  className={CLS_INPUT}
                />
              </div>
              <div>
                <label className={CLS_LABEL}>
                  Email <span className="text-xs font-normal text-gray-400">(optionnel)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contact@paroisse.ci"
                  className={CLS_INPUT}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={soumission}
                className="rounded-lg bg-(--cp) px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60 sm:flex-none"
              >
                {soumission ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => setModeEdition(false)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Activités à venir — visible pour tous les rôles */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Prochaines activités</h2>
        {PERIMETRE_V1 && (estParent || role === 'SCOUT') ? (
          // Espaces parent et scout hors périmètre V1 : pas de renvoi vers leurs pages.
          <p className="py-4 text-center text-sm text-gray-500">
            Les prochaines activités vous sont communiquées par l’encadrement de votre branche.
          </p>
        ) : estParent ? (
          <p className="py-4 text-center text-sm text-gray-500">
            Consultez les prochaines activités de vos enfants depuis{' '}
            <Link href="/dashboard/mes-enfants" className="font-medium text-(--cp) hover:underline">
              Mes enfants
            </Link>
            .
          </p>
        ) : role === 'SCOUT' ? (
          <p className="py-4 text-center text-sm text-gray-500">
            Consultez vos prochaines activités depuis{' '}
            <Link href="/dashboard/ma-progression" className="font-medium text-(--cp) hover:underline">
              Ma progression
            </Link>
            .
          </p>
        ) : activitesAVenir.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 italic">Aucune activité à venir pour le moment</p>
        ) : (
          <div className="space-y-3">
            {activitesAVenir.map((a) => {
              const debut = new Date(a.dateDebut)
              return (
                <div key={a.id} className="flex items-center gap-4 border-b border-gray-50 py-2 last:border-0">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-(--cp)/10">
                    <span className="text-xs leading-none font-bold text-(--cp)">
                      {debut.toLocaleDateString('fr-FR', { day: '2-digit' })}
                    </span>
                    <span className="mt-0.5 text-xs leading-none text-(--cp)/70">
                      {debut.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{a.titre}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {LABELS_TYPE_ACTIVITE[a.type] ?? a.type}
                      {a.lieu ? ` · ${a.lieu}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-(--cp)/10 px-2 py-0.5 text-xs font-medium text-(--cp)">
                    {debut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
