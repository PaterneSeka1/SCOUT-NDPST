'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ORDRE_BRANCHES } from '@scout/shared'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChargementPage,
  EmptyState,
  ErrorState,
  Field,
  FileUpload,
  Input,
  PageHeader,
  Switch,
  Tabs,
} from '@/components/ui'
import { api } from '@/lib/api'
import { ExternalLink, Leaf } from '@/lib/icons'
import { champsModifies, entierOuNull, messageErreur, miettesAdmin, texteOuNull } from '@/components/admin/commun'
import { EditeurTexte } from '@/components/admin/EditeurTexte'

interface Branche {
  id: string
  type: string
  slug: string
  presentation: string | null
  identite: string | null
  objectifs: string | null
  pedagogie: string | null
  activitesTypes: string | null
  imageUrl: string | null
  imageAlt: string | null
  active: boolean
  publiee: boolean
  ordre: number
  updatedAt: string
}

type Valeurs = Omit<Branche, 'id' | 'type' | 'slug' | 'updatedAt'>
type CleTexte = 'presentation' | 'identite' | 'objectifs' | 'pedagogie' | 'activitesTypes'

const TEXTES: { cle: CleTexte; libelle: string; max: number; aide: string }[] = [
  { cle: 'presentation', libelle: 'Présentation', max: 5000, aide: 'Texte d’introduction de la branche.' },
  { cle: 'identite', libelle: 'Identité', max: 3000, aide: 'Devise, symboles, couleurs.' },
  { cle: 'objectifs', libelle: 'Objectifs', max: 5000, aide: 'Objectifs éducatifs de la branche.' },
  { cle: 'pedagogie', libelle: 'Pédagogie', max: 5000, aide: 'Méthode et vie de la branche.' },
  { cle: 'activitesTypes', libelle: 'Activités types', max: 5000, aide: 'Exemples d’activités menées.' },
]

const CLE = ['admin', 'branches'] as const

function rang(type: string): number {
  const i = ORDRE_BRANCHES.indexOf(type)
  return i === -1 ? ORDRE_BRANCHES.length : i
}

export function BranchesAdmin() {
  const requete = useQuery({ queryKey: CLE, queryFn: () => api<Branche[]>('/api/admin/branches') })
  const branches = requete.data ? [...requete.data].sort((a, b) => a.ordre - b.ordre || rang(a.type) - rang(b.type)) : undefined
  const [choix, setChoix] = useState<string | null>(null)
  const active = branches?.find((b) => b.type === choix) ?? branches?.[0]

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Présentation des branches"
        description="Textes institutionnels affichés sur le site public pour chaque branche du groupe."
        miettes={miettesAdmin({ libelle: 'Présentation des branches' })}
      />

      <Alert niveau="attention" titre="Textes officiels uniquement">
        Utilisez uniquement les textes officiels validés par le groupe.
      </Alert>

      {requete.isPending ? (
        <ChargementPage libelle="Chargement des branches…" />
      ) : requete.isError ? (
        <Card>
          <ErrorState message={messageErreur(requete.error)} onReessayer={() => requete.refetch()} />
        </Card>
      ) : !branches || branches.length === 0 || !active ? (
        <Card>
          <EmptyState
            icon={Leaf}
            title="Aucune branche n'est configurée"
            description="Le référentiel des branches est créé lors de l'initialisation de la plateforme. Contactez l'équipe technique."
          />
        </Card>
      ) : (
        <>
          <Tabs
            label="Branches"
            actif={active.type}
            onChange={setChoix}
            onglets={branches.map((b) => ({ valeur: b.type, libelle: LABELS_BRANCHES[b.type] ?? b.type }))}
          />
          <div role="tabpanel" aria-label={LABELS_BRANCHES[active.type] ?? active.type}>
            <FormulaireBranche key={`${active.type}-${active.updatedAt}`} branche={active} />
          </div>
        </>
      )}
    </div>
  )
}

function valeursDe(b: Branche): Valeurs {
  return {
    presentation: b.presentation ?? '',
    identite: b.identite ?? '',
    objectifs: b.objectifs ?? '',
    pedagogie: b.pedagogie ?? '',
    activitesTypes: b.activitesTypes ?? '',
    imageUrl: b.imageUrl,
    imageAlt: b.imageAlt ?? '',
    active: b.active,
    publiee: b.publiee,
    ordre: b.ordre,
  }
}

