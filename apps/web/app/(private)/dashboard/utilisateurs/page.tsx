'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { LABELS_BRANCHES, LABELS_ROLES, ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT } from '@scout/shared'
import { useModifierUtilisateur, useUtilisateurs, type Utilisateur } from '@/hooks/useUtilisateurs'
import { Pencil, Plus, Users } from '@/lib/icons'
import { Badge, Button, ButtonLink, DataTable, FilterBar, PageHeader, Pagination, SearchInput, Select, confirmer, type Colonne } from '@/components/ui'

// Comptes de l'équipe d'encadrement, jamais les parents (page dédiée). Sans
// filtre de rôle, on demande explicitement tous les rôles hors PARENT, sans
// quoi l'API renverrait aussi les parents.
const ROLES_FILTRE = ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT
const ROLES_PAR_DEFAUT = ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT.join(',')

function ActionsCompte({ utilisateur }: { utilisateur: Utilisateur }) {
  const { mutateAsync, isPending } = useModifierUtilisateur(utilisateur.id)
  const basculer = async () => {
    if (
      utilisateur.actif &&
      !(await confirmer({
        titre: 'Désactiver ce compte ?',
        description: `Le compte de ${utilisateur.prenom} ${utilisateur.nom} perdra immédiatement ses accès et ses sessions seront révoquées.`,
        labelConfirmer: 'Désactiver',
        danger: true,
      }))
    )
      return
    try {
      await mutateAsync({ actif: !utilisateur.actif })
      toast.success(utilisateur.actif ? 'Compte désactivé.' : 'Compte réactivé.')
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : 'Impossible de modifier le compte.')
    }
  }
  return (
    <>
      <ButtonLink href={`/dashboard/utilisateurs/${utilisateur.id}/modifier`} variante="fantome" taille="sm" icone={Pencil}>
        Modifier<span className="sr-only"> {utilisateur.prenom} {utilisateur.nom}</span>
      </ButtonLink>
      <Button variante="fantome" taille="sm" chargement={isPending} onClick={() => void basculer()}>
        {utilisateur.actif ? 'Désactiver' : 'Réactiver'}
        <span className="sr-only"> {utilisateur.prenom} {utilisateur.nom}</span>
      </Button>
    </>
  )
}

export default function UtilisateursPage() {
  const [recherche, setRecherche] = useState('')
  const [roleFiltre, setRoleFiltre] = useState('')
  const [page, setPage] = useState(1)

  const { data, isPending, isError, error, refetch } = useUtilisateurs({
    page,
    recherche: recherche || undefined,
    role: roleFiltre || ROLES_PAR_DEFAUT,
  })
  const total = data?.total ?? 0

  const colonnes: Colonne<Utilisateur>[] = [
    {
      cle: 'nom',
      titre: 'Membre',
      principale: true,
      rendu: (u) => (
        <span>
          <span className="block font-medium text-encre">
            {u.prenom} {u.nom}
          </span>
          {u.matricule && <span className="font-mono text-xs text-encre-pale">{u.matricule}</span>}
        </span>
      ),
    },
    {
      cle: 'role',
      titre: 'Rôle',
      rendu: (u) => (
        <span>
          {LABELS_ROLES[u.role] ?? u.role}
          {u.brancheType && <span className="text-encre-pale"> · {LABELS_BRANCHES[u.brancheType] ?? u.brancheType}</span>}
        </span>
      ),
    },
    { cle: 'statut', titre: 'Statut', rendu: (u) => (u.actif ? <Badge ton="succes">Actif</Badge> : <Badge>Inactif</Badge>) },
  ]

  return (
    <div>
      <PageHeader
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Comptes de la maîtrise' }]}
        titre="Comptes de la maîtrise"
        description={data ? `${total} compte${total > 1 ? 's' : ''} d’encadrement` : 'Les comptes de connexion de l’équipe d’encadrement.'}
        actions={
          <ButtonLink href="/dashboard/utilisateurs/nouveau" icone={Plus}>
            Nouveau membre
          </ButtonLink>
        }
      />
      <FilterBar>
        <SearchInput
          valeur={recherche}
          onChange={(v) => {
            setRecherche(v)
            setPage(1)
          }}
          label="Rechercher un membre"
          placeholder="Nom, matricule…"
          className="sm:w-72"
        />
        <Select
          aria-label="Filtrer par rôle"
          vide="Tous les rôles"
          value={roleFiltre}
          onChange={(e) => {
            setRoleFiltre(e.target.value)
            setPage(1)
          }}
          options={ROLES_FILTRE.map((r) => ({ valeur: r, libelle: LABELS_ROLES[r] ?? r }))}
          className="sm:w-56"
        />
      </FilterBar>
      <DataTable
        legende="Comptes de la maîtrise"
        colonnes={colonnes}
        lignes={data?.utilisateurs}
        cleLigne={(u) => u.id}
        chargement={isPending}
        erreur={isError ? (error instanceof Error ? error.message : 'Une erreur est survenue.') : null}
        onReessayer={() => void refetch()}
        vide={{
          icone: Users,
          titre: recherche || roleFiltre ? 'Aucun membre ne correspond à ces critères.' : 'Aucun compte d’encadrement pour le moment.',
          action: !recherche && !roleFiltre ? <ButtonLink href="/dashboard/utilisateurs/nouveau" icone={Plus}>Ajouter un membre</ButtonLink> : undefined,
        }}
        actions={(u) => <ActionsCompte utilisateur={u} />}
      />
      {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} total={total} itemLabel="membre" />}
    </div>
  )
}
