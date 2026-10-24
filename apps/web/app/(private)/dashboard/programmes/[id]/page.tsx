'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ROLES_GESTION } from '@scout/shared'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChargementPage,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  confirmer,
} from '@/components/ui'
import {
  useAjouterLigne,
  useModifierLigne,
  useModifierProgramme,
  useProgramme,
  useSupprimerLigne,
  useSupprimerProgramme,
  type LigneProgramme,
  type Programme,
} from '@/hooks/useProgrammes'
import { api, requete } from '@/lib/api'
import { useSession } from '@/lib/session-client'
import { dateCourte, valeurChampDate } from '@/lib/format'
import { BookOpen, Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from '@/lib/icons'

function message(e: unknown) {
  return e instanceof Error ? e.message : 'Une erreur est survenue.'
}

export default function PageDetailProgramme() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const peutGerer = ROLES_GESTION.includes(session?.user.role ?? '')

  const requeteProgramme = useProgramme(id)
  const supprimerProgramme = useSupprimerProgramme()
  const modifierLigne = useModifierLigne(id)
  const supprimerLigne = useSupprimerLigne(id)
  const [editionMeta, setEditionMeta] = useState(false)
  const [ligneEditee, setLigneEditee] = useState<LigneProgramme | 'nouvelle' | null>(null)

  const miettes = [
    { libelle: 'Tableau de bord', href: '/dashboard' },
    { libelle: 'Programmes', href: '/dashboard/programmes' },
    { libelle: requeteProgramme.data?.titre ?? 'Programme' },
  ]

  if (requeteProgramme.isLoading) return <ChargementPage />
  if (requeteProgramme.isError || !requeteProgramme.data) {
    return (
      <div>
        <PageHeader titre="Programme" miettes={miettes} />
        <Card>
          <ErrorState message={requeteProgramme.error?.message} onReessayer={() => requeteProgramme.refetch()} />
        </Card>
      </div>
    )
  }

  const programme = requeteProgramme.data
  const lignes = [...programme.lignes].sort((a, b) => a.ordre - b.ordre)
  const realisees = lignes.filter((l) => l.activite).length

  async function supprimer() {
    const ok = await confirmer({
      titre: `Supprimer le programme « ${programme.titre} » ?`,
      description: 'Ce programme et tous ses thèmes planifiés seront définitivement supprimés. Les activités liées sont conservées.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimerProgramme.mutateAsync(id)
      toast.success('Programme supprimé.')
      router.push('/dashboard/programmes')
    } catch (e) {
      toast.error(message(e))
    }
  }

  async function retirerLigne(ligne: LigneProgramme) {
    const ok = await confirmer({
      titre: 'Supprimer ce thème ?',
      description: `Le thème « ${ligne.theme} » sera définitivement retiré du programme.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimerLigne.mutateAsync(ligne.id)
      toast.success('Thème supprimé.')
    } catch (e) {
      toast.error(message(e))
    }
  }

  // Échange l'ordre de deux lignes voisines.
  async function deplacer(index: number, sens: -1 | 1) {
    const ligne = lignes[index]
    const voisine = lignes[index + sens]
    if (!ligne || !voisine) return
    try {
      await Promise.all([
        modifierLigne.mutateAsync({ ligneId: ligne.id, ordre: voisine.ordre }),
        modifierLigne.mutateAsync({ ligneId: voisine.id, ordre: ligne.ordre === voisine.ordre ? ligne.ordre + sens : ligne.ordre }),
      ])
    } catch (e) {
      toast.error(message(e))
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        titre={programme.titre}
        miettes={miettes}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge ton={programme.brancheType ? 'primaire' : 'neutre'}>
              {programme.brancheType ? LABELS_BRANCHES[programme.brancheType] ?? programme.brancheType : 'Groupe'}
            </Badge>
            Du {dateCourte(programme.periodeDebut)} au {dateCourte(programme.periodeFin)}
            {programme.creeParUtilisateur && ` · créé par ${programme.creeParUtilisateur.prenom} ${programme.creeParUtilisateur.nom}`}
          </span>
        }
        actions={
          peutGerer ? (
            <>
              <Button variante="secondaire" icone={Pencil} onClick={() => setEditionMeta(true)}>
                Modifier
              </Button>
              <Button variante="danger" icone={Trash2} onClick={supprimer} chargement={supprimerProgramme.isPending}>
                Supprimer
              </Button>
            </>
          ) : undefined
        }
      />

      {programme.description && (
        <Card>
          <CardBody>
            <p className="text-sm whitespace-pre-wrap text-stone-700">{programme.description}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          titre="Thèmes planifiés"
          description={lignes.length ? `${realisees} réalisé${realisees > 1 ? 's' : ''} sur ${lignes.length}` : undefined}
          actions={
            peutGerer ? (
              <Button taille="sm" icone={Plus} onClick={() => setLigneEditee('nouvelle')}>
                Ajouter un thème
              </Button>
            ) : undefined
          }
        />
        {lignes.length === 0 ? (
          <EmptyState icon={BookOpen} title="Aucun thème pour l’instant" description="Ajoutez les thèmes prévus sur la période du programme." />
        ) : (
          <ol className="divide-y divide-stone-100">
            {lignes.map((ligne, i) => (
              <li key={ligne.id} className="flex items-start gap-3 px-5 py-4">
                {peutGerer && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => deplacer(i, -1)}
                      disabled={i === 0 || modifierLigne.isPending}
                      aria-label={`Monter « ${ligne.theme} »`}
                      className="rounded border border-stone-200 p-0.5 text-stone-500 hover:text-stone-800 disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacer(i, 1)}
                      disabled={i === lignes.length - 1 || modifierLigne.isPending}
                      aria-label={`Descendre « ${ligne.theme} »`}
                      className="rounded border border-stone-200 p-0.5 text-stone-500 hover:text-stone-800 disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900">{ligne.theme}</p>
                  {ligne.objectif && <p className="mt-0.5 text-sm text-stone-600">{ligne.objectif}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    {ligne.datePrevue && <span>Prévu le {dateCourte(ligne.datePrevue)}</span>}
                    {ligne.activite ? (
                      <Link href={`/dashboard/activites/${ligne.activite.id}`} className="hover:underline">
                        <Badge ton="succes">
                          <Check className="h-3 w-3" aria-hidden /> Réalisé — {ligne.activite.titre}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge>À réaliser</Badge>
                    )}
                  </div>
                </div>
                {peutGerer && (
                  <div className="flex shrink-0 gap-1">
                    <Button taille="sm" variante="fantome" icone={Pencil} onClick={() => setLigneEditee(ligne)}>
                      <span className="sr-only">Modifier « {ligne.theme} »</span>
                    </Button>
                    <Button taille="sm" variante="fantome" icone={Trash2} onClick={() => retirerLigne(ligne)} disabled={supprimerLigne.isPending}>
                      <span className="sr-only">Supprimer « {ligne.theme} »</span>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Modal ouvert={editionMeta} onFermer={() => setEditionMeta(false)} titre="Modifier le programme">
        {editionMeta && <FormulaireProgramme programme={programme} onFermer={() => setEditionMeta(false)} />}
      </Modal>
      <Modal ouvert={ligneEditee !== null} onFermer={() => setLigneEditee(null)} titre={ligneEditee === 'nouvelle' ? 'Ajouter un thème' : 'Modifier le thème'}>
        {ligneEditee !== null && (
          <FormulaireLigne
            key={ligneEditee === 'nouvelle' ? 'nouvelle' : ligneEditee.id}
            programme={programme}
            ligne={ligneEditee === 'nouvelle' ? null : ligneEditee}
            onFermer={() => setLigneEditee(null)}
          />
        )}
      </Modal>
    </div>
  )
}

function FormulaireProgramme({ programme, onFermer }: { programme: Programme; onFermer: () => void }) {
  const modifier = useModifierProgramme(programme.id)
  const [titre, setTitre] = useState(programme.titre)
  const [description, setDescription] = useState(programme.description ?? '')
  const [debut, setDebut] = useState(valeurChampDate(programme.periodeDebut))
  const [fin, setFin] = useState(valeurChampDate(programme.periodeFin))
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || !debut || !fin) return setErreur('Le titre et la période sont obligatoires.')
    if (new Date(fin) <= new Date(debut)) return setErreur('La date de fin doit être après la date de début.')
    setErreur(null)
    try {
      await modifier.mutateAsync({
        titre: titre.trim(),
        description: description.trim() || null,
        periodeDebut: new Date(debut).toISOString(),
        periodeFin: new Date(fin).toISOString(),
      })
      toast.success('Programme mis à jour.')
      onFermer()
    } catch (err) {
      toast.error(message(err))
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <Field label="Titre" requis>
        {(p) => <Input {...p} value={titre} onChange={(e) => setTitre(e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début" requis erreur={erreur}>
          {(p) => <Input {...p} type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />}
        </Field>
        <Field label="Fin" requis>
          {(p) => <Input {...p} type="date" value={fin} onChange={(e) => setFin(e.target.value)} />}
        </Field>
      </div>
      <Field label="Description et objectifs">
        {(p) => <Textarea {...p} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variante="secondaire" onClick={onFermer}>
          Annuler
        </Button>
        <Button type="submit" chargement={modifier.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

function FormulaireLigne({ programme, ligne, onFermer }: { programme: Programme; ligne: LigneProgramme | null; onFermer: () => void }) {
  const ajouter = useAjouterLigne(programme.id)
  const modifier = useModifierLigne(programme.id)
  const [theme, setTheme] = useState(ligne?.theme ?? '')
  const [objectif, setObjectif] = useState(ligne?.objectif ?? '')
  const [datePrevue, setDatePrevue] = useState(valeurChampDate(ligne?.datePrevue))
  const [activiteId, setActiviteId] = useState(ligne?.activite?.id ?? '')
  const [erreur, setErreur] = useState<string | null>(null)

  // Activités pouvant réaliser ce thème (branche du programme, sinon toutes).
  const activites = useQuery({
    queryKey: ['activites', 'pour-programme', programme.brancheType ?? ''],
    queryFn: () =>
      api<{ activites: { id: string; titre: string; dateDebut: string }[] }>(
        `/api/activites${requete({ brancheType: programme.brancheType ?? undefined, limite: 100 })}`,
      ),
    enabled: ligne !== null,
  })

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!theme.trim()) return setErreur('Le thème est obligatoire.')
    setErreur(null)
    const donnees = {
      theme: theme.trim(),
      objectif: objectif.trim() || null,
      datePrevue: datePrevue ? new Date(datePrevue).toISOString() : null,
    }
    try {
      if (ligne) await modifier.mutateAsync({ ligneId: ligne.id, ...donnees, activiteId: activiteId || null })
      else await ajouter.mutateAsync(donnees)
      toast.success(ligne ? 'Thème modifié.' : 'Thème ajouté.')
      onFermer()
    } catch (err) {
      toast.error(message(err))
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <Field label="Thème" requis erreur={erreur}>
        {(p) => <Input {...p} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex. Vie de groupe" />}
      </Field>
      <Field label="Objectif pédagogique">
        {(p) => <Textarea {...p} rows={2} value={objectif} onChange={(e) => setObjectif(e.target.value)} />}
      </Field>
      <Field label="Date prévue">
        {(p) => <Input {...p} type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} />}
      </Field>
      {ligne && (
        <Field label="Activité de réalisation" aide="Liez l’activité qui a réalisé ce thème.">
          {(p) => (
            <Select {...p} value={activiteId} onChange={(e) => setActiviteId(e.target.value)} vide={activites.isLoading ? 'Chargement…' : 'Aucune (à réaliser)'}>
              {ligne.activite && !activites.data?.activites.some((a) => a.id === ligne.activite?.id) && (
                <option value={ligne.activite.id}>{ligne.activite.titre}</option>
              )}
              {activites.data?.activites.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titre} — {dateCourte(a.dateDebut)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <div className="flex justify-end gap-2">
        <Button variante="secondaire" onClick={onFermer}>
          Annuler
        </Button>
        <Button type="submit" chargement={ajouter.isPending || modifier.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
