'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { slugifier } from '@scout/shared'
import { Button, Drawer, EmptyState, ErrorState, Field, Input, Skeleton, confirmer } from '@/components/ui'
import { Check, Pencil, Plus, Trash2, X, Newspaper } from '@/lib/icons'
import { api } from '@/lib/api'
import { messageErreur } from '@/components/admin/commun'
import { CLE_CATEGORIES, CLE_PUBLICATIONS, useCategories, type Categorie } from './donnees'

function LigneCategorie({ categorie }: { categorie: Categorie }) {
  const client = useQueryClient()
  const [edition, setEdition] = useState(false)
  const [nom, setNom] = useState(categorie.nom)
  const [erreur, setErreur] = useState<string | null>(null)

  const invalider = () => {
    client.invalidateQueries({ queryKey: CLE_CATEGORIES })
    client.invalidateQueries({ queryKey: CLE_PUBLICATIONS })
  }

  const renommer = useMutation({
    mutationFn: (valeur: string) => api(`/api/admin/categories/${categorie.id}`, { method: 'PATCH', json: { nom: valeur } }),
    onSuccess: () => {
      toast.success('Catégorie renommée.')
      setEdition(false)
      invalider()
    },
    onError: (e) => setErreur(messageErreur(e)),
  })

  const supprimer = useMutation({
    mutationFn: () => api(`/api/admin/categories/${categorie.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Catégorie supprimée.')
      invalider()
    },
    onError: (e) => toast.error(messageErreur(e)),
  })

  const nombre = categorie._count?.publications ?? 0

  async function demanderSuppression() {
    const ok = await confirmer({
      titre: `Supprimer la catégorie « ${categorie.nom} » ?`,
      description:
        nombre > 0
          ? `${nombre} publication${nombre > 1 ? 's sont rattachées' : ' est rattachée'} à cette catégorie : elle${nombre > 1 ? 's seront conservées' : ' sera conservée'}, mais sans catégorie.`
          : 'Aucune publication n’est rattachée à cette catégorie. Cette suppression est définitive.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (ok) supprimer.mutate()
  }

  function valider(e: React.FormEvent) {
    e.preventDefault()
    const valeur = nom.trim()
    if (!valeur) return setErreur('Le nom est obligatoire.')
    if (valeur.length > 80) return setErreur('80 caractères au maximum.')
    setErreur(null)
    renommer.mutate(valeur)
  }

  if (edition) {
    return (
      <li className="py-3">
        <form onSubmit={valider} className="flex items-start gap-2">
          <Field label={`Nouveau nom de « ${categorie.nom} »`} erreur={erreur} className="flex-1">
            {(p) => <Input {...p} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} autoFocus />}
          </Field>
          <div className="mt-7 flex gap-1">
            <Button type="submit" taille="sm" icone={Check} chargement={renommer.isPending} aria-label="Enregistrer le nom" />
            <Button
              taille="sm"
              variante="fantome"
              icone={X}
              aria-label="Annuler"
              onClick={() => {
                setNom(categorie.nom)
                setErreur(null)
                setEdition(false)
              }}
            />
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">{categorie.nom}</p>
        <p className="text-xs text-stone-500">
          {nombre} publication{nombre > 1 ? 's' : ''} · /{categorie.slug}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button taille="sm" variante="fantome" icone={Pencil} onClick={() => setEdition(true)} aria-label={`Renommer ${categorie.nom}`} />
        <Button
          taille="sm"
          variante="fantome"
          icone={Trash2}
          chargement={supprimer.isPending}
          onClick={demanderSuppression}
          aria-label={`Supprimer ${categorie.nom}`}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        />
      </div>
    </li>
  )
}

/** Tiroir de gestion des catégories d'actualités. */
export function GestionCategories({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const client = useQueryClient()
  const categories = useCategories()
  const [nom, setNom] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuel, setSlugManuel] = useState(false)
  const [erreurs, setErreurs] = useState<{ nom?: string; slug?: string; global?: string }>({})

  const creer = useMutation({
    mutationFn: () => api<Categorie>('/api/admin/categories', { method: 'POST', json: { nom: nom.trim(), slug: slug.trim() || null } }),
    onSuccess: (c) => {
      toast.success(`Catégorie « ${c.nom} » créée.`)
      setNom('')
      setSlug('')
      setSlugManuel(false)
      client.invalidateQueries({ queryKey: CLE_CATEGORIES })
    },
    onError: (e) => setErreurs({ global: messageErreur(e) }),
  })

  function valider(e: React.FormEvent) {
    e.preventDefault()
    const suivantes: typeof erreurs = {}
    if (!nom.trim()) suivantes.nom = 'Le nom est obligatoire.'
    else if (nom.trim().length > 80) suivantes.nom = '80 caractères au maximum.'
    if (slug && slug !== slugifier(slug)) suivantes.slug = 'Lettres minuscules, chiffres et tirets uniquement.'
    setErreurs(suivantes)
    if (Object.keys(suivantes).length === 0) creer.mutate()
  }

  return (
    <Drawer ouvert={ouvert} onFermer={onFermer} titre="Catégories d'actualités" description="Classez les publications du site public.">
      <form onSubmit={valider} className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/60 p-4" noValidate>
        <Field label="Nom de la catégorie" requis erreur={erreurs.nom}>
          {(p) => (
            <Input
              {...p}
              value={nom}
              maxLength={80}
              onChange={(e) => {
                setNom(e.target.value)
                if (!slugManuel) setSlug(slugifier(e.target.value))
              }}
            />
          )}
        </Field>
        <Field label="Identifiant d'URL (slug)" aide="Généré automatiquement ; modifiable." erreur={erreurs.slug}>
          {(p) => (
            <Input
              {...p}
              value={slug}
              maxLength={80}
              onChange={(e) => {
                setSlugManuel(true)
                setSlug(e.target.value)
              }}
            />
          )}
        </Field>
        {erreurs.global && (
          <p role="alert" className="text-sm text-red-600">
            {erreurs.global}
          </p>
        )}
        <Button type="submit" icone={Plus} chargement={creer.isPending}>
          Ajouter la catégorie
        </Button>
      </form>

      <div className="mt-5">
        {categories.isPending ? (
          <div className="space-y-2" role="status" aria-label="Chargement des catégories">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : categories.isError ? (
          <ErrorState message={messageErreur(categories.error)} onReessayer={() => categories.refetch()} />
        ) : categories.data.length === 0 ? (
          <EmptyState icon={Newspaper} title="Aucune catégorie." description="Créez une première catégorie ci-dessus." />
        ) : (
          <ul className="divide-y divide-stone-100" aria-label="Catégories existantes">
            {categories.data.map((c) => (
              <LigneCategorie key={`${c.id}-${c.nom}`} categorie={c} />
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  )
}
