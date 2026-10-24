'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { LABELS_BRANCHES, LABELS_STATUT_DEMANDE, LABELS_TYPE_DEMANDE } from '@scout/shared'
import {
  Alert,
  Badge,
  Card,
  DataTable,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  type Colonne,
} from '@/components/ui'
import { api, requete as qs, type Pagination as MetaPagination } from '@/lib/api'
import { dateCourte } from '@/lib/format'
import { Inbox } from '@/lib/icons'
import { TONS_STATUT_DEMANDE, messageErreur, miettesAdmin } from '@/components/admin/commun'

export interface DemandeResume {
  id: string
  type: string
  statut: string
  nomContact: string
  prenomContact: string
  nomJeune: string | null
  prenomJeune: string | null
  brancheSouhaitee: string | null
  createdAt: string
}

interface ReponseDemandes {
  demandes: DemandeResume[]
  nouvelles: number
  pagination: MetaPagination
}

const OPTIONS_STATUT = Object.entries(LABELS_STATUT_DEMANDE).map(([valeur, libelle]) => ({ valeur, libelle }))
const OPTIONS_TYPE = Object.entries(LABELS_TYPE_DEMANDE).map(([valeur, libelle]) => ({ valeur, libelle }))

const COLONNES: Colonne<DemandeResume>[] = [
  {
    cle: 'contact',
    titre: 'Contact',
    principale: true,
    rendu: (d) => (
      <Link href={`/admin/demandes/${d.id}`} className="font-medium text-stone-900 hover:text-primaire hover:underline">
        {d.prenomContact} {d.nomContact}
      </Link>
    ),
  },
  { cle: 'type', titre: 'Type', rendu: (d) => LABELS_TYPE_DEMANDE[d.type] ?? d.type },
  {
    cle: 'jeune',
    titre: 'Jeune',
    masquee: 'lg',
    rendu: (d) =>
      d.prenomJeune || d.nomJeune ? (
        <span>
          {[d.prenomJeune, d.nomJeune].filter(Boolean).join(' ')}
          {d.brancheSouhaitee && <span className="text-stone-500"> — {LABELS_BRANCHES[d.brancheSouhaitee] ?? d.brancheSouhaitee}</span>}
        </span>
      ) : (
        <span className="text-stone-400">—</span>
      ),
  },
  { cle: 'date', titre: 'Reçue le', rendu: (d) => dateCourte(d.createdAt) },
  {
    cle: 'statut',
    titre: 'Statut',
    rendu: (d) => <StatusBadge valeur={d.statut} libelles={LABELS_STATUT_DEMANDE} tons={TONS_STATUT_DEMANDE} />,
  },
]

export function ListeDemandes() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')

  const requete = useQuery({
    queryKey: ['admin', 'demandes', 'liste', { page, statut, type, q }],
    queryFn: () => api<ReponseDemandes>(`/api/admin/demandes${qs({ page, statut, type, q })}`),
    placeholderData: keepPreviousData,
  })

  const rechercher = useCallback((valeur: string) => {
    setQ(valeur)
    setPage(1)
  }, [])

  const filtresActifs = !!(statut || type || q)
  const donnees = requete.data

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Demandes d'adhésion"
        description="Demandes envoyées depuis le formulaire « Nous rejoindre » et le formulaire de contact du site."
        miettes={miettesAdmin({ libelle: "Demandes d'adhésion" })}
        actions={
          donnees ? (
            <Badge ton={donnees.nouvelles > 0 ? 'info' : 'neutre'}>
              {donnees.nouvelles} nouvelle{donnees.nouvelles > 1 ? 's' : ''}
            </Badge>
          ) : undefined
        }
      />

      <Alert niveau="info">
        Une demande ne crée jamais de compte : l&apos;inscription effective se fait ensuite dans la gestion du groupe.
      </Alert>

      <Card>
        <div className="border-b border-stone-100 p-4">
          <FilterBar>
            <SearchInput valeur={q} onChange={rechercher} placeholder="Nom, prénom, téléphone…" label="Rechercher une demande" />
            <Select
              aria-label="Filtrer par statut"
              vide="Toutes (hors archivées)"
              options={OPTIONS_STATUT}
              value={statut}
              onChange={(e) => {
                setStatut(e.target.value)
                setPage(1)
              }}
            />
            <Select
              aria-label="Filtrer par type"
              vide="Tous les types"
              options={OPTIONS_TYPE}
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setPage(1)
              }}
            />
          </FilterBar>
        </div>
        <DataTable
          legende="Demandes d'adhésion"
          colonnes={COLONNES}
          lignes={donnees?.demandes}
          cleLigne={(d) => d.id}
          chargement={requete.isFetching}
          erreur={requete.isError ? messageErreur(requete.error) : null}
          onReessayer={() => requete.refetch()}
          onLigne={(d) => router.push(`/admin/demandes/${d.id}`)}
          vide={{
            icone: Inbox,
            titre: filtresActifs ? 'Aucune demande ne correspond à ces critères' : 'Aucune demande en attente',
            description: filtresActifs
              ? 'Modifiez la recherche ou les filtres. Les demandes archivées ne s’affichent qu’avec le filtre « Archivée ».'
              : 'Les demandes envoyées depuis le site public apparaîtront ici.',
          }}
        />
        {donnees && (
          <div className="border-t border-stone-100 px-4 py-3 empty:hidden">
            <Pagination
              page={donnees.pagination.page}
              totalPages={donnees.pagination.totalPages}
              total={donnees.pagination.total}
              itemLabel="demande"
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
