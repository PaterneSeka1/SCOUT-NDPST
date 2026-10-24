'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ErreurApi } from '@/lib/api'
import { ExternalLink } from '@/lib/icons'
import { Button, ErrorState, Field, FileUpload, Input, PageHeader, Skeleton, Switch, Tabs, Textarea } from '@/components/ui'

// Identité de l'installation (une seule configuration, jamais de CRUD de
// paroisses) : GET/PUT /api/admin/configuration, réservé à l'administrateur.

interface Configuration {
  nomParoisse: string
  nomGroupe: string | null
  ville: string | null
  diocese: string | null
  presentation: string | null
  messageBienvenue: string | null
  anneeHistorique: number | null
  rangHistorique: string | null
  rangHistoriqueValide: boolean
  sourceHistorique: string | null
  adresse: string | null
  telephone: string | null
  email: string | null
  horaires: string | null
  logoUrl: string | null
  couleurPrimaire: string
  couleurAccent: string
  couleurFond: string
  couleurHover: string
  heroTitre: string | null
  heroSousTitre: string | null
  heroImageUrl: string | null
  heroImageAlt: string | null
  reseauxSociaux: Record<string, string> | null
  inscriptionsOuvertes: boolean
}

type Onglet = 'identite' | 'accueil' | 'coordonnees' | 'apparence'

const RESEAUX = [
  { cle: 'facebook', libelle: 'Facebook' },
  { cle: 'instagram', libelle: 'Instagram' },
  { cle: 'youtube', libelle: 'YouTube' },
  { cle: 'whatsapp', libelle: 'WhatsApp' },
  { cle: 'tiktok', libelle: 'TikTok' },
]

const HEX = /^#[0-9a-fA-F]{6}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Contraste WCAG d'une couleur avec le blanc (texte des boutons). */
function contrasteBlanc(hex: string): number {
  if (!HEX.test(hex)) return 0
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const l = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
  return 1.05 / (l + 0.05)
}

