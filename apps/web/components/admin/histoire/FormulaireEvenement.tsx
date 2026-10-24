'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LABELS_STATUT_VALIDATION_HISTORIQUE, LABELS_TYPE_EVENEMENT_HISTORIQUE } from '@scout/shared'
import { Alert, Button, Drawer, Field, FileUpload, Input, Select, Switch, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import { valeurChampDate } from '@/lib/format'
import { champsModifies, entierOuNull, messageErreur, texteOuNull } from '@/components/admin/commun'
import { EditeurTexte } from '@/components/admin/EditeurTexte'

export interface EvenementHistorique {
  id: string
  annee: number
  date: string | null
  titre: string
  description: string | null
  type: string
  auteurTemoignage: string | null
  imageUrl: string | null
  imageAlt: string | null
  documentUrl: string | null
  source: string | null
  statutValidation: 'A_VERIFIER' | 'VALIDE'
  publie: boolean
  ordre: number
  createdAt: string
  updatedAt: string
}

// Valeurs du formulaire (telles qu'envoyées à l'API).
interface Valeurs {
  annee: number | null
  date: string | null
  titre: string
  description: string | null
  type: string
  auteurTemoignage: string | null
  imageUrl: string | null
  imageAlt: string | null
  documentUrl: string | null
  source: string | null
  statutValidation: 'A_VERIFIER' | 'VALIDE'
  publie: boolean
  ordre: number
}

type Erreurs = Partial<Record<keyof Valeurs, string>>

// Année maximale acceptée par l'API (année en cours + 1), calculée au chargement du module.
const ANNEE_MAX = new Date().getFullYear() + 1

const OPTIONS_TYPE = Object.entries(LABELS_TYPE_EVENEMENT_HISTORIQUE).map(([valeur, libelle]) => ({ valeur, libelle }))
const OPTIONS_VALIDATION = Object.entries(LABELS_STATUT_VALIDATION_HISTORIQUE).map(([valeur, libelle]) => ({ valeur, libelle }))

function valeursInitiales(e: EvenementHistorique | null): Valeurs {
  return {
    annee: e?.annee ?? null,
    date: e?.date ? valeurChampDate(e.date) : null,
    titre: e?.titre ?? '',
    description: e?.description ?? null,
    type: e?.type ?? 'ETAPE',
    auteurTemoignage: e?.auteurTemoignage ?? null,
    imageUrl: e?.imageUrl ?? null,
    imageAlt: e?.imageAlt ?? null,
    documentUrl: e?.documentUrl ?? null,
    source: e?.source ?? null,
    statutValidation: e?.statutValidation ?? 'A_VERIFIER',
    publie: e?.publie ?? false,
    ordre: e?.ordre ?? 0,
  }
}

function valider(v: Valeurs): Erreurs {
  const erreurs: Erreurs = {}
  if (v.annee === null) erreurs.annee = "L'année est obligatoire."
  else if (v.annee < 1900 || v.annee > ANNEE_MAX) erreurs.annee = `L'année doit être comprise entre 1900 et ${ANNEE_MAX}.`
  if (!v.titre.trim()) erreurs.titre = 'Le titre est obligatoire.'
  else if (v.titre.length > 200) erreurs.titre = 'Le titre ne doit pas dépasser 200 caractères.'
  if ((v.description ?? '').length > 10000) erreurs.description = 'La description ne doit pas dépasser 10 000 caractères.'
  if ((v.auteurTemoignage ?? '').length > 150) erreurs.auteurTemoignage = '150 caractères au maximum.'
  if ((v.imageAlt ?? '').length > 200) erreurs.imageAlt = '200 caractères au maximum.'
  if ((v.source ?? '').length > 1000) erreurs.source = '1 000 caractères au maximum.'
  if (v.statutValidation === 'VALIDE' && !v.source?.trim()) erreurs.source = 'Indiquez la source qui confirme cet événement pour le marquer « Validé ».'
  if (v.imageUrl && !v.imageAlt?.trim()) erreurs.imageAlt = "Décrivez l'image pour les personnes qui ne la voient pas."
  if (!Number.isInteger(v.ordre) || v.ordre < 0 || v.ordre > 10000) erreurs.ordre = "L'ordre doit être un entier entre 0 et 10 000."
  return erreurs
}

// Prépare le corps : textes nettoyés (vide → null).
function normaliser(v: Valeurs): Valeurs {
  const t = (s: string | null) => (s === null ? null : texteOuNull(s))
  return {
    ...v,
    titre: v.titre.trim(),
    description: t(v.description),
    auteurTemoignage: t(v.auteurTemoignage),
    imageAlt: t(v.imageAlt),
    source: t(v.source),
  }
}

export function FormulaireEvenement({ evenement, onFermer }: { evenement: EvenementHistorique | null; onFermer: () => void }) {
  const client = useQueryClient()
  const [initial] = useState(() => valeursInitiales(evenement))
  const [v, setV] = useState<Valeurs>(initial)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)

  const maj = <K extends keyof Valeurs>(cle: K, valeur: Valeurs[K]) => setV((p) => ({ ...p, [cle]: valeur }))

  const enregistrement = useMutation({
    mutationFn: (corps: Partial<Valeurs>) =>
      evenement
        ? api<EvenementHistorique>(`/api/admin/histoire/${evenement.id}`, { method: 'PATCH', json: corps })
        : api<EvenementHistorique>('/api/admin/histoire', { method: 'POST', json: corps }),
    onSuccess: () => {
      toast.success(evenement ? 'Événement mis à jour.' : 'Événement ajouté à la frise.')
      client.invalidateQueries({ queryKey: ['admin', 'histoire'] })
      onFermer()
    },
    onError: (e) => setErreurServeur(messageErreur(e)),
  })

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreurServeur(null)
    const trouvees = valider(v)
    setErreurs(trouvees)
    if (Object.keys(trouvees).length > 0) {
      toast.error('Corrigez les champs signalés.')
      return
    }
    const courant = normaliser(v)
    const corps = evenement ? champsModifies(normaliser(initial), courant) : courant
    if (evenement && Object.keys(corps).length === 0) {
      toast.info('Aucune modification à enregistrer.')
      return
    }
    enregistrement.mutate(corps)
  }

  const idFormulaire = 'formulaire-evenement-historique'

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      taille="lg"
      titre={evenement ? "Modifier l'événement" : 'Nouvel événement'}
      description="Les champs marqués d'un astérisque sont obligatoires."
      pied={
        <>
          <Button variante="secondaire" onClick={onFermer}>
            Annuler
          </Button>
          <Button type="submit" form={idFormulaire} chargement={enregistrement.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id={idFormulaire} onSubmit={soumettre} noValidate className="space-y-5">
        {erreurServeur && <Alert niveau="critique">{erreurServeur}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Année" requis erreur={erreurs.annee}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={1900}
                max={ANNEE_MAX}
                value={v.annee ?? ''}
                onChange={(e) => maj('annee', entierOuNull(e.target.value))}
              />
            )}
          </Field>
          <Field label="Date précise" aide="Facultative, si elle est connue.">
            {(p) => <Input {...p} type="date" value={v.date ?? ''} onChange={(e) => maj('date', e.target.value || null)} />}
          </Field>
        </div>

        <Field label="Titre" requis erreur={erreurs.titre}>
          {(p) => <Input {...p} maxLength={200} value={v.titre} onChange={(e) => maj('titre', e.target.value)} />}
        </Field>

        <Field label="Type d'événement">
          {(p) => <Select {...p} options={OPTIONS_TYPE} value={v.type} onChange={(e) => maj('type', e.target.value)} />}
        </Field>

        {(v.type === 'TEMOIGNAGE' || v.auteurTemoignage) && (
          <Field label="Auteur du témoignage" erreur={erreurs.auteurTemoignage} aide="Nom et qualité de la personne, avec son accord.">
            {(p) => (
              <Input {...p} maxLength={150} value={v.auteurTemoignage ?? ''} onChange={(e) => maj('auteurTemoignage', e.target.value)} />
            )}
          </Field>
        )}

        <EditeurTexte
          label="Description"
          valeur={v.description ?? ''}
          onChange={(t) => maj('description', t)}
          erreur={erreurs.description}
          max={10000}
          lignes={8}
          apercu="dessous"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FileUpload label="Image" visibilite="publique" valeur={v.imageUrl} onChange={(url) => maj('imageUrl', url)} />
          </div>
          <FileUpload
            label="Document d'archive"
            visibilite="publique"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            apercu={false}
            valeur={v.documentUrl}
            onChange={(url) => maj('documentUrl', url)}
            aide="Image ou PDF, 5 Mo maximum. Le document sera consultable publiquement si l'événement est publié."
          />
        </div>
        {v.documentUrl && (
          <p className="-mt-3 text-xs text-stone-600">
            Document joint :{' '}
            <a href={v.documentUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primaire hover:underline">
              ouvrir
            </a>
          </p>
        )}
        {v.imageUrl && (
          <Field label="Texte alternatif de l'image" requis erreur={erreurs.imageAlt}>
            {(p) => <Input {...p} maxLength={200} value={v.imageAlt ?? ''} onChange={(e) => maj('imageAlt', e.target.value)} />}
          </Field>
        )}

        <fieldset className="space-y-4 rounded-lg border border-stone-200 p-4">
          <legend className="px-1 text-sm font-semibold text-stone-800">Validation et publication</legend>
          <Field label="Source" erreur={erreurs.source} aide="Archive, registre paroissial, témoignage recueilli (qui, quand)…">
            {(p) => <Textarea {...p} rows={3} maxLength={1000} value={v.source ?? ''} onChange={(e) => maj('source', e.target.value)} />}
          </Field>
          <Field label="Statut de validation">
            {(p) => (
              <Select
                {...p}
                options={OPTIONS_VALIDATION}
                value={v.statutValidation}
                onChange={(e) => maj('statutValidation', e.target.value as Valeurs['statutValidation'])}
              />
            )}
          </Field>
          <Switch
            checked={v.publie}
            onChange={(b) => maj('publie', b)}
            label="Publier sur le site"
            description={
              v.statutValidation === 'VALIDE'
                ? "L'événement apparaîtra sur la frise publique."
                : "L'événement apparaîtra avec la mention « À confirmer par les archives »."
            }
          />
          <Field label="Ordre dans l'année" erreur={erreurs.ordre} aide="Départage les événements d'une même année (0 en premier).">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                max={10000}
                value={v.ordre}
                onChange={(e) => maj('ordre', entierOuNull(e.target.value) ?? 0)}
                className="max-w-32"
              />
            )}
          </Field>
        </fieldset>
      </form>
    </Drawer>
  )
}
