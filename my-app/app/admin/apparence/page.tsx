'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'

type Theme = {
  couleurPrimaire: string
  couleurAccent: string
  couleurFond: string
  couleurHover: string
}

type Stat = { value: string; label: string }

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
  stats: Stat[]
  seo: { metaDescription: string; ogImageUrl: string }
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
    sousTitre: "Une application claire pour gérer les scouts catholiques de Côte d'Ivoire, suivre les activités, les présences et la progression pédagogique depuis un même espace.",
  },
  stats: [
    { value: '5', label: 'Branches suivies' },
    { value: '4', label: 'Profils principaux' },
    { value: '1', label: 'Base paroissiale' },
    { value: '100%', label: 'Historique centralisé' },
  ],
  seo: {
    metaDescription: "Application de suivi pédagogique des scouts catholiques de Côte d'Ivoire",
    ogImageUrl: '',
  },
}

type Preset = { nom: string; theme: Theme }

// Quelques palettes prêtes à l'emploi, en plus du vert ASCCI historique —
// évite à l'admin de deviner des codes hexadécimaux pour changer d'identité.
const PRESETS: Preset[] = [
  { nom: 'Vert ASCCI (défaut)', theme: THEME_ASCCI },
  { nom: 'Bleu marine', theme: { couleurPrimaire: '#1b3a6b', couleurAccent: '#f2b705', couleurFond: '#0c1f3d', couleurHover: '#24518f' } },
  { nom: 'Bordeaux', theme: { couleurPrimaire: '#5c1a2b', couleurAccent: '#d97706', couleurFond: '#260a10', couleurHover: '#7a2438' } },
  { nom: 'Ocre savane', theme: { couleurPrimaire: '#7a4a1e', couleurAccent: '#2f9e44', couleurFond: '#2c1c0d', couleurHover: '#9c6329' } },
]

