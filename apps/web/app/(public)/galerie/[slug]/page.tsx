import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { lirePublic } from '@/lib/api-public'
import { dateLongue } from '@/lib/format'
import { LienRetour } from '@/components/public/Cartes'
import { Visionneuse } from '@/components/public/Visionneuse'
import type { AlbumDetail } from '@/components/public/contrats'
import { extrait } from '@/components/public/outils'

type Props = { params: Promise<{ slug: string }> }

const lireAlbum = (slug: string) => lirePublic<AlbumDetail>(`/galerie/${encodeURIComponent(slug)}`)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const album = await lireAlbum(slug)
  if (!album) return { title: 'Album introuvable' }
  const couverture = album.medias[0]
  return {
    title: album.titre,
    description: extrait(album.description || `Album photo « ${album.titre} » du groupe scout.`),
    alternates: { canonical: `/galerie/${album.slug}` },
    openGraph: couverture ? { images: [{ url: couverture.url, alt: couverture.texteAlt ?? '' }] } : undefined,
  }
}

export default async function PageAlbum({ params }: Props) {
  const { slug } = await params
  const album = await lireAlbum(slug)
  if (!album) notFound()

  return (
    <>
      <header className="motif-cercles bg-sable-50 pt-28 pb-12 sm:pt-36 sm:pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <LienRetour href="/galerie">Tous les albums</LienRetour>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
            {album.categorie && <span className="font-semibold tracking-wide text-accent uppercase">{album.categorie}</span>}
            {album.dateEvenement && <time dateTime={album.dateEvenement}>{dateLongue(album.dateEvenement)}</time>}
            <span>
              {album.medias.length} photo{album.medias.length > 1 ? 's' : ''}
            </span>
          </div>
          <h1 className="titre-display mt-3 text-4xl font-semibold text-stone-900 sm:text-5xl">{album.titre}</h1>
          {album.description && <p className="mt-4 max-w-3xl text-lg leading-relaxed text-stone-600">{album.description}</p>}
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-label="Photos de l’album">
        <Visionneuse photos={album.medias} titreAlbum={album.titre} />
      </section>
    </>
  )
}
