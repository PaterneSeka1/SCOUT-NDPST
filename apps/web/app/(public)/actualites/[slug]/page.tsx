import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { lirePublic } from '@/lib/api-public'
import { getIdentite } from '@/lib/identite-serveur'
import { nomAffiche } from '@/lib/identite'
import { dateLongue } from '@/lib/format'
import { ContenuRiche } from '@/components/contenu/ContenuRiche'
import { ImagePublique, LienRetour, LienSuite } from '@/components/public/Cartes'
import type { Article } from '@/components/public/types'
import { extrait } from '@/components/public/outils'

type Props = { params: Promise<{ slug: string }> }

const lireArticle = (slug: string) => lirePublic<Article>(`/publications/${encodeURIComponent(slug)}`)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await lireArticle(slug)
  if (!article) return { title: 'Article introuvable' }
  const titre = article.seoTitre || article.titre
  const description = article.seoDescription || extrait(article.resume || article.contenu)
  return {
    title: titre,
    description,
    alternates: { canonical: `/actualites/${article.slug}` },
    openGraph: {
      type: 'article',
      title: titre,
      description,
      publishedTime: article.datePublication,
      authors: article.auteur ? [`${article.auteur.prenom} ${article.auteur.nom}`] : undefined,
      images: article.imageCouverture ? [{ url: article.imageCouverture, alt: article.imageAlt ?? '' }] : undefined,
    },
  }
}

export default async function PageArticle({ params }: Props) {
  const { slug } = await params
  const [article, identite] = await Promise.all([lireArticle(slug), getIdentite()])
  if (!article) notFound()

  const auteur = article.auteur ? `${article.auteur.prenom} ${article.auteur.nom}` : null
  // Données structurées (schema.org) : échappement de « < » contre toute injection.
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.titre,
    datePublished: article.datePublication,
    ...(article.imageCouverture ? { image: [article.imageCouverture] } : {}),
    ...(auteur ? { author: [{ '@type': 'Person', name: auteur }] } : {}),
    publisher: { '@type': 'Organization', name: nomAffiche(identite) },
  }).replace(/</g, '\\u003c')

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="motif-cercles bg-sable-50 pt-28 pb-12 sm:pt-36 sm:pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <LienRetour href="/actualites">Toutes les actualités</LienRetour>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
            {article.categorie && (
              <Link
                href={`/actualites?categorie=${encodeURIComponent(article.categorie.slug)}`}
                className="font-semibold tracking-wide text-accent uppercase hover:underline"
              >
                {article.categorie.nom}
              </Link>
            )}
            <time dateTime={article.datePublication}>{dateLongue(article.datePublication)}</time>
            {auteur && <span>Par {auteur}</span>}
          </div>
          <h1 className="titre-display mt-3 text-3xl leading-tight font-semibold text-stone-900 sm:text-5xl">{article.titre}</h1>
          {article.resume && <p className="mt-5 text-lg leading-relaxed text-stone-600">{article.resume}</p>}
        </div>
      </header>

      {article.imageCouverture && (
        <div className="mx-auto -mt-2 max-w-5xl px-4 sm:px-6">
          <figure className="aspect-[16/9] overflow-hidden rounded-3xl bg-sable-100 shadow-flottante">
            <ImagePublique src={article.imageCouverture} alt={article.imageAlt ?? ''} prioritaire />
          </figure>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <ContenuRiche texte={article.contenu} className="text-lg" />
        <div className="mt-14 border-t border-stone-200 pt-8">
          <LienSuite href="/actualites">Lire d’autres actualités</LienSuite>
        </div>
      </div>
    </article>
  )
}
