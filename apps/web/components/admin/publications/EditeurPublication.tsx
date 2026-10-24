'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LABELS_STATUT_PUBLICATION, slugifier } from '@scout/shared'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  FileUpload,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  confirmer,
} from '@/components/ui'
import { Archive, EyeOff, ExternalLink, Send, Settings, Trash2, Check } from '@/lib/icons'
import { api } from '@/lib/api'
import { dateHeure, dateLongue, valeurChampDate } from '@/lib/format'
import { champsModifies, messageErreur, miettesAdmin, texteOuNull, TONS_STATUT_PUBLICATION } from '@/components/admin/commun'
import { EditeurTexte } from '@/components/admin/EditeurTexte'
import { GestionCategories } from './GestionCategories'
import { CLE_PUBLICATIONS, useCategories, type Publication } from './donnees'

interface Formulaire {
  titre: string
  slug: string
  resume: string
  contenu: string
  categorieId: string
  imageCouverture: string | null
  imageAlt: string
  seoTitre: string
  seoDescription: string
}

type Erreurs = Partial<Record<keyof Formulaire, string>>

const LIMITES = { titre: 200, slug: 80, resume: 400, contenu: 50000, imageAlt: 200, seoTitre: 70, seoDescription: 160 }

function depuisPublication(p?: Publication): Formulaire {
  return {
    titre: p?.titre ?? '',
    slug: p?.slug ?? '',
    resume: p?.resume ?? '',
    contenu: p?.contenu ?? '',
    categorieId: p?.categorieId ?? '',
    imageCouverture: p?.imageCouverture ?? null,
    imageAlt: p?.imageAlt ?? '',
    seoTitre: p?.seoTitre ?? '',
    seoDescription: p?.seoDescription ?? '',
  }
}

// Corps envoyé à l'API : chaînes vides converties en null.
function versCorps(f: Partial<Formulaire>): Record<string, unknown> {
  const corps: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(f)) {
    if (cle === 'titre' || cle === 'contenu') corps[cle] = typeof valeur === 'string' ? valeur.trim() : valeur
    else if (cle === 'imageCouverture') corps[cle] = valeur ?? null
    else corps[cle] = typeof valeur === 'string' ? texteOuNull(valeur) : valeur
  }
  return corps
}

function valider(f: Formulaire): Erreurs {
  const e: Erreurs = {}
  if (!f.titre.trim()) e.titre = 'Le titre est obligatoire.'
  else if (f.titre.trim().length > LIMITES.titre) e.titre = `${LIMITES.titre} caractères au maximum.`
  if (f.slug && f.slug !== slugifier(f.slug)) e.slug = 'Lettres minuscules sans accent, chiffres et tirets uniquement.'
  if (f.resume.length > LIMITES.resume) e.resume = `${LIMITES.resume} caractères au maximum.`
  if (!f.contenu.trim()) e.contenu = 'Le contenu est obligatoire.'
  else if (f.contenu.length > LIMITES.contenu) e.contenu = `${LIMITES.contenu.toLocaleString('fr-FR')} caractères au maximum.`
  if (f.imageAlt.length > LIMITES.imageAlt) e.imageAlt = `${LIMITES.imageAlt} caractères au maximum.`
  if (f.imageCouverture && !f.imageAlt.trim()) e.imageAlt = "Décrivez l'image pour les personnes qui ne la voient pas."
  if (f.seoTitre.length > LIMITES.seoTitre) e.seoTitre = `${LIMITES.seoTitre} caractères au maximum.`
  if (f.seoDescription.length > LIMITES.seoDescription) e.seoDescription = `${LIMITES.seoDescription} caractères au maximum.`
  return e
}

function Compteur({ valeur, max }: { valeur: string; max: number }) {
  const depasse = valeur.length > max
  return (
    <span className={`text-xs tabular-nums ${depasse ? 'font-medium text-red-600' : 'text-stone-500'}`} aria-live="polite">
      {valeur.length} / {max}
    </span>
  )
}