function Couleur({ label, aide, valeur, onChange }: { label: string; aide: string; valeur: string; onChange: (v: string) => void }) {
  const contraste = contrasteBlanc(valeur)
  return (
    <Field label={label} aide={aide} erreur={!HEX.test(valeur) ? 'Format attendu : #RRGGBB' : contraste < 4.5 ? `Contraste avec le texte blanc insuffisant (${contraste.toFixed(1)}:1, 4,5 minimum).` : null}>
      {(p) => (
        <div className="flex items-center gap-3">
          <input type="color" aria-label={`${label} (sélecteur)`} value={HEX.test(valeur) ? valeur : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-ligne bg-white p-1" />
          <Input {...p} className="w-32 font-mono" maxLength={7} value={valeur} onChange={(e) => onChange(e.target.value)} />
          <span className="rounded px-2 py-1 text-xs font-semibold text-white" style={{ backgroundColor: HEX.test(valeur) ? valeur : undefined }}>
            Aperçu
          </span>
        </div>
      )}
    </Field>
  )
}

function Formulaire({ initial }: { initial: Configuration }) {
  const [v, setV] = useState(initial)
  const [onglet, setOnglet] = useState<Onglet>('identite')
  const [erreur, setErreur] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const maj = <K extends keyof Configuration>(cle: K, valeur: Configuration[K]) => setV((p) => ({ ...p, [cle]: valeur }))
  const texte = (cle: keyof Configuration) => (v[cle] as string | null) ?? ''

  const enregistrer = useMutation({
    mutationFn: (donnees: Record<string, unknown>) => api<Configuration>('/api/admin/configuration', { method: 'PUT', json: donnees }),
    onSuccess: (config) => {
      queryClient.setQueryData(['configuration-admin'], config)
      toast.success('Configuration enregistrée. Le site public est mis à jour.')
    },
  })

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    // Erreur de saisie : message et ouverture de l'onglet concerné.
    const echec = (message: string, ou: Onglet) => {
      setErreur(message)
      setOnglet(ou)
    }
    if (v.nomParoisse.trim().length < 2) return echec('Le nom officiel de la paroisse est requis.', 'identite')
    if (v.email && !EMAIL.test(v.email.trim())) return echec('Adresse e-mail invalide.', 'coordonnees')
    const annee = new Date().getFullYear()
    if (v.anneeHistorique !== null && (!Number.isInteger(v.anneeHistorique) || v.anneeHistorique < 1900 || v.anneeHistorique > annee)) {
      return echec(`L’année de fondation doit être comprise entre 1900 et ${annee}.`, 'accueil')
    }
    if (![v.couleurPrimaire, v.couleurAccent, v.couleurFond, v.couleurHover].every((c) => HEX.test(c))) return echec('Les couleurs doivent être au format #RRGGBB.', 'apparence')
    const reseaux = Object.entries(v.reseauxSociaux ?? {}).filter(([, url]) => url.trim())
    if (reseaux.some(([, url]) => !/^https:\/\//.test(url.trim()))) return echec('Les liens des réseaux sociaux doivent commencer par https://', 'coordonnees')

    const nettoye = (s: string | null) => s?.trim() || null
    try {
      await enregistrer.mutateAsync({
        nomParoisse: v.nomParoisse.trim(),
        nomGroupe: v.nomGroupe?.trim() ?? '',
        ville: nettoye(v.ville),
        diocese: nettoye(v.diocese),
        presentation: nettoye(v.presentation),
        messageBienvenue: nettoye(v.messageBienvenue),
        anneeHistorique: v.anneeHistorique,
        rangHistorique: nettoye(v.rangHistorique),
        rangHistoriqueValide: v.rangHistoriqueValide,
        sourceHistorique: nettoye(v.sourceHistorique),
        adresse: nettoye(v.adresse),
        telephone: nettoye(v.telephone),
        email: v.email?.trim() ?? '',
        horaires: nettoye(v.horaires),
        logoUrl: v.logoUrl,
        heroTitre: nettoye(v.heroTitre),
        heroSousTitre: nettoye(v.heroSousTitre),
        heroImageUrl: v.heroImageUrl,
        heroImageAlt: nettoye(v.heroImageAlt),
        couleurPrimaire: v.couleurPrimaire,
        couleurAccent: v.couleurAccent,
        couleurFond: v.couleurFond,
        couleurHover: v.couleurHover,
        reseauxSociaux: Object.fromEntries(RESEAUX.map((r) => [r.cle, v.reseauxSociaux?.[r.cle]?.trim() || null])),
        inscriptionsOuvertes: v.inscriptionsOuvertes,
      })
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : 'Enregistrement impossible.')
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="space-y-6">
      <Tabs
        label="Sections de la configuration"
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { valeur: 'identite', libelle: 'Identité' },
          { valeur: 'accueil', libelle: 'Accueil et histoire' },
          { valeur: 'coordonnees', libelle: 'Coordonnées' },
          { valeur: 'apparence', libelle: 'Apparence' },
        ]}
      />

      <div className="rounded-lg border border-ligne bg-white p-5 sm:p-6">
        {onglet === 'identite' && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nom officiel de la paroisse" requis>
              {(p) => <Input {...p} maxLength={150} value={v.nomParoisse} onChange={(e) => maj('nomParoisse', e.target.value)} />}
            </Field>
            <Field label="Nom du groupe scout" aide="Nom principal affiché sur le site. À défaut, celui de la paroisse.">
              {(p) => <Input {...p} maxLength={150} value={texte('nomGroupe')} onChange={(e) => maj('nomGroupe', e.target.value)} />}
            </Field>
            <Field label="Ville">{(p) => <Input {...p} maxLength={100} value={texte('ville')} onChange={(e) => maj('ville', e.target.value)} />}</Field>
            <Field label="Diocèse">{(p) => <Input {...p} maxLength={150} value={texte('diocese')} onChange={(e) => maj('diocese', e.target.value)} />}</Field>
            <Field label="Présentation du groupe" aide="Texte de pied de page et métadonnées du site (5 000 caractères au plus)." className="md:col-span-2">
              {(p) => <Textarea {...p} rows={4} maxLength={5000} value={texte('presentation')} onChange={(e) => maj('presentation', e.target.value)} />}
            </Field>
            <div className="md:col-span-2">
              <FileUpload label="Logo" aide="Format carré, fond clair de préférence." visibilite="publique" valeur={v.logoUrl} onChange={(url) => maj('logoUrl', url)} />
            </div>
            <div className="md:col-span-2">
              <Switch
                checked={v.inscriptionsOuvertes}
                onChange={(b) => maj('inscriptionsOuvertes', b)}
                label="Inscriptions ouvertes"
                description="Si désactivé, seuls les parcours « information » et « contact » restent proposés sur « Nous rejoindre »."
              />
            </div>
          </div>
        )}

        {onglet === 'accueil' && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Titre de la page d’accueil" aide="Par défaut : le nom du groupe.">
              {(p) => <Input {...p} maxLength={150} value={texte('heroTitre')} onChange={(e) => maj('heroTitre', e.target.value)} />}
            </Field>
            <Field label="Sous-titre de la page d’accueil">
              {(p) => <Input {...p} maxLength={400} value={texte('heroSousTitre')} onChange={(e) => maj('heroSousTitre', e.target.value)} />}
            </Field>
            <div className="md:col-span-2">
              <FileUpload label="Photo d’ouverture" aide="Photo authentique du groupe, format paysage. Sans photo, une illustration signalée comme telle est affichée." visibilite="publique" valeur={v.heroImageUrl} onChange={(url) => maj('heroImageUrl', url)} />
            </div>
            <Field label="Description de la photo" aide="Texte lu par les lecteurs d’écran." className="md:col-span-2">
              {(p) => <Input {...p} maxLength={200} value={texte('heroImageAlt')} onChange={(e) => maj('heroImageAlt', e.target.value)} />}
            </Field>
            <Field label="Message de bienvenue" className="md:col-span-2">
              {(p) => <Textarea {...p} rows={3} maxLength={2000} value={texte('messageBienvenue')} onChange={(e) => maj('messageBienvenue', e.target.value)} />}
            </Field>
            <Field label="Année d’arrivée du scoutisme dans la paroisse">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  className="w-32"
                  value={v.anneeHistorique ?? ''}
                  onChange={(e) => maj('anneeHistorique', e.target.value === '' ? null : e.target.valueAsNumber)}
                />
              )}
            </Field>
            <Field label="Source de cette information" aide="Archives, registre, publication…">
              {(p) => <Input {...p} maxLength={1000} value={texte('sourceHistorique')} onChange={(e) => maj('sourceHistorique', e.target.value)} />}
            </Field>
            <Field label="Rang historique" aide="Ex. « Deuxième groupe scout du diocèse ». N’est publié qu’une fois confirmé par une source." className="md:col-span-2">
              {(p) => <Input {...p} maxLength={300} value={texte('rangHistorique')} onChange={(e) => maj('rangHistorique', e.target.value)} />}
            </Field>
            <div className="md:col-span-2">
              <Switch checked={v.rangHistoriqueValide} onChange={(b) => maj('rangHistoriqueValide', b)} label="Rang historique confirmé par une source" />
            </div>
          </div>
        )}

        {onglet === 'coordonnees' && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Adresse" className="md:col-span-2">
              {(p) => <Input {...p} maxLength={300} value={texte('adresse')} onChange={(e) => maj('adresse', e.target.value)} />}
            </Field>
            <Field label="Téléphone">{(p) => <Input {...p} type="tel" maxLength={40} value={texte('telephone')} onChange={(e) => maj('telephone', e.target.value)} />}</Field>
            <Field label="E-mail">{(p) => <Input {...p} type="email" maxLength={200} value={texte('email')} onChange={(e) => maj('email', e.target.value)} />}</Field>
            <Field label="Horaires des réunions" className="md:col-span-2" aide="Ex. « Samedi de 15 h à 18 h, cour de la paroisse ».">
              {(p) => <Textarea {...p} rows={2} maxLength={500} value={texte('horaires')} onChange={(e) => maj('horaires', e.target.value)} />}
            </Field>
            {RESEAUX.map((r) => (
              <Field key={r.cle} label={`${r.libelle} (lien https)`}>
                {(p) => (
                  <Input
                    {...p}
                    type="url"
                    maxLength={300}
                    placeholder="https://"
                    value={v.reseauxSociaux?.[r.cle] ?? ''}
                    onChange={(e) => maj('reseauxSociaux', { ...(v.reseauxSociaux ?? {}), [r.cle]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
        )}

        {onglet === 'apparence' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Couleur label="Couleur principale" aide="Boutons, liens et éléments actifs." valeur={v.couleurPrimaire} onChange={(c) => maj('couleurPrimaire', c)} />
            <Couleur label="Couleur d’accent" aide="Bouton « Nous rejoindre », surtitres." valeur={v.couleurAccent} onChange={(c) => maj('couleurAccent', c)} />
            <Couleur label="Couleur profonde" aide="Bandeaux sombres, barre latérale, pied de page." valeur={v.couleurFond} onChange={(c) => maj('couleurFond', c)} />
            <Couleur label="Couleur de survol" aide="Repère de la rubrique active dans l’espace privé." valeur={v.couleurHover} onChange={(c) => maj('couleurHover', c)} />
          </div>
        )}
      </div>

      {erreur && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {erreur}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" chargement={enregistrer.isPending}>
          Enregistrer la configuration
        </Button>
      </div>
    </form>
  )
}

export default function PageConfiguration() {
  const config = useQuery({ queryKey: ['configuration-admin'], queryFn: () => api<Configuration>('/api/admin/configuration') })
  return (
    <div>
      <PageHeader
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Administration' }, { libelle: 'Identité et configuration' }]}
        titre="Identité et configuration"
        description="L’identité unique de cette installation : nom, accueil du site, coordonnées et couleurs."
        actions={
          <Link href="/" target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50">
            <ExternalLink className="h-4 w-4" aria-hidden />
            Voir le site<span className="sr-only"> (nouvel onglet)</span>
          </Link>
        }
      />
      {config.isPending ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : config.isError ? (
        <ErrorState message={config.error.message} onReessayer={() => void config.refetch()} className="rounded-lg border border-ligne bg-white" />
      ) : (
        <Formulaire initial={config.data} />
      )}
    </div>
  )
}
