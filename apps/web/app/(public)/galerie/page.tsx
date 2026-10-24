import type { Metadata } from 'next'
import { lirePublic } from '@/lib/api-public'
import { EnTetePage } from '@/components/public/EnTetePage'
import { CarteAlbum, PaginationLiens } from '@/components/public/Cartes'
import { EtatVidePublic } from '@/components/public/EtatVidePublic'
import type { ListeAlbums } from '@/components/public/contrats'
import { chaineRequete, numeroPage } from '@/components/public/outils'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'Galerie',
  description: 'Les albums photo du groupe scout : camps, sorties, célébrations et moments partagés.',
  alternates: { canonical: '/galerie' },
}

const NOTE_AUTORISATIONS = 'Les photos de mineurs ne sont publiées qu’après vérification des autorisations parentales.'

export default async function PageGalerie({ searchParams }: Props) {
  const page = numeroPage((await searchParams).page)
  const liste = await lirePublic<ListeAlbums>(`/galerie${chaineRequete({ page })}`)
  const albums = liste?.albums ?? []
  const total = liste?.pagination.total ?? 0
  // L'album le plus récent est mis en avant sur la première page seulement.
  const une = page === 1 ? (albums[0] ?? null) : null
  const suite = une ? albums.slice(1) : albums

  return (
    <>
      <EnTetePage
        surtitre="Galerie"
        titre="Moments partagés"
        description="Camps, sorties, célébrations : la vie du groupe en images."
        complement={
          total > 0 ? (
            <p className="text-right">
              <span className="chiffre-signal block text-5xl leading-none text-encre">{total}</span>
              <span className="signal text-sm text-encre-pale">album{total > 1 ? 's' : ''} publié{total > 1 ? 's' : ''}</span>
            </p>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {liste === null ? (
          <EtatVidePublic
            titre="La galerie est momentanément indisponible."
            texte="Nous n’avons pas pu charger les albums. Réessayez dans quelques instants."
            liens={[{ libelle: 'Retour à l’accueil', href: '/' }]}
          />
        ) : albums.length === 0 ? (
          <EtatVidePublic
            titre="Les premiers albums arrivent bientôt."
            texte="Aucun album n’est encore publié. En attendant, découvrez les prochains rendez-vous du groupe et les dernières nouvelles."
            liens={[
              { libelle: 'Voir l’agenda', href: '/activites' },
              { libelle: 'Lire les actualités', href: '/actualites' },
            ]}
            note={NOTE_AUTORISATIONS}
          />
        ) : (
          <>
            <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {une && (
                <li className="flex sm:col-span-2 lg:row-span-2">
                  <CarteAlbum album={une} une />
                </li>
              )}
              {suite.map((a) => (
                <li key={a.slug}>
                  <CarteAlbum album={a} />
                </li>
              ))}
            </ul>
            <PaginationLiens
              page={liste.pagination.page}
              totalPages={liste.pagination.totalPages}
              lien={(p) => `/galerie${chaineRequete({ page: p > 1 ? p : null })}`}
            />
            <p className="mt-12 border-t border-ligne pt-5 text-sm text-encre-pale">{NOTE_AUTORISATIONS}</p>
          </>
        )}
      </div>
    </>
  )
}
