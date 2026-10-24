'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LABELS_STATUT_PUBLICATION } from '@scout/shared'
import {
  ButtonLink,
  Button,
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
import { Newspaper, Pencil, Plus, Settings } from '@/lib/icons'
import { dateCourte } from '@/lib/format'
import { messageErreur, miettesAdmin, TONS_STATUT_PUBLICATION } from '@/components/admin/commun'
import { GestionCategories } from './GestionCategories'
import { useCategories, usePublications, type FiltresPublications, type PublicationListe } from './donnees'

const OPTIONS_STATUT = Object.entries(LABELS_STATUT_PUBLICATION).map(([valeur, libelle]) => ({ valeur, libelle }))

export function ListePublications() {
  const router = useRouter()
  const [filtres, setFiltres] = useState<FiltresPublications>({ page: 1, statut: '', categorieId: '', q: '' })
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false)
  const liste = usePublications(filtres)
  const categories = useCategories()

  const changer = (partiel: Partial<FiltresPublications>) => setFiltres((f) => ({ ...f, page: 1, ...partiel }))
  const rechercher = useCallback((q: string) => setFiltres((f) => ({ ...f, page: 1, q })), [])
  const filtre = !!(filtres.q || filtres.statut || filtres.categorieId)

  const colonnes: Colonne<PublicationListe>[] = [
    {
      cle: 'titre',
      titre: 'Titre',
      principale: true,
      rendu: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-900">{p.titre}</p>
          <p className="truncate text-xs text-stone-500">/actualites/{p.slug}</p>
        </div>
      ),
    },
    {
      cle: 'statut',
      titre: 'Statut',
      rendu: (p) => <StatusBadge valeur={p.statut} libelles={LABELS_STATUT_PUBLICATION} tons={TONS_STATUT_PUBLICATION} />,
    },
    { cle: 'categorie', titre: 'Catégorie', masquee: 'lg', rendu: (p) => p.categorie?.nom ?? '—' },
    { cle: 'date', titre: 'Publication', masquee: 'md', rendu: (p) => dateCourte(p.datePublication) },
    { cle: 'maj', titre: 'Modifiée le', masquee: 'lg', rendu: (p) => dateCourte(p.updatedAt) },
    {
      cle: 'auteur',
      titre: 'Auteur',
      masquee: 'lg',
      rendu: (p) => (p.auteur ? `${p.auteur.prenom} ${p.auteur.nom}` : '—'),
    },
  ]

  return (
    <>
      <PageHeader
        titre="Publications"
        description="Actualités du site public : rédaction, relecture et mise en ligne."
        miettes={miettesAdmin({ libelle: 'Publications' })}
        actions={
          <>
            <Button variante="secondaire" icone={Settings} onClick={() => setCategoriesOuvertes(true)}>
              Catégories
            </Button>
            <ButtonLink href="/admin/publications/nouveau" icone={Plus}>
              Nouvelle publication
            </ButtonLink>
          </>
        }
      />

      <Card>
        <div className="border-b border-stone-100 p-4">
          <FilterBar>
            <SearchInput valeur={filtres.q} onChange={rechercher} placeholder="Rechercher un titre ou un résumé…" label="Rechercher une publication" />
            <Select
              aria-label="Filtrer par statut"
              value={filtres.statut}
              onChange={(e) => changer({ statut: e.target.value })}
              vide="Tous les statuts"
              options={OPTIONS_STATUT}
            />
            <Select
              aria-label="Filtrer par catégorie"
              value={filtres.categorieId}
              onChange={(e) => changer({ categorieId: e.target.value })}
              vide="Toutes les catégories"
              options={(categories.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))}
            />
          </FilterBar>
        </div>
        <DataTable
          legende="Liste des publications"
          colonnes={colonnes}
          lignes={liste.data?.publications}
          cleLigne={(p) => p.id}
          chargement={liste.isFetching}
          erreur={liste.isError ? messageErreur(liste.error) : null}
          onReessayer={() => liste.refetch()}
          onLigne={(p) => router.push(`/admin/publications/${p.id}`)}
          actions={(p) => (
            <ButtonLink href={`/admin/publications/${p.id}`} variante="fantome" taille="sm" icone={Pencil}>
              Modifier
            </ButtonLink>
          )}
          vide={
            filtre
              ? { icone: Newspaper, titre: 'Aucune publication ne correspond à ces critères.', description: 'Modifiez la recherche ou les filtres.' }
              : {
                  icone: Newspaper,
                  titre: 'Aucune publication pour le moment.',
                  description: 'Rédigez une première actualité : elle restera en brouillon jusqu’à sa publication.',
                  action: (
                    <ButtonLink href="/admin/publications/nouveau" icone={Plus}>
                      Nouvelle publication
                    </ButtonLink>
                  ),
                }
          }
        />
        {liste.data && (
          <div className="border-t border-stone-100 px-4 py-3 empty:hidden">
            <Pagination
              page={liste.data.pagination.page}
              totalPages={liste.data.pagination.totalPages}
              total={liste.data.pagination.total}
              itemLabel="publication"
              onPageChange={(page) => setFiltres((f) => ({ ...f, page }))}
            />
          </div>
        )}
      </Card>

      <GestionCategories ouvert={categoriesOuvertes} onFermer={() => setCategoriesOuvertes(false)} />
    </>
  )
}
