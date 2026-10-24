'use client'

import { useState } from 'react'
import { slugifier } from '@scout/shared'
import { Alert, Field, Input, Select, Switch, Textarea } from '@/components/ui'
import { dateCourte, valeurChampDate } from '@/lib/format'
import { champsModifies, messageErreur, statutErreur, texteOuNull } from '@/components/admin/commun'
import { useActivitesLiables, type Album } from './donnees'

export interface ChampsAlbum {
  titre: string
  slug: string
  description: string
  categorie: string
  dateEvenement: string
  activiteId: string
  publie: boolean
}

type Erreurs = Partial<Record<keyof ChampsAlbum, string>>

export function champsDepuisAlbum(album?: Album): ChampsAlbum {
  return {
    titre: album?.titre ?? '',
    slug: album?.slug ?? '',
    description: album?.description ?? '',
    categorie: album?.categorie ?? '',
    dateEvenement: valeurChampDate(album?.dateEvenement),
    activiteId: album?.activiteId ?? '',
    publie: album?.publie ?? false,
  }
}

/** Corps de requête : création (tous les champs) ou modification (champs modifiés). */
export function corpsAlbum(initial: ChampsAlbum, courant: ChampsAlbum, creation: boolean): Record<string, unknown> {
  const source = creation ? courant : champsModifies(initial, courant)
  const corps: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(source)) {
    if (cle === 'publie') corps[cle] = valeur
    else if (cle === 'titre') corps[cle] = String(valeur).trim()
    else corps[cle] = texteOuNull(String(valeur))
  }
  return corps
}

export function validerAlbum(c: ChampsAlbum): Erreurs {
  const e: Erreurs = {}
  if (!c.titre.trim()) e.titre = 'Le titre est obligatoire.'
  else if (c.titre.trim().length > 150) e.titre = '150 caractères au maximum.'
  if (c.slug && c.slug !== slugifier(c.slug)) e.slug = 'Lettres minuscules sans accent, chiffres et tirets uniquement.'
  if (c.description.length > 2000) e.description = '2 000 caractères au maximum.'
  if (c.categorie.length > 80) e.categorie = '80 caractères au maximum.'
  return e
}

/**
 * Champs d'un album (création ou modification). L'état est tenu par le
 * parent ; la soumission est déclenchée par le formulaire `idFormulaire`.
 */
export function FormulaireAlbum({
  idFormulaire,
  valeurs,
  onChange,
  erreurs,
  album,
  onSoumettre,
}: {
  idFormulaire: string
  valeurs: ChampsAlbum
  onChange: (valeurs: ChampsAlbum) => void
  erreurs: Erreurs
  album?: Album
  onSoumettre: () => void
}) {
  const [slugManuel, setSlugManuel] = useState(!!album)
  const activites = useActivitesLiables()

  function maj<K extends keyof ChampsAlbum>(cle: K, valeur: ChampsAlbum[K]) {
    const suivant = { ...valeurs, [cle]: valeur }
    if (cle === 'titre' && !slugManuel) suivant.slug = slugifier(String(valeur))
    onChange(suivant)
  }

  const optionsActivites = (activites.data?.activites ?? []).map((a) => ({ valeur: a.id, libelle: `${a.titre} — ${dateCourte(a.dateDebut)}` }))
  // L'activité déjà liée reste proposée même si elle n'est plus dans la liste.
  if (album?.activite && !optionsActivites.some((o) => o.valeur === album.activite!.id)) {
    optionsActivites.unshift({ valeur: album.activite.id, libelle: `${album.activite.titre} — ${dateCourte(album.activite.dateDebut)}` })
  }

  return (
    <form
      id={idFormulaire}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onSoumettre()
      }}
      className="space-y-4"
    >
      <Field label="Titre de l'album" requis erreur={erreurs.titre}>
        {(p) => <Input {...p} value={valeurs.titre} maxLength={150} onChange={(e) => maj('titre', e.target.value)} />}
      </Field>
      <Field label="Identifiant d'URL (slug)" aide={`Adresse publique : /galerie/${valeurs.slug || '…'}`} erreur={erreurs.slug}>
        {(p) => (
          <Input
            {...p}
            value={valeurs.slug}
            maxLength={80}
            onChange={(e) => {
              setSlugManuel(true)
              maj('slug', e.target.value)
            }}
            onBlur={() => valeurs.slug && maj('slug', slugifier(valeurs.slug))}
          />
        )}
      </Field>
      <Field label="Description" erreur={erreurs.description}>
        {(p) => <Textarea {...p} rows={3} value={valeurs.description} maxLength={2000} onChange={(e) => maj('description', e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie" aide="Ex. : Camp, Célébration, Service." erreur={erreurs.categorie}>
          {(p) => <Input {...p} value={valeurs.categorie} maxLength={80} onChange={(e) => maj('categorie', e.target.value)} />}
        </Field>
        <Field label="Date de l'événement">
          {(p) => <Input {...p} type="date" value={valeurs.dateEvenement} onChange={(e) => maj('dateEvenement', e.target.value)} />}
        </Field>
      </div>

      {activites.isError ? (
        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">Activité liée</p>
          <p className="text-sm text-stone-700">{album?.activite ? `${album.activite.titre} — ${dateCourte(album.activite.dateDebut)}` : 'Aucune'}</p>
          <p className="mt-1 text-xs text-stone-500">
            {statutErreur(activites.error) === 403
              ? 'La liste des activités est réservée à la maîtrise : le lien vers une activité ne peut pas être modifié depuis ce compte.'
              : `Liste des activités indisponible : ${messageErreur(activites.error)}`}
          </p>
        </div>
      ) : (
        <Field label="Activité liée (facultatif)" aide={activites.isPending ? 'Chargement des activités…' : undefined}>
          {(p) => (
            <Select
              {...p}
              value={valeurs.activiteId}
              disabled={activites.isPending}
              onChange={(e) => maj('activiteId', e.target.value)}
              vide="Aucune activité"
              options={optionsActivites}
            />
          )}
        </Field>
      )}

      <Switch
        checked={valeurs.publie}
        onChange={(v) => maj('publie', v)}
        label="Album publié"
        description="Seules les photos publiées (et, pour les mineurs, aux consentements vérifiés) d'un album publié sont visibles sur le site."
      />
      {valeurs.publie && !album && (
        <Alert niveau="info">Un album sans photo publiée n&apos;apparaît pas sur le site public.</Alert>
      )}
    </form>
  )
}