const MAX_STATS = 8
const LIMITES = {
  badge: 40,
  titre: 70,
  sousTitre: 240,
  metaDescription: 160,
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '39, 174, 96'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

// Contraste WCAG (relative luminance) — sert à vérifier qu'un texte blanc
// reste lisible sur les couleurs choisies (sidebar, boutons), plutôt que de
// laisser l'admin choisir une couleur trop claire sans s'en rendre compte.
function luminanceCanal(c: number): number {
  const cs = c / 255
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 0
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * luminanceCanal(r) + 0.7152 * luminanceCanal(g) + 0.0722 * luminanceCanal(b)
}

function ratioContraste(hex1: string, hex2: string): number {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  const [clair, sombre] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (clair + 0.05) / (sombre + 0.05)
}

function niveauContraste(ratio: number): { label: string; classe: string } {
  if (ratio >= 4.5) return { label: `${ratio.toFixed(1)}:1 — conforme AA`, classe: 'text-emerald-600' }
  if (ratio >= 3) return { label: `${ratio.toFixed(1)}:1 — limite (grand texte)`, classe: 'text-amber-600' }
  return { label: `${ratio.toFixed(1)}:1 — contraste insuffisant`, classe: 'text-red-600' }
}

type ColorKey = keyof Theme
type ColorDef = { key: ColorKey; label: string; hint: string }

const COLORS: ColorDef[] = [
  { key: 'couleurPrimaire', label: 'Couleur primaire',        hint: 'Sidebar, boutons, avatar' },
  { key: 'couleurHover',   label: 'Couleur des hovers',      hint: 'Liens actifs, survol menu' },
  { key: 'couleurAccent',  label: "Couleur d'accentuation",   hint: 'Badges, détails secondaires' },
  { key: 'couleurFond',    label: 'Couleur de fond',          hint: 'Arrière-plan pages auth' },
]

function fusionnerConfig(base: SiteConfig, data: Partial<SiteConfig>): SiteConfig {
  return {
    ...base,
    ...data,
    theme: { ...base.theme, ...(data.theme ?? {}) },
    hero: { ...base.hero, ...(data.hero ?? {}) },
    stats: data.stats?.length ? data.stats : base.stats,
    seo: { ...base.seo, ...(data.seo ?? {}) },
  }
}

export default function SiteConfigPage() {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG)
  const [chargement, setChargement] = useState(true)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [uploadHero, setUploadHero] = useState(false)
  const [uploadLogo, setUploadLogo] = useState(false)
  const [uploadOg, setUploadOg] = useState(false)
  const heroRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const ogRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const configInitialRef = useRef<string>(JSON.stringify(DEFAULT_CONFIG))

  useEffect(() => {
    fetch('/api/admin/site-config')
      .then((r) => {
        if (!r.ok) {
          toast.error('Impossible de charger la configuration actuelle — les valeurs affichées sont des valeurs par défaut, vérifiez avant de sauvegarder.')
          return null
        }
        return r.json()
      })
      .then((data: Partial<SiteConfig> | null) => {
        const merged = data ? fusionnerConfig(DEFAULT_CONFIG, data) : DEFAULT_CONFIG
        setConfig(merged)
        configInitialRef.current = JSON.stringify(merged)
        setChargement(false)
      })
      .catch(() => {
        toast.error('Impossible de charger la configuration actuelle — les valeurs affichées sont des valeurs par défaut, vérifiez avant de sauvegarder.')
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

  const estModifie = !chargement && JSON.stringify(config) !== configInitialRef.current

  // Évite de perdre des changements de couleurs/textes par un rechargement ou
  // une fermeture d'onglet accidentelle avant d'avoir cliqué sur Sauvegarder.
  useEffect(() => {
    if (!estModifie) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [estModifie])

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    dest: 'hero' | 'logo' | 'og',
  ) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    const setUploading = dest === 'hero' ? setUploadHero : dest === 'logo' ? setUploadLogo : setUploadOg
    setUploading(true)
    const form = new FormData()
    form.append('fichier', fichier)
    form.append('visibilite', 'publique')
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erreur ?? 'Erreur upload')
      if (dest === 'hero') {
        setConfig((prev) => ({ ...prev, hero: { ...prev.hero, imageUrl: data.url } }))
      } else if (dest === 'logo') {
        setConfig((prev) => ({ ...prev, logoSite: data.url }))
      } else {
        setConfig((prev) => ({ ...prev, seo: { ...prev.seo, ogImageUrl: data.url } }))
      }
      toast.success('Fichier téléversé avec succès.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload")
    } finally {
      setUploading(false)
      const ref = dest === 'hero' ? heroRef : dest === 'logo' ? logoRef : ogRef
      if (ref.current) ref.current.value = ''
    }
  }

  async function handleSauvegarder(e: React.FormEvent) {
    e.preventDefault()
    const ok = await confirmer({
      titre: 'Publier ces modifications ?',
      description: 'La configuration (thème, couleurs, textes, SEO) sera visible immédiatement par tous les visiteurs du site public.',
      labelConfirmer: 'Publier',
    })
    if (!ok) return
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
      configInitialRef.current = JSON.stringify(config)
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

  function updateSeo<K extends keyof SiteConfig['seo']>(key: K, val: SiteConfig['seo'][K]) {
    setConfig((prev) => ({ ...prev, seo: { ...prev.seo, [key]: val } }))
  }

  function updateTheme(key: ColorKey, val: string) {
    setConfig((prev) => ({ ...prev, theme: { ...prev.theme, [key]: val } }))
  }

  function appliquerPreset(theme: Theme) {
    setConfig((prev) => ({ ...prev, theme: { ...theme } }))
  }

  function updateStat(index: number, field: 'value' | 'label', val: string) {
    setConfig((prev) => ({
      ...prev,
      stats: prev.stats.map((s, i) => (i === index ? { ...s, [field]: val } : s)),
    }))
  }

  function ajouterStat() {
    setConfig((prev) => (prev.stats.length >= MAX_STATS ? prev : { ...prev, stats: [...prev.stats, { value: '', label: '' }] }))
  }

  function supprimerStat(index: number) {
    setConfig((prev) => (prev.stats.length <= 1 ? prev : { ...prev, stats: prev.stats.filter((_, i) => i !== index) }))
  }

  function exporterConfig() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `apparence-${config.nomSite.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'site'}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Configuration exportée.')
  }

  async function importerConfig(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    try {
      const texte = await fichier.text()
      const data = JSON.parse(texte) as unknown
      if (typeof data !== 'object' || data === null) throw new Error()
      setConfig(fusionnerConfig(DEFAULT_CONFIG, data as Partial<SiteConfig>))
      toast.success('Configuration importée — vérifiez les valeurs puis sauvegardez pour les appliquer.')
    } catch {
      toast.error('Fichier invalide : un export JSON généré par cette page est attendu.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black text-gray-900">Apparence du site</h1>
          {estModifie && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Modifications non enregistrées
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Logo, couleurs, nom, image héro, référencement et statistiques de la page d&apos;accueil.
        </p>
      </div>

      <form onSubmit={handleSauvegarder} className="space-y-8">

        {/* ── Logo du site ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">
            Logo du site
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Utilisé comme favicon (onglet navigateur) et image de partage (Open Graph). Privilégiez un carré PNG/SVG sur fond transparent.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Aperçu logo */}
            <div className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
              {config.logoSite ? (
                <Image
                  src={config.logoSite}
                  alt="Logo du site"
                  width={72}
                  height={72}
                  unoptimized
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-3xl text-gray-300">🖼</span>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">URL du logo</label>
                <input
                  type="text"
                  value={config.logoSite}
                  onChange={(e) => setConfig((prev) => ({ ...prev, logoSite: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                  placeholder="/uploads/logo.png"
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
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  {uploadLogo
                    ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-500" />
                    : <span>📤</span>}
                  {uploadLogo ? 'Téléversement…' : 'Téléverser un logo'}
                </button>
                {config.logoSite && (
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, logoSite: '' }))}
                    className="text-xs text-red-500 hover:text-red-700 transition"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Simulation onglet navigateur */}
          {config.logoSite && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 w-fit">
              <Image
                src={config.logoSite}
                alt="favicon"
                width={16}
                height={16}
                unoptimized
                className="w-4 h-4 object-contain"
              />
              <span className="text-xs text-gray-600 font-medium truncate max-w-[200px]">
                {config.nomSite} — Suivi pédagogique
              </span>
              <span className="text-gray-400 text-xs ml-1">×</span>
            </div>
          )}
        </section>

        {/* ── Identité du site ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
            Identité du site
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Nom du site
                <span className="ml-1 font-normal text-gray-400">(sidebar, onglet, en-tête)</span>
              </label>
              <input
                type="text"
                value={config.nomSite}
                onChange={(e) => setConfig((prev) => ({ ...prev, nomSite: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                placeholder="SCOUT ASCCI"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Sous-titre
                <span className="ml-1 font-normal text-gray-400">(région, pays ou diocèse)</span>
              </label>
              <input
                type="text"
                value={config.sousTitreSite}
                onChange={(e) => setConfig((prev) => ({ ...prev, sousTitreSite: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                placeholder="Côte d'Ivoire"
              />
            </div>
          </div>
        </section>

        {/* ── Couleurs ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">
            Couleurs du thème
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            La prévisualisation est immédiate sur cette page — la sidebar reflète vos choix en temps réel.
          </p>

          {/* Palettes prédéfinies */}
          <div className="flex flex-wrap gap-2 mb-5">
            {PRESETS.map((preset) => (
              <button
                key={preset.nom}
                type="button"
                onClick={() => appliquerPreset(preset.theme)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition"
              >
                <span className="flex -space-x-1">
                  <span className="h-3.5 w-3.5 rounded-full border border-white" style={{ backgroundColor: preset.theme.couleurPrimaire }} />
                  <span className="h-3.5 w-3.5 rounded-full border border-white" style={{ backgroundColor: preset.theme.couleurAccent }} />
                  <span className="h-3.5 w-3.5 rounded-full border border-white" style={{ backgroundColor: preset.theme.couleurHover }} />
                </span>
                {preset.nom}
              </button>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {COLORS.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">
                  {label}
                  <span className="ml-1 font-normal text-gray-400">({hint})</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.theme[key]}
                    onChange={(e) => updateTheme(key, e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-gray-300 p-0.5 flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={config.theme[key]}
                    onChange={(e) => {
                      const v = e.target.value
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateTheme(key, v)
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-xs font-mono focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                    maxLength={7}
                  />
                </div>
                <div
                  className="mt-2 h-1.5 w-full rounded-full"
                  style={{ backgroundColor: config.theme[key] }}
                />
              </div>
            ))}
          </div>

          {/* Aperçu sidebar */}
          <div className="mt-6 rounded-lg overflow-hidden border border-gray-200 flex flex-col sm:flex-row sm:h-24">
            <div
              className="w-full sm:w-36 flex-shrink-0 flex flex-col justify-center px-3 py-3 sm:py-0 gap-1.5"
              style={{ backgroundColor: config.theme.couleurPrimaire }}
            >
              <div className="h-1.5 w-16 rounded-full bg-white/30" />
              <div
                className="h-5 w-24 rounded-md flex items-center px-2 gap-1"
                style={{ backgroundColor: config.theme.couleurHover }}
              >
                <div className="h-1.5 w-3 rounded-full bg-white/60" />
                <div className="h-1.5 w-10 rounded-full bg-white/80" />
              </div>
              <div className="h-1.5 w-14 rounded-full bg-white/20" />
              <div className="h-1.5 w-18 rounded-full bg-white/20" />
            </div>
            <div className="flex-1 min-w-0 flex items-center px-5 py-3 sm:py-0 bg-white">
              <div className="space-y-2">
                <div className="h-2.5 w-36 max-w-full rounded bg-gray-200" />
                <div className="h-2 w-24 max-w-full rounded bg-gray-100" />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-center">
            Aperçu — item actif en couleur hover, fond en couleur primaire
          </p>

          {/* Vérificateur de contraste WCAG */}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Texte blanc sur couleur primaire', bg: config.theme.couleurPrimaire },
              { label: 'Texte blanc sur couleur hover', bg: config.theme.couleurHover },
            ].map(({ label, bg }) => {
              const niveau = niveauContraste(ratioContraste(bg, '#ffffff'))
              return (
                <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-xs font-semibold whitespace-nowrap ${niveau.classe}`}>{niveau.label}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Ratio de contraste WCAG — visez au moins 4.5:1 pour que le texte reste lisible, y compris pour les personnes malvoyantes.
          </p>
        </section>

        {/* ── Image héro ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
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
              <div className="flex h-full items-center justify-center text-white/40 text-sm">
                Aucune image
              </div>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,32,22,0.85)_0%,rgba(9,32,22,0.4)_60%,rgba(9,32,22,0.05)_100%)]" />
            <span className="absolute bottom-3 left-3 text-white text-xs font-bold opacity-70">
              Aperçu
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">URL de l&apos;image</label>
              <input
                type="text"
                value={config.hero.imageUrl}
                onChange={(e) => updateHero('imageUrl', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                placeholder="/uploads/ma-photo.jpg"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={heroRef} type="file" accept="image/*" onChange={(e) => handleUpload(e, 'hero')} className="hidden" />
              <button
                type="button"
                onClick={() => heroRef.current?.click()}
                disabled={uploadHero}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {uploadHero
                  ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-500" />
                  : <span>📤</span>}
                {uploadHero ? 'Téléversement…' : 'Téléverser une nouvelle photo'}
              </button>
              <span className="text-xs text-gray-400">JPEG, PNG, WebP, SVG — max 5 Mo</span>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Texte alternatif (accessibilité)</label>
              <input
                type="text"
                value={config.hero.imageAlt}
                onChange={(e) => updateHero('imageAlt', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </div>
        </section>

        {/* ── Textes héro ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
            Textes de la bannière
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center justify-between">
                <span>Badge (petit libellé au-dessus du titre)</span>
                <span className={config.hero.badge.length > LIMITES.badge ? 'font-normal text-amber-500' : 'font-normal text-gray-400'}>
                  {config.hero.badge.length}/{LIMITES.badge}
                </span>
              </label>
              <input
                type="text"
                value={config.hero.badge}
                onChange={(e) => updateHero('badge', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center justify-between">
                <span>Titre principal</span>
                <span className={config.hero.titre.length > LIMITES.titre ? 'font-normal text-amber-500' : 'font-normal text-gray-400'}>
                  {config.hero.titre.length}/{LIMITES.titre}
                </span>
              </label>
              <input
                type="text"
                value={config.hero.titre}
                onChange={(e) => updateHero('titre', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center justify-between">
                <span>Sous-titre / description</span>
                <span className={config.hero.sousTitre.length > LIMITES.sousTitre ? 'font-normal text-amber-500' : 'font-normal text-gray-400'}>
                  {config.hero.sousTitre.length}/{LIMITES.sousTitre}
                </span>
              </label>
              <textarea
                value={config.hero.sousTitre}
                onChange={(e) => updateHero('sousTitre', e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400 resize-none"
              />
            </div>
          </div>
        </section>

        {/* ── Référencement & partage (SEO) ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">
            Référencement &amp; partage (SEO)
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Ce que les moteurs de recherche et les aperçus de lien (WhatsApp, Facebook, X) affichent quand le site est partagé.
          </p>

          {/* Aperçu carte de partage */}
          <div className="mb-4 overflow-hidden rounded-lg border border-gray-200">
            <div className="relative h-32 w-full bg-gray-100">
              {(config.seo.ogImageUrl || config.logoSite) ? (
                <Image
                  src={config.seo.ogImageUrl || config.logoSite}
                  alt="Aperçu de la carte de partage"
                  fill
                  unoptimized
                  className="object-cover object-center"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-300 text-xs">
                  Aucune image de partage
                </div>
              )}
            </div>
            <div className="p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 truncate">
                {config.nomSite}
              </p>
              <p className="text-sm font-bold text-gray-800 truncate">{config.nomSite} — Suivi pédagogique</p>
              <p className="text-xs text-gray-500 line-clamp-2">
                {config.seo.metaDescription || 'Aucune description définie.'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center justify-between">
                <span>Description (balise meta, résultats de recherche)</span>
                <span className={config.seo.metaDescription.length > LIMITES.metaDescription ? 'font-normal text-amber-500' : 'font-normal text-gray-400'}>
                  {config.seo.metaDescription.length}/{LIMITES.metaDescription}
                </span>
              </label>
              <textarea
                value={config.seo.metaDescription}
                onChange={(e) => updateSeo('metaDescription', e.target.value)}
                rows={2}
                maxLength={300}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Image de partage
                <span className="ml-1 font-normal text-gray-400">(format recommandé 1200×630 — vide = logo utilisé par défaut)</span>
              </label>
              <input
                type="text"
                value={config.seo.ogImageUrl}
                onChange={(e) => updateSeo('ogImageUrl', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                placeholder="/uploads/partage.jpg"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input ref={ogRef} type="file" accept="image/*" onChange={(e) => handleUpload(e, 'og')} className="hidden" />
                <button
                  type="button"
                  onClick={() => ogRef.current?.click()}
                  disabled={uploadOg}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  {uploadOg
                    ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-500" />
                    : <span>📤</span>}
                  {uploadOg ? 'Téléversement…' : 'Téléverser une image de partage'}
                </button>
                {config.seo.ogImageUrl && (
                  <button
                    type="button"
                    onClick={() => updateSeo('ogImageUrl', '')}
                    className="text-xs text-red-500 hover:text-red-700 transition"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Statistiques ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
              Statistiques (bandeau sous la bannière)
            </h2>
            <span className="text-xs text-gray-400">{config.stats.length}/{MAX_STATS}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.stats.map((stat, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={stat.value}
                  onChange={(e) => updateStat(i, 'value', e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                  placeholder="100%"
                />
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => updateStat(i, 'label', e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                  placeholder="Libellé"
                />
                <button
                  type="button"
                  onClick={() => supprimerStat(i)}
                  disabled={config.stats.length <= 1}
                  title="Supprimer cette statistique"
                  className="shrink-0 rounded-lg border border-gray-200 px-2.5 text-sm text-gray-400 hover:text-red-500 hover:border-red-200 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-200 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={ajouterStat}
            disabled={config.stats.length >= MAX_STATS}
            className="mt-3 text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:hover:text-gray-500 transition"
          >
            + Ajouter une statistique
          </button>
        </section>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exporterConfig}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Exporter (JSON)
            </button>
            <input ref={importRef} type="file" accept="application/json" onChange={importerConfig} className="hidden" />
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Importer (JSON)
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Voir la page d&apos;accueil ↗
            </a>
            <button
              type="submit"
              disabled={sauvegarde || !estModifie}
              className="rounded-lg px-6 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {sauvegarde && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              {sauvegarde ? 'Sauvegarde…' : estModifie ? 'Sauvegarder les modifications' : 'Aucune modification'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
