'use client'

import { useCallback, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { LABELS_ACTIONS_AUDIT, LABELS_ROLES } from '@scout/shared'
import {
  Button,
  Card,
  DataTable,
  Drawer,
  FilterBar,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Colonne,
} from '@/components/ui'
import { api, requete as qs, type Pagination as MetaPagination } from '@/lib/api'
import { dateHeure } from '@/lib/format'
import { Eye, ShieldCheck } from '@/lib/icons'
import { messageErreur, miettesAdmin } from '@/components/admin/commun'

interface EntreeAudit {
  id: string
  action: string
  entite: string
  entiteId: string | null
  details: unknown
  createdAt: string
  acteur: { id: string; nom: string; prenom: string; role: string } | null
}

interface ReponseAudit {
  entrees: EntreeAudit[]
  actions: string[]
  pagination: MetaPagination
}

const libelleAction = (action: string) => LABELS_ACTIONS_AUDIT[action] ?? action

function Acteur({ acteur }: { acteur: EntreeAudit['acteur'] }) {
  if (!acteur) return <span className="text-stone-500">Système</span>
  return (
    <span>
      {acteur.prenom} {acteur.nom}
      <span className="block text-xs text-stone-500">{LABELS_ROLES[acteur.role] ?? acteur.role}</span>
    </span>
  )
}

export function JournalAudit() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [entite, setEntite] = useState('')
  const [depuis, setDepuis] = useState('')
  const [detail, setDetail] = useState<EntreeAudit | null>(null)

  const requete = useQuery({
    queryKey: ['admin', 'audit', { page, action, entite, depuis }],
    queryFn: () => api<ReponseAudit>(`/api/admin/audit${qs({ page, action, entite, depuis })}`),
    placeholderData: keepPreviousData,
  })
  const donnees = requete.data

  const filtrerEntite = useCallback((valeur: string) => {
    setEntite(valeur)
    setPage(1)
  }, [])

  const colonnes: Colonne<EntreeAudit>[] = [
    { cle: 'action', titre: 'Action', principale: true, rendu: (e) => <span className="font-medium text-stone-900">{libelleAction(e.action)}</span> },
    { cle: 'date', titre: 'Date', rendu: (e) => <span className="whitespace-nowrap tabular-nums">{dateHeure(e.createdAt)}</span> },
    { cle: 'entite', titre: 'Entité', masquee: 'lg', rendu: (e) => e.entite },
    { cle: 'acteur', titre: 'Acteur', rendu: (e) => <Acteur acteur={e.acteur} /> },
  ]

  const filtresActifs = !!(action || entite || depuis)

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Journal d'audit"
        description="Trace des opérations sensibles (comptes, configuration, contenus, données des scouts). Conservée selon la durée fixée côté serveur."
        miettes={miettesAdmin({ libelle: "Journal d'audit" })}
      />

      <Card>
        <div className="border-b border-stone-100 p-4">
          <FilterBar
            actions={
              filtresActifs ? (
                <Button
                  variante="fantome"
                  taille="sm"
                  onClick={() => {
                    setAction('')
                    setEntite('')
                    setDepuis('')
                    setPage(1)
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              ) : undefined
            }
          >
            <SearchInput valeur={entite} onChange={filtrerEntite} placeholder="Entité (ex. Utilisateur)" label="Filtrer par entité" />
            <Select
              aria-label="Filtrer par action"
              vide="Toutes les actions"
              options={(donnees?.actions ?? []).map((a) => ({ valeur: a, libelle: libelleAction(a) }))}
              value={action}
              onChange={(e) => {
                setAction(e.target.value)
                setPage(1)
              }}
            />
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <span className="shrink-0">Depuis le</span>
              <Input
                type="date"
                value={depuis}
                onChange={(e) => {
                  setDepuis(e.target.value)
                  setPage(1)
                }}
              />
            </label>
          </FilterBar>
        </div>
        <DataTable
          legende="Journal d'audit"
          colonnes={colonnes}
          lignes={donnees?.entrees}
          cleLigne={(e) => e.id}
          chargement={requete.isFetching}
          erreur={requete.isError ? messageErreur(requete.error) : null}
          onReessayer={() => requete.refetch()}
          onLigne={setDetail}
          actions={(e) => (
            <Button variante="fantome" taille="sm" icone={Eye} onClick={() => setDetail(e)} aria-label={`Détails : ${libelleAction(e.action)}`}>
              Détails
            </Button>
          )}
          vide={{
            icone: ShieldCheck,
            titre: filtresActifs ? 'Aucune entrée ne correspond à ces filtres' : 'Le journal est vide',
            description: filtresActifs ? 'Élargissez la période ou retirez un filtre.' : undefined,
          }}
        />
        {donnees && (
          <div className="border-t border-stone-100 px-4 py-3 empty:hidden">
            <Pagination
              page={donnees.pagination.page}
              totalPages={donnees.pagination.totalPages}
              total={donnees.pagination.total}
              itemLabel="entrée"
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {detail && (
        <Drawer ouvert onFermer={() => setDetail(null)} titre={libelleAction(detail.action)} description={dateHeure(detail.createdAt)}>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">Code de l&apos;action</dt>
              <dd className="mt-0.5 font-mono text-xs text-stone-800">{detail.action}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">Entité</dt>
              <dd className="mt-0.5 text-stone-800">{detail.entite}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">Identifiant de l&apos;entité</dt>
              <dd className="mt-0.5 font-mono text-xs break-all text-stone-800">{detail.entiteId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">Acteur</dt>
              <dd className="mt-0.5 text-stone-800">
                <Acteur acteur={detail.acteur} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">Détails</dt>
              <dd className="mt-1">
                {detail.details === null || detail.details === undefined ? (
                  <span className="text-stone-400">Aucun détail enregistré.</span>
                ) : (
                  <pre className="scrollbar-fine max-h-[50dvh] overflow-auto rounded-lg bg-stone-900 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-stone-100">
                    {JSON.stringify(detail.details, null, 2)}
                  </pre>
                )}
              </dd>
            </div>
          </dl>
        </Drawer>
      )}
    </div>
  )
}
