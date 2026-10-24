'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ORDRE_BRANCHES, ROLES_BRANCHE } from '@scout/shared'
import { useBasculerActifScout, useScouts, type Scout } from '@/hooks/useScouts'
import { useSession } from '@/lib/session-client'
import { dateCourte } from '@/lib/format'
import { Compass, Pencil, Plus, Upload } from '@/lib/icons'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DataTable,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  confirmer,
  type Colonne,
} from '@/components/ui'

const LIMITE = 20

const OPTIONS_BRANCHES = ORDRE_BRANCHES.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))
const OPTIONS_STATUT = [
  { valeur: 'true', libelle: 'Actifs' },
  { valeur: 'false', libelle: 'Inactifs' },
]

// useSearchParams impose une frontière Suspense pour le pré-rendu.
export default function PageScouts() {
  return (
    <Suspense>
      <ListeScouts />
    </Suspense>
  )
}

function ListeScouts() {
  const router = useRouter()
  const parametres = useSearchParams()
  const { data: session } = useSession()
  const roleBranche = ROLES_BRANCHE.includes(session?.user.role ?? '')

  // Filtre initial depuis l'URL (lien « Voir les scouts » de la page Branches).
  const [branche, setBranche] = useState(() => {
    const valeur = parametres.get('branche') ?? ''
    return ORDRE_BRANCHES.includes(valeur) ? valeur : ''
  })
  const [statut, setStatut] = useState('true')
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching, error, refetch } = useScouts({
    page,
    limite: LIMITE,
    branche: branche || undefined,
    recherche: recherche || undefined,
    actif: statut === '' ? undefined : statut === 'true',
  })
  const basculer = useBasculerActifScout()

  async function changerStatut(scout: Scout) {
    const desactiver = scout.actif
    if (
      desactiver &&
      !(await confirmer({
        titre: `Désactiver ${scout.prenom} ${scout.nom} ?`,
        description: "Le scout n'apparaîtra plus dans les effectifs actifs. Sa fiche et son historique sont conservés.",
        labelConfirmer: 'Désactiver',
        danger: true,
      }))
    )
      return
    try {
      await basculer.mutateAsync({ id: scout.id, actif: !scout.actif })
      toast.success(desactiver ? 'Scout désactivé.' : 'Scout réactivé.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Modification impossible.')
    }
  }

  const colonnes: Colonne<Scout>[] = [
    {
      cle: 'nom',
      titre: 'Scout',
      principale: true,
      rendu: (s) => (
        <span className="font-medium text-stone-900">
          {s.nom} {s.prenom}
        </span>
      ),
    },
    { cle: 'branche', titre: 'Branche', rendu: (s) => <Badge ton="primaire">{LABELS_BRANCHES[s.brancheType] ?? s.brancheType}</Badge> },
    { cle: 'equipe', titre: 'Équipe', masquee: 'md', rendu: (s) => s.equipe?.nom ?? <span className="text-stone-400">—</span> },
    {
      cle: 'matricule',
      titre: 'Matricule',
      masquee: 'lg',
      rendu: (s) => (s.matricule ? <span className="font-mono text-xs">{s.matricule}</span> : <span className="text-stone-400">—</span>),
    },
    { cle: 'naissance', titre: 'Naissance', masquee: 'lg', rendu: (s) => dateCourte(s.dateNaissance) },
    { cle: 'statut', titre: 'Statut', rendu: (s) => <Badge ton={s.actif ? 'succes' : 'neutre'}>{s.actif ? 'Actif' : 'Inactif'}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Scouts"
        description={roleBranche ? 'Effectif de votre branche.' : 'Effectif du groupe, toutes branches confondues.'}
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Scouts' }]}
        actions={
          <>
            <ButtonLink href="/dashboard/scouts/importer" variante="secondaire" icone={Upload}>
              Importer
            </ButtonLink>
            <ButtonLink href="/dashboard/scouts/nouveau" icone={Plus}>
              Inscrire un scout
            </ButtonLink>
          </>
        }
      />

      <FilterBar>
        <SearchInput
          valeur={recherche}
          onChange={(v) => {
            setRecherche(v)
            setPage(1)
          }}
          placeholder="Nom, prénom ou matricule…"
          label="Rechercher un scout"
        />
        {!roleBranche && (
          <Select
            aria-label="Filtrer par branche"
            value={branche}
            onChange={(e) => {
              setBranche(e.target.value)
              setPage(1)
            }}
            vide="Toutes les branches"
            options={OPTIONS_BRANCHES}
          />
        )}
        <Select
          aria-label="Filtrer par statut"
          value={statut}
          onChange={(e) => {
            setStatut(e.target.value)
            setPage(1)
          }}
          vide="Tous les statuts"
          options={OPTIONS_STATUT}
        />
      </FilterBar>

      <Card>
        <DataTable
          legende="Liste des scouts"
          colonnes={colonnes}
          lignes={data?.scouts}
          cleLigne={(s) => s.id}
          chargement={isLoading || isFetching}
          erreur={error ? error.message : null}
          onReessayer={() => refetch()}
          onLigne={(s) => router.push(`/dashboard/scouts/${s.id}`)}
          actions={(s) => (
            <>
              <ButtonLink href={`/dashboard/scouts/${s.id}/modifier`} variante="fantome" taille="sm" icone={Pencil}>
                Modifier
              </ButtonLink>
              <Button variante="fantome" taille="sm" onClick={() => changerStatut(s)} disabled={basculer.isPending}>
                {s.actif ? 'Désactiver' : 'Réactiver'}
              </Button>
            </>
          )}
          vide={{
            icone: Compass,
            titre: recherche || branche || statut !== 'true' ? 'Aucun scout ne correspond à ces critères' : 'Aucun scout inscrit',
            description: recherche || branche ? 'Modifiez la recherche ou les filtres.' : 'Inscrivez un scout ou importez un fichier.',
          }}
        />
      </Card>

      {data && (
        <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} total={data.total} itemLabel="scout" />
      )}
    </div>
  )
}
