'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface Paroisse {
  id: string
  nom: string
  ville: string
  diocese: string
  ocean: string | null
  doyenne: string | null
  adresse: string | null
  telephone: string | null
  email: string | null
  logo: string | null
  _count: { scouts: number; utilisateurs: number; activites: number }
}

interface FormParoisse {
  nom: string; ville: string; diocese: string
  ocean: string; doyenne: string
  adresse: string; telephone: string; email: string
}

export default function PageParoisse() {
  const { data: session } = useSession()
  const estAdmin = session?.user?.role === 'ADMIN_PAROISSE'

  const [paroisse, setParoisse] = useState<Paroisse | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  const [modeEdition, setModeEdition] = useState(false)
  const [form, setForm] = useState<FormParoisse>({ nom: '', ville: '', diocese: '', adresse: '', telephone: '', email: '' })
  const [soumission, setSoumission] = useState(false)
  const [succes, setSucces] = useState(false)
  const [erreurForm, setErreurForm] = useState('')

  // Upload logo
  const [logoPreview, setLogoPreview] = useState('')
  const [uploadLogo, setUploadLogo] = useState(false)
  const [erreurLogo, setErreurLogo] = useState('')

  useEffect(() => {
    fetch('/api/paroisse')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { setErreur(data.erreur); return }
        setParoisse(data)
        setForm({ nom: data.nom, ville: data.ville, diocese: data.diocese, ocean: data.ocean ?? '', doyenne: data.doyenne ?? '', adresse: data.adresse ?? '', telephone: data.telephone ?? '', email: data.email ?? '' })
        if (data.logo) setLogoPreview(data.logo)
      })
      .catch(() => setErreur('Impossible de charger les informations de la paroisse'))
      .finally(() => setChargement(false))
  }, [])

  const handleChangeLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreurLogo('')
    setLogoPreview(URL.createObjectURL(fichier))
    setUploadLogo(true)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setErreurLogo(data.erreur ?? 'Erreur upload'); setLogoPreview(paroisse?.logo ?? ''); return }
      // Enregistre immédiatement le nouveau logo
      await fetch('/api/paroisse', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo: data.url }) })
      setParoisse((p) => p ? { ...p, logo: data.url } : p)
    } catch {
      setErreurLogo("Erreur lors de l'envoi")
      setLogoPreview(paroisse?.logo ?? '')
    } finally {
      setUploadLogo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurForm('')
    setSucces(false)
    if (!form.nom.trim() || !form.ville.trim() || !form.diocese.trim()) {
      setErreurForm('Le nom, la ville et le diocèse sont obligatoires.')
      return
    }
    setSoumission(true)
    try {
      const res = await fetch('/api/paroisse', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { setErreurForm(data.erreur ?? 'Erreur serveur'); return }
      setParoisse((p) => p ? { ...p, ...data } : data)
      setSucces(true)
      setModeEdition(false)
      setTimeout(() => setSucces(false), 3000)
    } catch {
      setErreurForm('Erreur lors de la sauvegarde')
    } finally {
      setSoumission(false)
    }
  }

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erreur) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>
  )

  if (!paroisse) return null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ma paroisse</h1>
          <p className="text-sm text-gray-500 mt-0.5">Informations et statistiques du groupe scout</p>
        </div>
        {estAdmin && !modeEdition && (
          <button onClick={() => setModeEdition(true)}
            className="flex-shrink-0 flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Modifier
          </button>
        )}
      </div>

      {succes && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">Informations mises à jour avec succès.</div>}

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Scouts', valeur: paroisse._count.scouts, couleur: 'bg-[#1a4731]' },
          { label: 'Utilisateurs', valeur: paroisse._count.utilisateurs, couleur: 'bg-[#27ae60]' },
          { label: 'Activités', valeur: paroisse._count.activites, couleur: 'bg-[#f39c12]' },
        ].map(({ label, valeur, couleur }) => (
          <div key={label} className={`${couleur} text-white rounded-xl p-4 text-center`}>
            <p className="text-2xl sm:text-3xl font-bold">{valeur}</p>
            <p className="text-xs sm:text-sm opacity-90 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Carte identité */}
      {!modeEdition ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <div className="flex items-start gap-5">
            {/* Logo */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center relative group">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">⛪</span>
                )}
                {estAdmin && (
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChangeLogo} className="sr-only" disabled={uploadLogo} />
                  </label>
                )}
              </div>
              {uploadLogo && <p className="text-xs text-gray-400 text-center mt-1">Envoi…</p>}
              {erreurLogo && <p className="text-xs text-red-500 text-center mt-1">{erreurLogo}</p>}
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-xl font-bold text-gray-900">{paroisse.nom}</p>
                <p className="text-sm text-gray-500">{paroisse.ville} · Diocèse de {paroisse.diocese}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {paroisse.ocean && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-100">
                      <span className="font-medium">Océan :</span> {paroisse.ocean}
                    </span>
                  )}
                  {paroisse.doyenne && (
                    <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full border border-purple-100">
                      <span className="font-medium">Doyenné :</span> {paroisse.doyenne}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {paroisse.adresse && (
                  <div className="flex items-start gap-2 text-gray-600">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {paroisse.adresse}
                  </div>
                )}
                {paroisse.telephone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {paroisse.telephone}
                  </div>
                )}
                {paroisse.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {paroisse.email}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Formulaire d'édition */
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Modifier les informations</h2>

            {erreurForm && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreurForm}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={CLS_LABEL}>Nom de la paroisse <span className="text-red-500">*</span></label>
                <input type="text" value={form.nom} onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
                  placeholder="Ex. Paroisse Saint-Paul" className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Ville <span className="text-red-500">*</span></label>
                <input type="text" value={form.ville} onChange={(e) => setForm((p) => ({ ...p, ville: e.target.value }))}
                  placeholder="Ex. Abidjan" className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Diocèse <span className="text-red-500">*</span></label>
                <input type="text" value={form.diocese} onChange={(e) => setForm((p) => ({ ...p, diocese: e.target.value }))}
                  placeholder="Ex. Abidjan" className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Océan <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
                <input type="text" value={form.ocean} onChange={(e) => setForm((p) => ({ ...p, ocean: e.target.value }))}
                  placeholder="Ex. Océan Atlantique Nord" className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Doyenné <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
                <input type="text" value={form.doyenne} onChange={(e) => setForm((p) => ({ ...p, doyenne: e.target.value }))}
                  placeholder="Ex. Doyenné de Cocody" className={CLS_INPUT} />
              </div>
              <div className="sm:col-span-2">
                <label className={CLS_LABEL}>Adresse <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
                <input type="text" value={form.adresse} onChange={(e) => setForm((p) => ({ ...p, adresse: e.target.value }))}
                  placeholder="Ex. Rue de l'Église, Cocody" className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Téléphone <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
                <input type="tel" value={form.telephone} onChange={(e) => setForm((p) => ({ ...p, telephone: e.target.value }))}
                  placeholder="07 00 00 00 00" className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Email <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contact@paroisse.ci" className={CLS_INPUT} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button type="submit" disabled={soumission}
                className="sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
                {soumission ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => { setModeEdition(false); setErreurForm('') }}
                className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Annuler
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
