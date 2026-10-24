'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LABELS_BRANCHES, LABELS_ROLES, LABELS_STATUT_ACTIVITE, LABELS_TYPE_ACTIVITE } from '@scout/shared'
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ChargementPage,
  ErrorState,
  PageHeader,
  Select,
  StatusBadge,
  confirmer,
} from '@/components/ui'
import { useSession } from '@/lib/session-client'
import { dateHeure, dateLongue } from '@/lib/format'
import { CheckSquare, Globe, Pencil, Trash2 } from '@/lib/icons'
import {
  TONS_STATUT_ACTIVITE,
  useActivite,
  useModifierActivite,
  useSupprimerActivite,
  type StatutActivite,
} from '@/hooks/useActivites'

function Info({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{libelle}</dt>
      <dd className="mt-0.5 text-sm font-medium text-stone-900">{children}</dd>
    </div>
  )
}

export default function PageDetailActivite() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const { data: activite, isLoading, error, refetch } = useActivite(id)
  const modifier = useModifierActivite(id)
  const supprimer = useSupprimerActivite()

  if (isLoading) return <ChargementPage />
  if (error || !activite) return <ErrorState message={error?.message ?? 'Activité introuvable.'} onReessayer={() => refetch()} />

  // Aligné sur DELETE /api/activites/:id : créateur ou Chef de Groupe.
  const peutSupprimer = session?.user?.role === 'CHEF_GROUPE' || activite.creePar === session?.user?.id

  async function changerStatut(statut: StatutActivite) {
    try {
      await modifier.mutateAsync({ statut })
      toast.success(`Statut : ${LABELS_STATUT_ACTIVITE[statut]}.`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function demanderSuppression() {
    if (!activite) return
    const ok = await confirmer({
      titre: `Supprimer « ${activite.titre} » ?`,
      description:
        'L’activité, ses présences et ses autorisations de camp seront définitivement supprimées. Cette action est irréversible.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimer.mutateAsync(id)
      toast.success('Activité supprimée.')
      router.push('/dashboard/activites')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titre={activite.titre}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{LABELS_TYPE_ACTIVITE[activite.type] ?? activite.type}</Badge>
            <Badge ton="accent">{activite.brancheType ? (LABELS_BRANCHES[activite.brancheType] ?? activite.brancheType) : 'Inter-branches'}</Badge>
            <StatusBadge valeur={activite.statut} libelles={LABELS_STATUT_ACTIVITE} tons={TONS_STATUT_ACTIVITE} />
            {activite.publique && (
              <Badge ton="primaire">
                <Globe className="h-3 w-3" aria-hidden /> Publiée
              </Badge>
            )}
          </span>
        }
        miettes={[
          { libelle: 'Tableau de bord', href: '/dashboard' },
          { libelle: 'Activités et camps', href: '/dashboard/activites' },
          { libelle: activite.titre },
        ]}
        actions={
          <>
            <ButtonLink href={`/dashboard/activites/${id}/presences`} icone={CheckSquare}>
              Présences
            </ButtonLink>
            <ButtonLink href={`/dashboard/activites/${id}/modifier`} variante="secondaire" icone={Pencil}>
              Modifier
            </ButtonLink>
            {peutSupprimer && (
              <Button variante="danger" icone={Trash2} onClick={demanderSuppression} chargement={supprimer.isPending}>
                Supprimer
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader titre="Informations" />
            <CardBody>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Info libelle="Début">{dateHeure(activite.dateDebut)}</Info>
                <Info libelle="Fin">{activite.dateFin ? dateHeure(activite.dateFin) : '—'}</Info>
                <Info libelle="Lieu">{activite.lieu ?? '—'}</Info>
                <Info libelle="Responsable">
                  {activite.responsable
                    ? `${activite.responsable.prenom} ${activite.responsable.nom} — ${LABELS_ROLES[activite.responsable.role] ?? activite.responsable.role}`
                    : 'Aucun responsable désigné'}
                </Info>
                <Info libelle="Créée le">{dateLongue(activite.createdAt)}</Info>
                <Info libelle="Présences enregistrées">{activite._count.presences}</Info>
              </dl>
              {activite.description && (
                <div className="mt-5 border-t border-stone-100 pt-4">
                  <p className="text-xs text-stone-500">Description interne</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-stone-700">{activite.description}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              titre="Bilan"
              actions={
                <ButtonLink href={`/dashboard/activites/${id}/modifier`} variante="fantome" taille="sm" icone={Pencil}>
                  {activite.bilan ? 'Modifier' : 'Rédiger'}
                </ButtonLink>
              }
            />
            <CardBody>
              {activite.bilan ? (
                <p className="text-sm whitespace-pre-wrap text-stone-700">{activite.bilan}</p>
              ) : (
                <p className="text-sm text-stone-500">Aucun bilan rédigé.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader titre="Statut" />
            <CardBody>
              <Select
                aria-label="Changer le statut de l’activité"
                value={activite.statut}
                disabled={modifier.isPending}
                onChange={(e) => changerStatut(e.target.value as StatutActivite)}
                options={Object.entries(LABELS_STATUT_ACTIVITE).map(([valeur, libelle]) => ({ valeur, libelle }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader titre="Site public" />
            <CardBody className="space-y-3">
              {activite.publique ? (
                <>
                  <Alert niveau="attention" titre="Visible sur le site public">
                    Titre, dates, lieu, branche, statut et texte public sont affichés aux visiteurs
                    {activite.statut === 'ANNULEE' ? ' (masquée tant qu’elle est annulée)' : ''}.
                  </Alert>
                  <p className="text-sm whitespace-pre-wrap text-stone-700">{activite.descriptionPublique}</p>
                </>
              ) : (
                <p className="text-sm text-stone-500">Non publiée : visible uniquement par la maîtrise.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
