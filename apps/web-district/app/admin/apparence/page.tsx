'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { ImageOff, Upload, ExternalLink } from '@/lib/icons'

type Theme = {
  couleurPrimaire: string
  couleurAccent: string
  couleurFond: string
  couleurHover: string
}

type SiteConfig = {
  logoSite: string
  nomSite: string
  sousTitreSite: string
  theme: Theme
  hero: {
    imageUrl: string
    imageAlt: string
    badge: string
    titre: string
    sousTitre: string
  }
  stats: { value: string; label: string }[]
}

const THEME_ASCCI: Theme = {
  couleurPrimaire: '#1a4731',
  couleurAccent: '#27ae60',
  couleurFond: '#0f2418',
  couleurHover: '#27ae60',
}

const DEFAULT_CONFIG: SiteConfig = {
  logoSite: '',
  nomSite: 'SCOUT ASCCI',
  sousTitreSite: "Côte d'Ivoire",
  theme: THEME_ASCCI,
  hero: {
    imageUrl: '/scout-ascci-hero.svg',
    imageAlt: "Responsables et scouts réunis dans une cour de paroisse – ASCCI Côte d'Ivoire",
    badge: 'Suivi pédagogique paroissial',
    titre: 'SCOUT ASCCI',
    sousTitre:
      "Une application claire pour gérer les scouts catholiques de Côte d'Ivoire, suivre les activités, les présences et la progression pédagogique depuis un même espace.",
  },
  stats: [
    { value: '5', label: 'Branches suivies' },
    { value: '4', label: 'Profils principaux' },
    { value: '1', label: 'Base paroissiale' },
    { value: '100%', label: 'Historique centralisé' },
  ],
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '39, 174, 96'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

type ColorKey = keyof Theme
type ColorDef = { key: ColorKey; label: string; hint: string }

const COLORS: ColorDef[] = [
  { key: 'couleurPrimaire', label: 'Couleur primaire', hint: 'Sidebar, boutons, avatar' },
  { key: 'couleurHover', label: 'Couleur des hovers', hint: 'Liens actifs, survol menu' },
  { key: 'couleurAccent', label: "Couleur d'accentuation", hint: 'Badges, détails secondaires' },
  { key: 'couleurFond', label: 'Couleur de fond', hint: 'Arrière-plan pages auth' },
]

export default function SiteConfigPage() {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG)
  const [chargement, setChargement] = useState(true)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [uploadHero, setUploadHero] = useState(false)
  const [uploadLogo, setUploadLogo] = useState(false)
  const heroRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/site-config')
      .then((r) => {
        if (!r.ok) {
          toast.error(
            'Impossible de charger la configuration actuelle — les valeurs affichées sont des valeurs par défaut, vérifiez avant de sauvegarder.',
          )
          return null
        }
        return r.json()
      })
      .then((data: Partial<SiteConfig> | null) => {
        if (data) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...data,
            theme: { ...DEFAULT_CONFIG.theme, ...(data.theme ?? {}) },
            hero: { ...DEFAULT_CONFIG.hero, ...(data.hero ?? {}) },
            stats: data.stats ?? DEFAULT_CONFIG.stats,
          })
        }
        setChargement(false)
      })
      .catch(() => {
        toast.error(
          'Impossible de charger la configuration actuelle — les valeurs affichées sont des valeurs par défaut, vérifiez avant de sauvegarder.',
        )
        setChargement(false)
      })
  }, [])

  // Prévisualisation live des couleurs sur toute la page admin
  useEffect(() => {
    if (chargement) return
    const root = document.documentElement
    const { couleurPrimaire: cp, couleurAccent: ca, couleurFond: cf, couleurHover: ch } = config.theme
    root.style.setProperty('--cp', cp)
    root.style.setProperty('--ca', ca)
    root.style.setProperty('--cf', cf)
    root.style.setProperty('--ch', ch)
    root.style.setProperty('--cp-rgb', hexToRgb(cp))
    root.style.setProperty('--ca-rgb', hexToRgb(ca))
    root.style.setProperty('--ch-rgb', hexToRgb(ch))
  }, [config.theme, chargement])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, dest: 'hero' | 'logo') {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    if (dest === 'hero') setUploadHero(true)
    else setUploadLogo(true)
    const form = new FormData()
    form.append('fichier', fichier)
    form.append('visibilite', 'publique')
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erreur ?? 'Erreur upload')
      if (dest === 'hero') {
        setConfig((prev) => ({ ...prev, hero: { ...prev.hero, imageUrl: data.url } }))
      } else {
        setConfig((prev) => ({ ...prev, logoSite: data.url }))
      }
      toast.success('Fichier téléversé avec succès.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload")
    } finally {
      if (dest === 'hero') setUploadHero(false)
      else setUploadLogo(false)
      const ref = dest === 'hero' ? heroRef : logoRef
      if (ref.current) ref.current.value = ''
    }
  }

  async function handleSauvegarder(e: React.FormEvent) {
    e.preventDefault()
    setSauvegarde(true)
    try {
      const res = await fetch('/api/admin/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.erreur ?? 'Erreur sauvegarde')
      }
      toast.success("Configuration mise à jour. Les nouvelles couleurs s'appliquent au prochain chargement de page.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSauvegarde(false)
    }
  }

  function updateHero<K extends keyof SiteConfig['hero']>(key: K, val: SiteConfig['hero'][K]) {
    setConfig((prev) => ({ ...prev, hero: { ...prev.hero, [key]: val } }))
  }

  function updateTheme(key: ColorKey, val: string) {
    setConfig((prev) => ({ ...prev, theme: { ...prev.theme, [key]: val } }))
  }

  function updateStat(index: number, field: 'value' | 'label', val: string) {
    setConfig((prev) => ({
      ...prev,
      stats: prev.stats.map((s, i) => (i === index ? { ...s, [field]: val } : s)),
    }))
  }

  function reinitialiserCouleurs() {
    setConfig((prev) => ({ ...prev, theme: { ...THEME_ASCCI } }))
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Apparence du site</h1>
        <p className="mt-1 text-sm text-gray-500">
          Logo, couleurs, nom, image héro et statistiques de la page d&apos;accueil.
        </p>
      </div>

      <form onSubmit={handleSauvegarder} className="space-y-8">
        {/* ── Logo du site ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-bold tracking-widest text-gray-500 uppercase">Logo du site</h2>
          <p className="mb-4 text-xs text-gray-400">
            Utilisé comme favicon (onglet navigateur) et image de partage (Open Graph). Privilégiez un carré PNG/SVG sur
            fond transparent.
          </p>

          <div className="flex flex-col items-start gap-5 sm:flex-row">
            {/* Aperçu logo */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
              {config.logoSite ? (
                <Image
                  src={config.logoSite}
                  alt="Logo du site"
                  width={72}
                  height={72}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageOff className="h-7 w-7 text-gray-300" strokeWidth={1.75} />
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">URL du logo</label>
                <input
                  type="text"
                  value={config.logoSite}
                  onChange={(e) => setConfig((prev) => ({ ...prev, logoSite: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
                  placeholder="/api/fichiers-publics/logo.png"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*,.svg"
                  onChange={(e) => handleUpload(e, 'logo')}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  disabled={uploadLogo}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploadLogo ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-gray-500" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {uploadLogo ? 'Téléversement…' : 'Téléverser un logo'}
                </button>
                {config.logoSite && (
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, logoSite: '' }))}
                    className="text-xs text-red-500 transition hover:text-red-700"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Simulation onglet navigateur */}
          {config.logoSite && (
            <div className="mt-4 flex w-fit items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
              <Image
                src={config.logoSite}
                alt="favicon"
                width={16}
                height={16}
                unoptimized
                className="h-4 w-4 object-contain"
              />
              <span className="max-w-50 truncate text-xs font-medium text-gray-600">
                {config.nomSite} — Suivi pédagogique
              </span>
              <span className="ml-1 text-xs text-gray-400">×</span>
            </div>
          )}
        </section>

        {/* ── Identité du site ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold tracking-widest text-gray-500 uppercase">Identité du site</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Nom du site
                <span className="ml-1 font-normal text-gray-400">(sidebar, onglet, en-tête)</span>
              </label>
              <input
                type="text"
                value={config.nomSite}
                onChange={(e) => setConfig((prev) => ({ ...prev, nomSite: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
                placeholder="SCOUT ASCCI"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Sous-titre
                <span className="ml-1 font-normal text-gray-400">(région, pays ou diocèse)</span>
              </label>
              <input
                type="text"
                value={config.sousTitreSite}
                onChange={(e) => setConfig((prev) => ({ ...prev, sousTitreSite: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
                placeholder="Côte d'Ivoire"
              />
            </div>
          </div>
        </section>

        {/* ── Couleurs ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold tracking-widest text-gray-500 uppercase">Couleurs du thème</h2>
            <button
              type="button"
              onClick={reinitialiserCouleurs}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
            >
              Réinitialiser ASCCI
            </button>
          </div>
          <p className="mb-5 text-xs text-gray-400">
            La prévisualisation est immédiate sur cette page — la sidebar reflète vos choix en temps réel.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            {COLORS.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="mb-2 block text-xs font-semibold text-gray-600">
                  {label}
                  <span className="ml-1 font-normal text-gray-400">({hint})</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.theme[key]}
                    onChange={(e) => updateTheme(key, e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-gray-300 p-0.5"
                  />
                  <input
                    type="text"
                    value={config.theme[key]}
                    onChange={(e) => {
                      const v = e.target.value
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateTheme(key, v)
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-2 font-mono text-xs text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
                    maxLength={7}
                  />
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full" style={{ backgroundColor: config.theme[key] }} />
              </div>
            ))}
          </div>

          {/* Aperçu sidebar */}
          <div className="mt-6 flex flex-col overflow-hidden rounded-lg border border-gray-200 sm:h-24 sm:flex-row">
            <div
              className="flex w-full shrink-0 flex-col justify-center gap-1.5 px-3 py-3 sm:w-36 sm:py-0"
              style={{ backgroundColor: config.theme.couleurPrimaire }}
            >
              <div className="h-1.5 w-16 rounded-full bg-white/30" />
              <div
                className="flex h-5 w-24 items-center gap-1 rounded-md px-2"
                style={{ backgroundColor: config.theme.couleurHover }}
              >
                <div className="h-1.5 w-3 rounded-full bg-white/60" />
                <div className="h-1.5 w-10 rounded-full bg-white/80" />
              </div>
              <div className="h-1.5 w-14 rounded-full bg-white/20" />
              <div className="h-1.5 w-18 rounded-full bg-white/20" />
            </div>
            <div className="flex min-w-0 flex-1 items-center bg-white px-5 py-3 sm:py-0">
              <div className="space-y-2">
                <div className="h-2.5 w-36 max-w-full rounded bg-gray-200" />
                <div className="h-2 w-24 max-w-full rounded bg-gray-100" />
              </div>
            </div>
          </div>
          <p className="mt-1.5 text-center text-xs text-gray-400">
            Aperçu — item actif en couleur hover, fond en couleur primaire
          </p>
        </section>

        {/* ── Image héro ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold tracking-widest text-gray-500 uppercase">
            Image d&apos;arrière-plan (page d&apos;accueil)
          </h2>

          <div className="relative mb-4 h-40 w-full overflow-hidden rounded-lg bg-[#102419]">
            {config.hero.imageUrl ? (
              <Image
                src={config.hero.imageUrl}
                alt={config.hero.imageAlt}
                fill
                unoptimized
                className="object-cover object-center opacity-80"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/40">Aucune image</div>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,32,22,0.85)_0%,rgba(9,32,22,0.4)_60%,rgba(9,32,22,0.05)_100%)]" />
            <span className="absolute bottom-3 left-3 text-xs font-bold text-white opacity-70">Aperçu</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">URL de l&apos;image</label>
              <input
                type="text"
                value={config.hero.imageUrl}
                onChange={(e) => updateHero('imageUrl', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
                placeholder="/api/fichiers-publics/ma-photo.jpg"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={heroRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload(e, 'hero')}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => heroRef.current?.click()}
                disabled={uploadHero}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadHero ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-gray-500" />
                ) : (
                  <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                {uploadHero ? 'Téléversement…' : 'Téléverser une nouvelle photo'}
              </button>
              <span className="text-xs text-gray-400">JPEG, PNG, WebP, SVG — max 5 Mo</span>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Texte alternatif (accessibilité)
              </label>
              <input
                type="text"
                value={config.hero.imageAlt}
                onChange={(e) => updateHero('imageAlt', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* ── Textes héro ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold tracking-widest text-gray-500 uppercase">Textes de la bannière</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Badge (petit libellé au-dessus du titre)
              </label>
              <input
                type="text"
                value={config.hero.badge}
                onChange={(e) => updateHero('badge', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Titre principal</label>
              <input
                type="text"
                value={config.hero.titre}
                onChange={(e) => updateHero('titre', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Sous-titre / description</label>
              <textarea
                value={config.hero.sousTitre}
                onChange={(e) => updateHero('sousTitre', e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* ── Statistiques ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold tracking-widest text-gray-500 uppercase">
            Statistiques (bandeau sous la bannière)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.stats.map((stat, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={stat.value}
                  onChange={(e) => updateStat(i, 'value', e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
                  placeholder="100%"
                />
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => updateStat(i, 'label', e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none"
                  placeholder="Libellé"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:justify-end">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Voir la page d&apos;accueil
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <button
            type="submit"
            disabled={sauvegarde}
            className="flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: 'var(--cp)' }}
          >
            {sauvegarde && <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />}
            {sauvegarde ? 'Sauvegarde…' : 'Sauvegarder les modifications'}
          </button>
        </div>
      </form>
    </div>
  )
}
