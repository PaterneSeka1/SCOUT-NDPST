'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ButtonLink,
  Badge,
  Card,
  DataTable,
  PageHeader,
  Pagination,
  SearchInput,
  type Colonne,
} from '@/components/ui'
import { Images, Pencil, Plus } from '@/lib/icons'
import { dateCourte } from '@/lib/format'
import { messageErreur, miettesAdmin } from '@/components/admin/commun'
import { useAlbums, type AlbumListe } from './donnees'

export function ListeAlbums() {
  const router = useRouter()
  const [filtres, setFiltres] = useState({ page: 1, q: '' })
  const albums = useAlbums(filtres)
  const rechercher = useCallback((q: string) => setFiltres((f) => ({ ...f, page: 1, q })), [])

  const colonnes: Colonne<AlbumListe>[] = [
    {
      cle: 'titre',
      titre: 'Album',
      principale: true,
      rendu: (album) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-900">{album.titre}</p>
          <p className="truncate text-xs text-stone-500">/galerie/{album.slug}</p>
        </div>
      ),
    },
    { cle: 'categorie', titre: 'Catégorie', masquee: 'md', rendu: (album) => album.categorie || '—' },
    { cle: 'date', titre: 'Événement', masquee: 'lg', rendu: (album) => dateCourte(album.dateEvenement) },
    {
      cle: 'photos',
      titre: 'Photos',
      rendu: (album) => (
        <span>
          {album._count.medias}
          {album.photosSansConsentement > 0 && (
            <span className="ml-2 text-xs text-amber-700">({album.photosSansConsentement} consentement(s) à vérifier)</span>
          )}
        </span>
      ),
    },
    {
      cle: 'statut',
      titre: 'Statut',
      rendu: (album) => <Badge ton={album.publie ? 'succes' : 'neutre'}>{album.publie ? 'Publié' : 'Brouillon'}</Badge>,
    },
  ]

  return (
    <>
      <PageHeader
        titre="Galerie"
        description="Albums et photos du site public."
        miettes={miettesAdmin({ libelle: 'Galerie' })}
        actions={
          <ButtonLink href="/admin/galerie/nouveau" icone={Plus}>
            Nouvel album
          </ButtonLink>
        }
      />
      <Card>
        <div className="border-b border-stone-100 p-4">
          <SearchInput valeur={filtres.q} onChange={rechercher} placeholder="Rechercher un album…" label="Rechercher un album" />
        </div>
        <DataTable
          legende="Liste des albums"
          colonnes={colonnes}
          lignes={albums.data?.albums}
          cleLigne={(album) => album.id}
          chargement={albums.isFetching}
          erreur={albums.isError ? messageErreur(albums.error) : null}
          onReessayer={() => albums.refetch()}
          onLigne={(album) => router.push(`/admin/galerie/${album.id}`)}
          actions={(album) => (
            <ButtonLink href={`/admin/galerie/${album.id}`} variante="fantome" taille="sm" icone={Pencil}>
              Modifier
            </ButtonLink>
          )}
          vide={
            filtres.q
              ? { icone: Images, titre: 'Aucun album ne correspond à cette recherche.', description: 'Modifiez votre recherche.' }
              : {
                  icone: Images,
                  titre: 'Aucun album pour le moment.',
                  description: 'Créez un album pour commencer à organiser les photos du site.',
                  action: (
                    <ButtonLink href="/admin/galerie/nouveau" icone={Plus}>
                      Créer un album
                    </ButtonLink>
                  ),
                }
          }
        />
        {albums.data && (
          <div className="border-t border-stone-100 px-4 py-3">
            <Pagination
              page={albums.data.pagination.page}
              totalPages={albums.data.pagination.totalPages}
              total={albums.data.pagination.total}
              itemLabel="album"
              onPageChange={(page) => setFiltres((f) => ({ ...f, page }))}
            />
          </div>
        )}
      </Card>
    </>
  )
}
