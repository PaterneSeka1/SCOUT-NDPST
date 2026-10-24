'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  LABELS_BRANCHES,
  LABELS_STATUT_ACTIVITE,
  LABELS_TYPE_ACTIVITE,
  ORDRE_BRANCHES,
  ROLES_BRANCHE,
} from '@scout/shared'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  DataTable,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  confirmer,
  type Colonne,
} from '@/components/ui'
import { useSession } from '@/lib/session-client'
import { dateCourte } from '@/lib/format'
import { CalendarRange, ClipboardList, Globe, ICONES_TYPE_ACTIVITE, Pencil, Plus, Trash2 } from '@/lib/icons'
import { TONS_STATUT_ACTIVITE, useActivites, useSupprimerActivite, type Activite } from '@/hooks/useActivites'

const LIMITE = 20

export default function PageActivites() {
  const router = useRouter()
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const estBranche = ROLES_BRANCHE.includes(role)

  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const [type, setType] = useState('')
  const [statut, setStatut] = useState('')
  const [branche, setBranche] = useState('')
  const [aVenir, setAVenir] = useState(false)

  const { data, isLoading, isFetching, error, refetch } = useActivites({
    page,
    limite: LIMITE,
    recherche,
    type,
    statut,
    brancheType: estBranche ? undefined : branche,
    aVenir,
  })
  const supprimer = useSupprimerActivite()

  // Aligné sur DELETE /api/activites/:id : créateur ou Chef de Groupe.
  const peutSupprimer = (a: Activite) => role === 'CHEF_GROUPE' || a.creePar === session?.user?.id
  const filtresActifs = Boolean(recherche || type || statut || branche || aVenir)

  function changerFiltre<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  async function demanderSuppression(a: Activite) {
    const ok = await confirmer({
      titre: `Supprimer « ${a.titre} » ?`,
      description:
        'L’activité, ses présences et ses autorisations de camp seront définitivement supprimées. Cette action est irréversible.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimer.mutateAsync(a.id)
      toast.success('Activité supprimée.')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const colonnes: Colonne<Activite>[] = [
    {
      cle: 'titre',
      titre: 'Activité',
      principale: true,
      rendu: (a) => {
        const Icone = ICONES_TYPE_ACTIVITE[a.type] ?? ClipboardList
        return (
          <span className="flex min-w-0 items-center gap-2">
            <Icone className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            <Link href={`/dashboard/activites/${a.id}`} className="truncate font-medium text-stone-900 hover:underline" onClick={(e) => e.stopPropagation()}>
              {a.titre}
            </Link>
            {a.publique && (
              <Badge ton="primaire">
                <Globe className="h-3 w-3" aria-hidden /> Public
              </Badge>
            )}
          </span>
        )
      },
    },
    { cle: 'type', titre: 'Type', rendu: (a) => LABELS_TYPE_ACTIVITE[a.type] ?? a.type, masquee: 'lg' },
    {
      cle: 'branche',
      titre: 'Branche',
      rendu: (a) => (a.brancheType ? (LABELS_BRANCHES[a.brancheType] ?? a.brancheType) : <span className="text-stone-500">Inter-branches</span>),
    },
    { cle: 'date', titre: 'Début', rendu: (a) => dateCourte(a.dateDebut) },
    {
      cle: 'statut',
      titre: 'Statut',
      rendu: (a) => <StatusBadge valeur={a.statut} libelles={LABELS_STATUT_ACTIVITE} tons={TONS_STATUT_ACTIVITE} />,
    },
    {
      cle: 'responsable',
      titre: 'Responsable',
      masquee: 'lg',
      rendu: (a) => (a.responsable ? `${a.responsable.prenom} ${a.responsable.nom}` : <span className="text-stone-400">—</span>),
    },
    { cle: 'presences', titre: 'Présences', masquee: 'md', rendu: (a) => <span className="tabular-nums">{a._count.presences}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Activités et camps"
        description={estBranche ? 'Activités de votre branche et activités inter-branches.' : 'Sorties, camps, services et célébrations du groupe.'}
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Activités et camps' }]}
        actions={
          <ButtonLink href="/dashboard/activites/nouvelle" icone={Plus}>
            Nouvelle activité
          </ButtonLink>
        }
      />

      <FilterBar>
        <SearchInput valeur={recherche} onChange={changerFiltre(setRecherche)} placeholder="Titre ou lieu…" label="Rechercher une activité" />
        <Select
          aria-label="Filtrer par type"
          value={type}
          onChange={(e) => changerFiltre(setType)(e.target.value)}
          vide="Tous les types"
          options={Object.entries(LABELS_TYPE_ACTIVITE).map(([valeur, libelle]) => ({ valeur, libelle }))}
        />
        <Select
          aria-label="Filtrer par statut"
          value={statut}
          onChange={(e) => changerFiltre(setStatut)(e.target.value)}
          vide="Tous les statuts"
          options={Object.entries(LABELS_STATUT_ACTIVITE).map(([valeur, libelle]) => ({ valeur, libelle }))}
        />
        {!estBranche && (
          <Select
            aria-label="Filtrer par branche"
            value={branche}
            onChange={(e) => changerFiltre(setBranche)(e.target.value)}
            vide="Toutes les branches"
            options={ORDRE_BRANCHES.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))}
          />
        )}
        <Checkbox label="À venir uniquement" checked={aVenir} onChange={(e) => changerFiltre(setAVenir)(e.target.checked)} />
      </FilterBar>

      <Card>
        <DataTable
          legende="Liste des activités"
          colonnes={colonnes}
          lignes={data?.activites}
          cleLigne={(a) => a.id}
          chargement={isLoading || isFetching}
          erreur={error ? error.message : null}
          onReessayer={() => refetch()}
          onLigne={(a) => router.push(`/dashboard/activites/${a.id}`)}
          actions={(a) => (
            <>
              <ButtonLink href={`/dashboard/activites/${a.id}/modifier`} variante="fantome" taille="sm" icone={Pencil}>
                <span className="sr-only md:not-sr-only">Modifier</span>
              </ButtonLink>
              {peutSupprimer(a) && (
                <Button variante="fantome" taille="sm" icone={Trash2} onClick={() => demanderSuppression(a)} className="text-red-700 hover:bg-red-50">
                  <span className="sr-only md:not-sr-only">Supprimer</span>
                </Button>
              )}
            </>
          )}
          vide={{
            icone: CalendarRange,
            titre: filtresActifs ? 'Aucune activité ne correspond à ces filtres' : 'Aucune activité pour le moment',
            description: filtresActifs ? 'Modifiez ou effacez les filtres.' : 'Créez la première activité du groupe.',
            action: filtresActifs ? undefined : (
              <ButtonLink href="/dashboard/activites/nouvelle" icone={Plus} taille="sm">
                Nouvelle activité
              </ButtonLink>
            ),
          }}
        />
      </Card>

      {data && (
        <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={setPage} total={data.pagination.total} itemLabel="activité" />
      )}
    </div>
  )
}
