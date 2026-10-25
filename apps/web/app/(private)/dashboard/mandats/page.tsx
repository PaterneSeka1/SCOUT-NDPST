'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LABELS_BRANCHES, LABELS_ROLES, ROLES_TOUT_STAFF } from '@scout/shared'
import { Pagination } from '@/components/ui/Pagination'
import { api, requete, type Pagination as MetaPagination } from '@/lib/api'
import { useSession } from '@/lib/session-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { FormulaireAction, type ActionFinanciere } from '@/components/adhesions/FormulaireAction'
import { DataTable } from '@/components/ui/DataTable'
import { NavIcon } from '@/lib/icons'
interface Mandat {
  id: string
  role: string
  brancheType: string | null
  debutLe: string
  finLe: string | null
  motif: string | null
  utilisateur: { id: string; nom: string; prenom: string; actif: boolean }
}
export default function Page() {
  const { data: session } = useSession()
  const gestion = ['ADMINISTRATEUR', 'CHEF_GROUPE'].includes(session?.user.role ?? '')
  const [page, setPage] = useState(1)
  const [ordre, setOrdre] = useState<'asc' | 'desc'>('desc')
  const [statut, setStatut] = useState('')
  const [recherche, setRecherche] = useState('')
  const [compteId, setCompteId] = useState('')
  const [action, setAction] = useState<ActionFinanciere | null>(null)
  const mandats = useQuery({
    queryKey: ['mandats', page, recherche, ordre, statut],
    queryFn: () =>
      api<{ mandats: Mandat[]; pagination: MetaPagination }>(
        `/api/mandats${requete({ page, recherche, ordre, statut: statut || undefined })}`,
      ),
  })
  const comptes = useQuery({
    queryKey: ['comptes-mandats', recherche],
    enabled: gestion,
    queryFn: () => api<{ id: string; nom: string; prenom: string }[]>(`/api/comptes-mandats${requete({ recherche })}`),
  })
  return (
    <div className="space-y-5">
      <PageHeader
        titre="Mandats de la maîtrise"
        description="Les fonctions se cumulent sur un seul compte. Clore une fonction préserve les autres mandats."
      />
      <Field label={gestion ? 'Rechercher un compte ou filtrer les mandats' : 'Rechercher un membre'}>
        {(p) => (
          <Input
            {...p}
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
              setPage(1)
            }}
          />
        )}
      </Field>
      <Field label="Situation des mandats">
        {(p) => (
          <Select
            {...p}
            value={statut}
            onChange={(e) => {
              setStatut(e.target.value)
              setPage(1)
            }}
            vide="Tous les mandats"
            options={[
              { valeur: 'actif', libelle: 'Actifs' },
              { valeur: 'clos', libelle: 'Clos' },
            ]}
          />
        )}
      </Field>
      {gestion && (
        <Field label="Compte à nommer">
          {(p) => (
            <Select
              {...p}
              value={compteId}
              onChange={(e) => setCompteId(e.target.value)}
              vide="Choisir un compte"
              options={comptes.data?.map((c) => ({ valeur: c.id, libelle: `${c.prenom} ${c.nom}` }))}
            />
          )}
        </Field>
      )}
      {gestion && (
        <Button
          disabled={!compteId || !comptes.data?.some((c) => c.id === compteId)}
          onClick={() =>
            setAction({
              titre: 'Attribuer un mandat',
              description: `${comptes.data?.find((c) => c.id === compteId)?.prenom} ${comptes.data?.find((c) => c.id === compteId)?.nom} : la fonction prend effet immédiatement. Les finances restent soumises à des habilitations explicites.`,
              chemin: '/api/utilisateurs/' + compteId + '/mandats',
              champs: [
                {
                  nom: 'role',
                  label: 'Fonction',
                  requis: true,
                  options: ROLES_TOUT_STAFF.map((valeur) => ({ valeur, libelle: LABELS_ROLES[valeur] })),
                },
                {
                  nom: 'brancheType',
                  label: 'Branche (obligatoire pour une fonction de branche)',
                  options: Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => ({ valeur, libelle })),
                },
                { nom: 'motif', label: 'Motif de nomination', requis: true },
              ],
            })
          }
        >
          Attribuer une fonction au compte sélectionné
        </Button>
      )}
      {comptes.error && <p role="alert">{comptes.error.message}</p>}
      <DataTable<Mandat>
        legende="Mandats de la maîtrise"
        lignes={mandats.data?.mandats}
        tri={{ cle: 'debutLe', sens: ordre }}
        onTri={(t) => {
          setOrdre(t.sens)
          setPage(1)
        }}
        chargement={mandats.isFetching}
        erreur={mandats.error?.message}
        onReessayer={() => mandats.refetch()}
        cleLigne={(m) => m.id}
        vide={{ icone: NavIcon.maitrise, titre: 'Aucun mandat' }}
        colonnes={[
          {
            cle: 'membre',
            titre: 'Membre',
            principale: true,
            rendu: (m) => `${m.utilisateur.prenom} ${m.utilisateur.nom}`,
          },
          { cle: 'fonction', titre: 'Fonction', rendu: (m) => LABELS_ROLES[m.role] },
          {
            cle: 'branche',
            titre: 'Périmètre',
            rendu: (m) => (m.brancheType ? LABELS_BRANCHES[m.brancheType] : 'Groupe'),
          },
          {
            cle: 'dates',
            titre: 'Période',
            tri: 'debutLe',
            rendu: (m) =>
              `${new Date(m.debutLe).toLocaleDateString('fr-FR')} → ${m.finLe ? new Date(m.finLe).toLocaleDateString('fr-FR') : 'en cours'}`,
          },
        ]}
        actions={
          gestion
            ? (m) =>
                !m.finLe && (
                  <Button
                    variante="danger"
                    taille="sm"
                    onClick={() =>
                      setAction({
                        titre: 'Clore ce mandat',
                        description: `${m.utilisateur.prenom} ${m.utilisateur.nom} · ${LABELS_ROLES[m.role]}. Les autres fonctions sont conservées.`,
                        chemin: `/api/mandats/${m.id}`,
                        method: 'PATCH',
                        champs: [{ nom: 'motif', label: 'Motif de clôture', requis: true }],
                      })
                    }
                  >
                    Clore
                  </Button>
                )
            : undefined
        }
      />
      {mandats.data && <Pagination {...mandats.data.pagination} onPageChange={setPage} itemLabel="mandat" />}
      {action && <FormulaireAction key={action.chemin} action={action} fermer={() => setAction(null)} />}
    </div>
  )
}
