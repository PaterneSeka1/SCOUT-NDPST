'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ORDRE_CATEGORIES_SCOUTS, ROLES_BRANCHE } from '@scout/shared'
import { useModifierScout, useScout, type FicheScout } from '@/hooks/useScouts'
import { useEquipes } from '@/hooks/useEquipes'
import { useSession } from '@/lib/session-client'
import { dateCourte, valeurChampDate } from '@/lib/format'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ChargementPage,
  Checkbox,
  ErrorState,
  Field,
  FileUpload,
  Input,
  PageHeader,
  Select,
  Switch,
  Textarea,
  confirmer,
} from '@/components/ui'

const OPTIONS_BRANCHES = ORDRE_CATEGORIES_SCOUTS.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))
const OPTIONS_SEXE = [
  { valeur: 'MASCULIN', libelle: 'Garçon' },
  { valeur: 'FEMININ', libelle: 'Fille' },
]

export default function PageModifierScout() {
  const { id } = useParams<{ id: string }>()
  const { data: scout, isLoading, error, refetch } = useScout(id)

  if (isLoading) return <ChargementPage />
  if (error || !scout) {
    return (
      <>
        <PageHeader
          titre="Modifier le scout"
          miettes={[
            { libelle: 'Tableau de bord', href: '/dashboard' },
            { libelle: 'Scouts', href: '/dashboard/scouts' },
            { libelle: 'Modification' },
          ]}
        />
        <Card>
          <ErrorState message={error?.message ?? 'Scout introuvable.'} onReessayer={() => refetch()} />
        </Card>
      </>
    )
  }
  return <Formulaire key={scout.id} scout={scout} />
}