/** Éditeur d'une publication (création si `publication` est absente). */
export function EditeurPublication({ publication }: { publication?: Publication }) {
  const router = useRouter()
  const client = useQueryClient()
  const categories = useCategories()
  const initial = depuisPublication(publication)
  const [form, setForm] = useState<Formulaire>(initial)
  const [slugManuel, setSlugManuel] = useState(!!publication)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)
  const [datePublication, setDatePublication] = useState(valeurChampDate(publication?.datePublication))
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false)

  const statut = publication?.statut ?? 'BROUILLON'
  const modifications = champsModifies(initial, form)
  const modifie = Object.keys(modifications).length > 0

  function maj<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) {
    setForm((f) => {
      const suivant = { ...f, [cle]: valeur }
      if (cle === 'titre' && !slugManuel) suivant.slug = slugifier(String(valeur))
      return suivant
    })
    if (erreurs[cle]) setErreurs((e) => ({ ...e, [cle]: undefined }))
  }

  const invalider = (id?: string) => {
    client.invalidateQueries({ queryKey: [...CLE_PUBLICATIONS, 'liste'] })
    if (id) client.invalidateQueries({ queryKey: [...CLE_PUBLICATIONS, 'detail', id] })
  }

  // Enregistre le formulaire (création ou champs modifiés) ; renvoie l'id.
  async function enregistrer(): Promise<string | null> {
    const trouvees = valider(form)
    setErreurs(trouvees)
    setErreurGlobale(null)
    if (Object.keys(trouvees).length > 0) {
      toast.error('Corrigez les champs signalés avant d’enregistrer.')
      return null
    }
    if (!publication) {
      const cree = await api<Publication>('/api/admin/publications', { method: 'POST', json: versCorps(form) })
      return cree.id
    }
    if (modifie) {
      await api(`/api/admin/publications/${publication.id}`, { method: 'PATCH', json: versCorps(modifications) })
    }
    return publication.id
  }

  const sauvegarde = useMutation({
    mutationFn: enregistrer,
    onSuccess: (id) => {
      if (!id) return
      invalider(id)
      if (!publication) {
        toast.success('Brouillon créé.')
        router.replace(`/admin/publications/${id}`)
      } else toast.success(modifie ? 'Modifications enregistrées.' : 'Aucune modification à enregistrer.')
    },
    onError: (e) => setErreurGlobale(messageErreur(e)),
  })

  const publier = useMutation({
    mutationFn: async () => {
      const id = await enregistrer()
      if (!id) return null
      await api(`/api/admin/publications/${id}/publier`, { method: 'POST', json: { datePublication: datePublication || null } })
      return id
    },
    onSuccess: (id) => {
      if (!id) return
      invalider(id)
      toast.success('Publication mise en ligne.')
      if (!publication) router.replace(`/admin/publications/${id}`)
    },
    onError: (e) => setErreurGlobale(messageErreur(e)),
  })

  const changerStatut = useMutation({
    mutationFn: (action: 'depublier' | 'archiver') =>
      api(`/api/admin/publications/${publication!.id}/${action}`, { method: 'POST' }),
    onSuccess: (_r, action) => {
      invalider(publication!.id)
      toast.success(action === 'archiver' ? 'Publication archivée.' : 'Publication retirée du site (brouillon).')
    },
    onError: (e) => setErreurGlobale(messageErreur(e)),
  })

  const supprimer = useMutation({
    mutationFn: () => api(`/api/admin/publications/${publication!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.removeQueries({ queryKey: [...CLE_PUBLICATIONS, 'detail', publication!.id] })
      invalider()
      toast.success('Publication supprimée.')
      router.replace('/admin/publications')
    },
    onError: (e) => setErreurGlobale(messageErreur(e)),
  })

  const occupe = sauvegarde.isPending || publier.isPending || changerStatut.isPending || supprimer.isPending

  async function demanderPublication() {
    const ok = await confirmer({
      titre: statut === 'PUBLIEE' ? 'Mettre à jour la publication en ligne ?' : 'Publier cette actualité ?',
      description: datePublication
        ? `L'actualité sera visible sur le site public à partir du ${dateLongue(datePublication)}.`
        : "L'actualité sera visible immédiatement par tous les visiteurs du site public.",
      labelConfirmer: 'Publier',
    })
    if (ok) publier.mutate()
  }

  async function demanderDepublication() {
    const ok = await confirmer({
      titre: 'Retirer cette actualité du site ?',
      description: "Elle redeviendra un brouillon et ne sera plus visible du public. Vous pourrez la republier à tout moment.",
      labelConfirmer: 'Dépublier',
      danger: true,
    })
    if (ok) changerStatut.mutate('depublier')
  }

  async function demanderArchivage() {
    const ok = await confirmer({
      titre: 'Archiver cette actualité ?',
      description:
        statut === 'PUBLIEE'
          ? "Elle sera retirée du site public et conservée dans les archives. Elle pourra ensuite être republiée ou supprimée."
          : 'Elle sera conservée dans les archives. Elle pourra ensuite être republiée ou supprimée.',
      labelConfirmer: 'Archiver',
      danger: statut === 'PUBLIEE',
    })
    if (ok) changerStatut.mutate('archiver')
  }

  async function demanderSuppression() {
    const ok = await confirmer({
      titre: 'Supprimer définitivement cette publication ?',
      description: `« ${publication!.titre} » sera supprimée définitivement. Cette action est irréversible.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (ok) supprimer.mutate()
  }

  return (
    <>
      <PageHeader
        titre={publication ? publication.titre : 'Nouvelle publication'}
        description={
          publication
            ? `Dernière modification : ${dateHeure(publication.updatedAt)}${publication.auteur ? ` · Auteur : ${publication.auteur.prenom} ${publication.auteur.nom}` : ''}`
            : 'Rédigez une actualité ; elle reste un brouillon tant que vous ne la publiez pas.'
        }
        miettes={miettesAdmin({ libelle: 'Publications', href: '/admin/publications' }, { libelle: publication ? 'Modifier' : 'Nouvelle' })}
        actions={
          statut === 'PUBLIEE' && publication ? (
            <a
              href={`/actualites/${publication.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Voir sur le site
              <span className="sr-only">(nouvel onglet)</span>
            </a>
          ) : undefined
        }
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          sauvegarde.mutate()
        }}
        className="space-y-6"
      >
        <Card>
          <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
              <StatusBadge valeur={statut} libelles={LABELS_STATUT_PUBLICATION} tons={TONS_STATUT_PUBLICATION} />
              {publication?.datePublication && <span>Date de publication : {dateLongue(publication.datePublication)}</span>}
              {modifie && <span className="text-amber-700">Modifications non enregistrées</span>}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <Field label="Date de publication" aide="Facultative : aujourd'hui par défaut." className="sm:w-48">
                {(p) => <Input {...p} type="date" value={datePublication} onChange={(e) => setDatePublication(e.target.value)} />}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variante="secondaire" icone={Check} chargement={sauvegarde.isPending} disabled={occupe}>
                  {statut === 'PUBLIEE' ? 'Enregistrer' : 'Enregistrer le brouillon'}
                </Button>
                <Button icone={Send} onClick={demanderPublication} chargement={publier.isPending} disabled={occupe}>
                  {statut === 'PUBLIEE' ? 'Mettre à jour en ligne' : 'Publier'}
                </Button>
              </div>
            </div>
          </CardBody>
          {publication && (
            <div className="flex flex-wrap gap-2 border-t border-stone-100 px-5 py-3">
              {statut === 'PUBLIEE' && (
                <Button variante="fantome" taille="sm" icone={EyeOff} onClick={demanderDepublication} disabled={occupe}>
                  Dépublier
                </Button>
              )}
              {statut !== 'ARCHIVEE' && (
                <Button variante="fantome" taille="sm" icone={Archive} onClick={demanderArchivage} disabled={occupe}>
                  Archiver
                </Button>
              )}
              {statut !== 'PUBLIEE' && (
                <Button
                  variante="fantome"
                  taille="sm"
                  icone={Trash2}
                  onClick={demanderSuppression}
                  disabled={occupe}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Supprimer
                </Button>
              )}
              {statut === 'PUBLIEE' && (
                <p className="self-center text-xs text-stone-500">Dépubliez ou archivez l&apos;actualité avant de pouvoir la supprimer.</p>
              )}
            </div>
          )}
        </Card>

        {erreurGlobale && (
          <Alert niveau="critique" titre="L'opération n'a pas abouti">
            {erreurGlobale}
          </Alert>
        )}

        <Card>
          <CardHeader titre="Contenu" />
          <CardBody className="space-y-5">
            <Field label="Titre" requis erreur={erreurs.titre}>
              {(p) => <Input {...p} value={form.titre} maxLength={LIMITES.titre} onChange={(e) => maj('titre', e.target.value)} />}
            </Field>
            <Field
              label="Identifiant d'URL (slug)"
              aide={`Adresse : /actualites/${form.slug || '…'} — généré depuis le titre, modifiable. Changer le slug d'une actualité publiée casse les liens déjà partagés.`}
              erreur={erreurs.slug}
            >
              {(p) => (
                <Input
                  {...p}
                  value={form.slug}
                  maxLength={LIMITES.slug}
                  onChange={(e) => {
                    setSlugManuel(true)
                    maj('slug', e.target.value)
                  }}
                  onBlur={() => form.slug && maj('slug', slugifier(form.slug))}
                />
              )}
            </Field>
            <Field label="Résumé" aide={`Chapeau affiché dans les listes (${LIMITES.resume} caractères au maximum).`} erreur={erreurs.resume}>
              {(p) => (
                <>
                  <Textarea {...p} rows={3} value={form.resume} onChange={(e) => maj('resume', e.target.value)} />
                  <div className="mt-1 text-right">
                    <Compteur valeur={form.resume} max={LIMITES.resume} />
                  </div>
                </>
              )}
            </Field>
            <EditeurTexte
              label="Texte de l'actualité"
              requis
              valeur={form.contenu}
              onChange={(v) => maj('contenu', v)}
              erreur={erreurs.contenu}
              max={LIMITES.contenu}
              lignes={20}
              apercu="cote"
            />
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader titre="Classement et illustration" />
            <CardBody className="space-y-5">
              <div className="flex items-end gap-2">
                <Field label="Catégorie" className="flex-1" aide={categories.isError ? messageErreur(categories.error) : undefined}>
                  {(p) => (
                    <Select
                      {...p}
                      value={form.categorieId}
                      onChange={(e) => maj('categorieId', e.target.value)}
                      vide="Sans catégorie"
                      options={(categories.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))}
                    />
                  )}
                </Field>
                <Button variante="secondaire" icone={Settings} onClick={() => setCategoriesOuvertes(true)} className={categories.isError ? 'mb-5' : ''}>
                  Gérer
                </Button>
              </div>
              <FileUpload
                label="Image de couverture"
                visibilite="publique"
                valeur={form.imageCouverture}
                onChange={(url) => maj('imageCouverture', url)}
                aide="JPEG, PNG ou WebP, 5 Mo au maximum. L'image sera publique."
              />
              <Field label="Texte alternatif de l'image" aide="Décrit l'image pour les lecteurs d'écran." erreur={erreurs.imageAlt} requis={!!form.imageCouverture}>
                {(p) => <Input {...p} value={form.imageAlt} maxLength={LIMITES.imageAlt} onChange={(e) => maj('imageAlt', e.target.value)} />}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader titre="Référencement (SEO)" description="Facultatif : titre et description affichés par les moteurs de recherche." />
            <CardBody className="space-y-5">
              <Field label="Titre SEO" erreur={erreurs.seoTitre} aide="Par défaut, le titre de l'actualité.">
                {(p) => (
                  <>
                    <Input {...p} value={form.seoTitre} onChange={(e) => maj('seoTitre', e.target.value)} />
                    <div className="mt-1 text-right">
                      <Compteur valeur={form.seoTitre} max={LIMITES.seoTitre} />
                    </div>
                  </>
                )}
              </Field>
              <Field label="Description SEO" erreur={erreurs.seoDescription} aide="Par défaut, le résumé.">
                {(p) => (
                  <>
                    <Textarea {...p} rows={3} value={form.seoDescription} onChange={(e) => maj('seoDescription', e.target.value)} />
                    <div className="mt-1 text-right">
                      <Compteur valeur={form.seoDescription} max={LIMITES.seoDescription} />
                    </div>
                  </>
                )}
              </Field>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <Link href="/admin/publications" className="self-center text-sm text-stone-600 hover:underline">
            Retour à la liste
          </Link>
          <Button type="submit" icone={Check} chargement={sauvegarde.isPending} disabled={occupe}>
            {statut === 'PUBLIEE' ? 'Enregistrer' : 'Enregistrer le brouillon'}
          </Button>
        </div>
      </form>

      <GestionCategories ouvert={categoriesOuvertes} onFermer={() => setCategoriesOuvertes(false)} />
    </>
  )
}
