import type { Metadata } from 'next'
import Link from 'next/link'
import { lirePublic } from '@/lib/api-public'
import { Search } from '@/lib/icons'
import { EnTetePage, Section } from '@/components/public/EnTetePage'
import { CarteArticle, LienSuite, PaginationLiens } from '@/components/public/Cartes'
import { EtatVidePublic } from '@/components/public/EtatVidePublic'
import type { CategoriePublique, ListeArticles } from '@/components/public/contrats'
import { chaineRequete, numeroPage, parametre } from '@/components/public/outils'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams
  const filtre = !!parametre(sp.q) || numeroPage(sp.page) > 1
  return {
    title: 'Actualités',
    description: 'Les nouvelles du groupe scout : camps, célébrations, sorties et vie de la paroisse.',
    alternates: { canonical: '/actualites' },
    // Les pages de recherche ne sont pas indexées (contenu dupliqué).
    robots: filtre ? { index: false, follow: true } : undefined,
  }
}

export default async function PageActualites({ searchParams }: Props) {
  const sp = await searchParams
  const q = parametre(sp.q).slice(0, 100)
  const categorie = parametre(sp.categorie).slice(0, 80)
  const page = numeroPage(sp.page)

  const [liste, categories] = await Promise.all([
    lirePublic<ListeArticles>(`/publications${chaineRequete({ q, categorie, page })}`),
    lirePublic<CategoriePublique[]>('/categories'),
  ])
  const articles = liste?.publications ?? []
  const lien = (p: number, cat = categorie) => `/actualites${chaineRequete({ q, categorie: cat, page: p > 1 ? p : null })}`
  const filtres = !!q || !!categorie
  // Article à la une : première page sans filtre uniquement.
  const une = !filtres && page === 1 ? (articles[0] ?? null) : null
  const suite = une ? articles.slice(1) : articles

  return (
    <>
      <EnTetePage
        surtitre="Actualités"
        titre="La vie du groupe"
        description="Camps, célébrations, sorties et temps forts : les nouvelles publiées par le groupe."
        complement={<LienSuite href="/activites">Voir l’agenda</LienSuite>}
      />
      <Section>
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {categories && categories.length > 0 && (
            <nav aria-label="Catégories d’actualités">
              <ul className="flex flex-wrap gap-2">
                {[{ nom: 'Toutes', slug: '' }, ...categories].map((c) => {
                  const actif = categorie === c.slug
                  return (
                    <li key={c.slug || 'toutes'}>
                      <Link
                        href={`/actualites${chaineRequete({ q, categorie: c.slug })}`}
                        aria-current={actif ? 'page' : undefined}
                        className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
                          actif ? 'bg-encre text-white' : 'bg-white text-encre-douce ring-1 ring-ligne hover:ring-ligne-forte'
                        }`}
                      >
                        {c.nom}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}
          <form role="search" action="/actualites" method="get" className="flex w-full gap-2 lg:max-w-sm">
            {categorie && <input type="hidden" name="categorie" value={categorie} />}
            <label htmlFor="recherche-actualites" className="sr-only">
              Rechercher une actualité
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden />
              <input
                id="recherche-actualites"
                type="search"
                name="q"
                defaultValue={q}
                maxLength={100}
                placeholder="Rechercher…"
                className="h-11 w-full rounded-full border border-ligne-forte bg-white pr-4 pl-10 text-sm focus:border-primaire focus:ring-2 focus:ring-primaire/20 focus:outline-none"
              />
            </div>
            <button type="submit" className="h-11 rounded-full bg-primaire px-5 text-sm font-semibold text-white transition hover:brightness-110">
              Rechercher
            </button>
          </form>
        </div>

        {q && (
          <p className="mb-6 text-sm text-encre-douce" role="status">
            {liste?.pagination.total ?? 0} résultat{(liste?.pagination.total ?? 0) > 1 ? 's' : ''} pour « {q} »{' '}
            <Link href={`/actualites${chaineRequete({ categorie })}`} className="ml-2 font-medium text-primaire underline underline-offset-2">
              Effacer la recherche
            </Link>
          </p>
        )}

        {liste === null ? (
          <EtatVidePublic titre="Les actualités sont momentanément indisponibles." texte="Réessayez dans quelques instants." liens={[{ libelle: 'Retour à l’accueil', href: '/' }]} />
        ) : articles.length === 0 ? (
          <EtatVidePublic
            titre={filtres ? 'Aucune actualité ne correspond à votre recherche.' : 'Les premières nouvelles arrivent bientôt.'}
            texte={filtres ? 'Essayez d’autres mots-clés ou une autre catégorie.' : 'Aucune actualité n’est encore publiée. Consultez l’agenda pour connaître les prochains rendez-vous.'}
            liens={filtres ? [{ libelle: 'Toutes les actualités', href: '/actualites' }] : [{ libelle: 'Voir l’agenda', href: '/activites' }]}
          />
        ) : (
          <>
            {une && (
              <div className="mb-14 border-b border-ligne pb-14">
                <CarteArticle article={une} titreNiveau="h2" une />
              </div>
            )}
            {suite.length > 0 && (
              <ul className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
                {suite.map((a) => (
                  <li key={a.id}>
                    <CarteArticle article={a} titreNiveau="h2" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {liste && <PaginationLiens page={liste.pagination.page} totalPages={liste.pagination.totalPages} lien={(p) => lien(p)} />}
      </Section>
    </>
  )
}