function Formulaire({ scout }: { scout: FicheScout }) {
  const router = useRouter()
  const modifier = useModifierScout(scout.id)
  const { data: session } = useSession()
  // Le changement de branche est réservé au groupe (l'API le refuse à l'encadrement de branche).
  const brancheVerrouillee = ROLES_BRANCHE.includes(session?.user.role ?? '')

  const [form, setForm] = useState({
    nom: scout.nom,
    prenom: scout.prenom,
    dateNaissance: valeurChampDate(scout.dateNaissance),
    sexe: scout.sexe,
    brancheType: scout.brancheType,
    equipeId: scout.equipeId ?? '',
    allergies: scout.allergies ?? '',
    traitementsMedicaux: scout.traitementsMedicaux ?? '',
  })
  const [actif, setActif] = useState(scout.actif)
  const [photo, setPhoto] = useState<string | null>(scout.photo)
  const [consentementImage, setConsentementImage] = useState(scout.consentementImage)
  const [consentementSante, setConsentementSante] = useState(scout.consentementSante)

  const equipes = useEquipes({ brancheType: form.brancheType, actif: true })
  // L'équipe actuelle peut être désactivée : on la garde dans la liste pour l'affichage.
  const optionsEquipes = [
    ...(equipes.data ?? []).map((e) => ({ valeur: e.id, libelle: e.nom })),
    ...(scout.equipe && scout.equipe.actif === false && form.equipeId === scout.equipe.id
      ? [{ valeur: scout.equipe.id, libelle: `${scout.equipe.nom} (désactivée)` }]
      : []),
  ]

  const champ = (cle: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [cle]: e.target.value }))

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim() || !form.prenom.trim() || !form.dateNaissance) {
      toast.error('Le nom, le prénom et la date de naissance sont requis.')
      return
    }
    if (form.brancheType !== scout.brancheType) {
      const ok = await confirmer({
        titre: 'Changer de branche ?',
        description: `${scout.prenom} ${scout.nom} passera en ${LABELS_BRANCHES[form.brancheType]}. Pour un passage de fin d'année, préférez l'outil « Passage de branche ».`,
        labelConfirmer: 'Changer de branche',
      })
      if (!ok) return
    }
    if (!actif && scout.actif) {
      const ok = await confirmer({
        titre: 'Désactiver ce scout ?',
        description: "Il n'apparaîtra plus dans les effectifs actifs. Sa fiche et son historique sont conservés.",
        labelConfirmer: 'Désactiver',
        danger: true,
      })
      if (!ok) return
    }
    try {
      await modifier.mutateAsync({
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        dateNaissance: form.dateNaissance,
        sexe: form.sexe,
        ...(form.brancheType !== scout.brancheType ? { brancheType: form.brancheType } : {}),
        equipeId: form.equipeId || null,
        actif,
        photo,
        allergies: form.allergies,
        traitementsMedicaux: form.traitementsMedicaux,
        // Une simple correction de fiche ne renouvelle pas la déclaration
        // parentale (date, auteur, provenance).
        ...(consentementImage !== scout.consentementImage ? { consentementImage } : {}),
        ...(consentementSante !== scout.consentementSante ? { consentementSante } : {}),
      })
      toast.success('Modifications enregistrées.')
      router.push(`/dashboard/scouts/${scout.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enregistrement impossible.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titre={`Modifier ${scout.prenom} ${scout.nom}`}
        miettes={[
          { libelle: 'Tableau de bord', href: '/dashboard' },
          { libelle: 'Scouts', href: '/dashboard/scouts' },
          { libelle: `${scout.prenom} ${scout.nom}`, href: `/dashboard/scouts/${scout.id}` },
          { libelle: 'Modification' },
        ]}
      />

      <form onSubmit={soumettre} className="space-y-6">
        <Card>
          <CardHeader titre="Identité et rattachement" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom" requis>
              {(p) => <Input {...p} value={form.nom} onChange={champ('nom')} />}
            </Field>
            <Field label="Prénom" requis>
              {(p) => <Input {...p} value={form.prenom} onChange={champ('prenom')} />}
            </Field>
            <Field label="Date de naissance" requis>
              {(p) => <Input {...p} type="date" value={form.dateNaissance} onChange={champ('dateNaissance')} />}
            </Field>
            <Field label="Sexe" requis>
              {(p) => <Select {...p} value={form.sexe} onChange={champ('sexe')} options={OPTIONS_SEXE} />}
            </Field>
            <Field label="Branche" requis aide={brancheVerrouillee ? 'Le changement de branche est réservé au groupe.' : undefined}>
              {(p) => (
                <Select
                  {...p}
                  value={form.brancheType}
                  disabled={brancheVerrouillee}
                  onChange={(e) => setForm((f) => ({ ...f, brancheType: e.target.value, equipeId: '' }))}
                  options={OPTIONS_BRANCHES}
                />
              )}
            </Field>
            <Field label="Équipe" aide={equipes.data?.length === 0 ? 'Aucune équipe active dans cette branche.' : 'Facultative.'}>
              {(p) => (
                <Select {...p} value={form.equipeId} disabled={equipes.isLoading} onChange={champ('equipeId')} vide="Aucune équipe" options={optionsEquipes} />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Switch
                checked={actif}
                onChange={setActif}
                label="Scout actif"
                description="Un scout inactif n'apparaît plus dans les effectifs, les présences et les cotisations à venir."
              />
            </div>
            <div className="sm:col-span-2">
              <FileUpload label="Photo" aide="JPEG, PNG ou WebP, 5 Mo maximum." valeur={photo} onChange={setPhoto} visibilite="privee" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader titre="Informations médicales" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Allergies">
              {(p) => <Textarea {...p} rows={2} value={form.allergies} onChange={champ('allergies')} />}
            </Field>
            <Field label="Traitements en cours">
              {(p) => <Textarea {...p} rows={2} value={form.traitementsMedicaux} onChange={champ('traitementsMedicaux')} />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader titre="Consentements" />
          <CardBody className="space-y-4">
            <Alert niveau="attention">
              Déclaration administrative : la preuve du consentement parental doit être vérifiée. Cocher ces cases ne constitue pas une preuve du
              consentement d&apos;une personne habilitée.
            </Alert>
            <Checkbox
              label="Droit à l'image accordé"
              description={
                scout.consentementImageDate
                  ? `Photo utilisable dans l'application et les communications du groupe. Dernière déclaration le ${dateCourte(scout.consentementImageDate)}.`
                  : "Photo utilisable dans l'application et les communications du groupe."
              }
              checked={consentementImage}
              onChange={(e) => setConsentementImage(e.target.checked)}
            />
            <Checkbox
              label="Consentement au traitement des données de santé"
              description={
                scout.consentementSanteDate
                  ? `Recueilli par écrit auprès des parents. Dernière déclaration le ${dateCourte(scout.consentementSanteDate)}.`
                  : 'Recueilli par écrit auprès des parents.'
              }
              checked={consentementSante}
              onChange={(e) => setConsentementSante(e.target.checked)}
            />
          </CardBody>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <ButtonLink href={`/dashboard/scouts/${scout.id}`} variante="secondaire">
            Annuler
          </ButtonLink>
          <Button type="submit" chargement={modifier.isPending}>
            Enregistrer les modifications
          </Button>
        </div>
      </form>
    </div>
  )
}