function FormulaireBranche({ branche }: { branche: Branche }) {
  const client = useQueryClient()
  const [initial] = useState(() => valeursDe(branche))
  const [v, setV] = useState<Valeurs>(initial)
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Valeurs, string>>>({})
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)
  const nom = LABELS_BRANCHES[branche.type] ?? branche.type

  const maj = <K extends keyof Valeurs>(cle: K, valeur: Valeurs[K]) => setV((p) => ({ ...p, [cle]: valeur }))

  const enregistrement = useMutation({
    mutationFn: (corps: Partial<Valeurs>) => api<Branche>(`/api/admin/branches/${branche.type}`, { method: 'PATCH', json: corps }),
    onSuccess: () => {
      toast.success(`Présentation de la branche ${nom} enregistrée.`)
      client.invalidateQueries({ queryKey: CLE })
    },
    onError: (e) => setErreurServeur(messageErreur(e)),
  })

  const modifications = champsModifies(initial, v)
  const modifie = Object.keys(modifications).length > 0

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreurServeur(null)
    const trouvees: Partial<Record<keyof Valeurs, string>> = {}
    for (const t of TEXTES) {
      if ((v[t.cle] ?? '').length > t.max) trouvees[t.cle] = `${t.max.toLocaleString('fr-FR')} caractères au maximum.`
    }
    if ((v.imageAlt ?? '').length > 200) trouvees.imageAlt = '200 caractères au maximum.'
    if (v.imageUrl && !v.imageAlt?.trim()) trouvees.imageAlt = "Décrivez l'image pour les personnes qui ne la voient pas."
    if (!Number.isInteger(v.ordre) || v.ordre < 0 || v.ordre > 100) trouvees.ordre = "L'ordre doit être un entier entre 0 et 100."
    setErreurs(trouvees)
    if (Object.keys(trouvees).length > 0) {
      toast.error('Corrigez les champs signalés.')
      return
    }
    if (!modifie) {
      toast.info('Aucune modification à enregistrer.')
      return
    }
    // Textes vides → null (effacement) ; seuls les champs modifiés sont envoyés.
    const corps: Record<string, unknown> = {}
    for (const [cle, valeur] of Object.entries(modifications)) {
      corps[cle] = typeof valeur === 'string' ? texteOuNull(valeur) : valeur
    }
    enregistrement.mutate(corps as Partial<Valeurs>)
  }

  return (
    <form onSubmit={soumettre} noValidate className="mt-4 space-y-6">
      {erreurServeur && <Alert niveau="critique">{erreurServeur}</Alert>}

      <Card>
        <CardHeader
          titre={nom}
          description={`Adresse publique : /branches/${branche.slug}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {branche.publiee ? <Badge ton="succes">Publiée</Badge> : <Badge ton="neutre">Non publiée</Badge>}
              {!branche.active && <Badge ton="attention">Inactive</Badge>}
              {branche.publiee && (
                <a
                  href={`/branches/${branche.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primaire hover:underline"
                >
                  Voir sur le site <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">(nouvel onglet)</span>
                </a>
              )}
            </div>
          }
        />
        <CardBody className="space-y-6">
          {TEXTES.map((t) => (
            <EditeurTexte
              key={t.cle}
              label={t.libelle}
              aide={t.aide}
              valeur={v[t.cle] ?? ''}
              onChange={(texte) => maj(t.cle, texte)}
              erreur={erreurs[t.cle]}
              max={t.max}
              lignes={6}
              apercu="dessous"
            />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader titre="Image et affichage" />
        <CardBody className="space-y-5">
          <FileUpload
            label="Image de la branche"
            visibilite="publique"
            valeur={v.imageUrl}
            onChange={(url) => maj('imageUrl', url)}
            aide="Évitez les visages d'enfants reconnaissables sans consentement à l'image vérifié."
          />
          {v.imageUrl && (
            <Field label="Texte alternatif de l'image" requis erreur={erreurs.imageAlt}>
              {(p) => <Input {...p} maxLength={200} value={v.imageAlt ?? ''} onChange={(e) => maj('imageAlt', e.target.value)} />}
            </Field>
          )}
          <Switch
            checked={v.active}
            onChange={(b) => maj('active', b)}
            label="Branche active dans le groupe"
            description="Une branche inactive n'est pas proposée dans les formulaires."
          />
          <Switch
            checked={v.publiee}
            onChange={(b) => maj('publiee', b)}
            label="Publiée sur le site"
            description="La présentation est visible par tous les visiteurs."
          />
          <Field label="Ordre d'affichage" erreur={erreurs.ordre} aide="De 0 à 100, les plus petits en premier.">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                max={100}
                value={v.ordre}
                onChange={(e) => maj('ordre', entierOuNull(e.target.value) ?? 0)}
                className="max-w-32"
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {modifie && <p className="mr-auto text-sm text-amber-800">Modifications non enregistrées.</p>}
        <Button variante="secondaire" disabled={!modifie || enregistrement.isPending} onClick={() => setV(initial)}>
          Annuler les modifications
        </Button>
        <Button type="submit" chargement={enregistrement.isPending} disabled={!modifie}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
