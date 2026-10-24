import type { Metadata } from 'next'
import { lirePublic } from '@/lib/api-public'
import { Images } from '@/lib/icons'
import { EmptyState } from '@/components/ui'
import { EnTetePage, Section } from '@/components/public/EnTetePage'
import { CarteAlbum, PaginationLiens } from '@/components/public/Cartes'
import type { ListeAlbums } from '@/components/public/contrats'
import { chaineRequete, numeroPage } from '@/components/public/outils'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'Galerie',
  description: 'Les albums photo du groupe scout : camps, sorties, célébrations et moments partagés.',
  alternates: { canonical: '/galerie' },
}

export default async function PageGalerie({ searchParams }: Props) {
  const page = numeroPage((await searchParams).page)
  const liste = await lirePublic<ListeAlbums>(`/galerie${chaineRequete({ page })}`)
  const albums = liste?.albums ?? []

  return (
    <>
      <EnTetePage
        surtitre="Galerie"
        titre="Moments partagés"
        description="Les photos publiées par le groupe. Les images de mineurs ne sont mises en ligne qu’après vérification des autorisations."
      />
      <Section>
        {albums.length === 0 ? (
          <EmptyState icon={Images} title="Aucun album n’est publié pour le moment." description="Les prochains albums paraîtront ici." />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((a) => (
              <li key={a.slug}>
                <CarteAlbum album={a} />
              </li>
            ))}
          </ul>
        )}
        {liste && (
          <PaginationLiens
            page={liste.pagination.page}
            totalPages={liste.pagination.totalPages}
            lien={(p) => `/galerie${chaineRequete({ page: p > 1 ? p : null })}`}
          />
        )}
      </Section>
    </>
  )
}
