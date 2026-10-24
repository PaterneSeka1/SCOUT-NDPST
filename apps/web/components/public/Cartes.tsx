import Link from 'next/link'
import { LABELS_BRANCHES, LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { dateLongue, jourMois } from '@/lib/format'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ICONES_TYPE_ACTIVITE,
  Images,
  Leaf,
  MapPin,
  Newspaper,
} from '@/lib/icons'
import type { ActivitePublique, AlbumResume, ArticleResume, BranchePublique, MembrePublic } from './types'
import { initiales } from './outils'

/**
 * Image publiée par l'API (chemin relayé /api/… ou stockage public) : balise
 * <img> native, chargement différé et dimensions stables via le conteneur.
 */
export function ImagePublique({
  src,
  alt,
  className = '',
  prioritaire = false,
}: {
  src: string
  alt: string
  className?: string
  prioritaire?: boolean
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={prioritaire ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={prioritaire ? 'high' : undefined}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}

/** Visuel de repli sobre quand aucune image n'est publiée. */
export function VisuelVide({ icone: Icone = Images, className = '' }: { icone?: typeof Images; className?: string }) {
  return (
    <div className={`motif-cercles flex h-full w-full items-center justify-center bg-sable-100 text-sable-500 ${className}`} aria-hidden>
      <Icone className="h-10 w-10" strokeWidth={1.25} />
    </div>
  )
}

export function CarteArticle({ article, titreNiveau = 'h3' }: { article: ArticleResume; titreNiveau?: 'h2' | 'h3' }) {
  const Titre = titreNiveau
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-carte ring-1 ring-stone-200/70 transition hover:-translate-y-0.5 hover:shadow-flottante">
      <div className="aspect-[16/10] overflow-hidden bg-sable-100">
        {article.imageCouverture ? (
          <ImagePublique
            src={article.imageCouverture}
            alt={article.imageAlt ?? ''}
            className="transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <VisuelVide icone={Newspaper} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
          {article.categorie && <span className="font-semibold tracking-wide text-accent uppercase">{article.categorie.nom}</span>}
          <time dateTime={article.datePublication}>{dateLongue(article.datePublication)}</time>
        </div>
        <Titre className="titre-display mt-2 text-xl leading-snug font-semibold text-stone-900">
          <Link href={`/actualites/${article.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {article.titre}
          </Link>
        </Titre>
        {article.resume && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-600">{article.resume}</p>}
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primaire" aria-hidden>
          Lire l&apos;article
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      {/* Focus visible sur toute la carte (lien étendu). */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl ring-primaire group-has-[a:focus-visible]:ring-2" aria-hidden />
    </article>
  )
}

export function CarteActivite({ activite, titreNiveau = 'h3' }: { activite: ActivitePublique; titreNiveau?: 'h2' | 'h3' }) {
  const Titre = titreNiveau
  const { jour, mois } = jourMois(activite.dateDebut)
  const annee = new Date(activite.dateDebut).getFullYear()
  const Icone = ICONES_TYPE_ACTIVITE[activite.type] ?? ClipboardList
  const plusieursJours =
    activite.dateFin && new Date(activite.dateFin).toDateString() !== new Date(activite.dateDebut).toDateString()
  return (
    <article className="flex h-full gap-4 rounded-2xl bg-white p-5 shadow-carte ring-1 ring-stone-200/70">
      <div className="flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-profond text-white">
        <span className="titre-display text-2xl leading-none font-semibold">{jour}</span>
        <span className="mt-1 text-xs tracking-wide text-or-300 uppercase">{mois}</span>
        <span className="text-[0.65rem] text-white/70">{Number.isNaN(annee) ? '' : annee}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta-50 px-2 py-0.5 font-medium text-terracotta-700">
            <Icone className="h-3.5 w-3.5" aria-hidden />
            {LABELS_TYPE_ACTIVITE[activite.type] ?? activite.type}
          </span>
          <span className="rounded-full bg-foret-50 px-2 py-0.5 font-medium text-foret-700">
            {activite.brancheType ? (LABELS_BRANCHES[activite.brancheType] ?? activite.brancheType) : 'Tout le groupe'}
          </span>
        </div>
        <Titre className="mt-2 text-lg leading-snug font-semibold text-stone-900">{activite.titre}</Titre>
        <dl className="mt-2 space-y-1 text-sm text-stone-600">
          <div className="flex items-start gap-1.5">
            <dt className="sr-only">Date</dt>
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            <dd>
              <time dateTime={activite.dateDebut}>{dateLongue(activite.dateDebut)}</time>
              {plusieursJours && activite.dateFin && (
                <>
                  {' '}
                  au <time dateTime={activite.dateFin}>{dateLongue(activite.dateFin)}</time>
                </>
              )}
            </dd>
          </div>
          {activite.lieu && (
            <div className="flex items-start gap-1.5">
              <dt className="sr-only">Lieu</dt>
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
              <dd className="break-words">{activite.lieu}</dd>
            </div>
          )}
        </dl>
        {activite.descriptionPublique && <p className="mt-3 text-sm leading-relaxed text-stone-600">{activite.descriptionPublique}</p>}
      </div>
    </article>
  )
}

export function CarteBranche({ branche, titreNiveau = 'h3' }: { branche: BranchePublique; titreNiveau?: 'h2' | 'h3' }) {
  const Titre = titreNiveau
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-carte ring-1 ring-stone-200/70 transition hover:-translate-y-0.5 hover:shadow-flottante">
      <div className="relative aspect-[4/3] overflow-hidden bg-sable-100">
        {branche.imageUrl ? (
          <ImagePublique src={branche.imageUrl} alt={branche.imageAlt ?? ''} className="transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <VisuelVide icone={Leaf} />
        )}
        {branche.trancheAge && (
          <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-stone-800 shadow-sm">
            {branche.trancheAge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Titre className="titre-display text-xl font-semibold text-stone-900">
          <Link href={`/nos-branches/${branche.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {branche.nom}
          </Link>
        </Titre>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-600">
          {branche.presentation ?? 'La présentation de cette branche sera bientôt publiée.'}
        </p>
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primaire" aria-hidden>
          Découvrir
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <span className="pointer-events-none absolute inset-0 rounded-2xl ring-primaire group-has-[a:focus-visible]:ring-2" aria-hidden />
    </article>
  )
}

export function Portrait({ membre, taille = 'md' }: { membre: Pick<MembrePublic, 'prenom' | 'nom' | 'photo'>; taille?: 'md' | 'lg' }) {
  const dimension = taille === 'lg' ? 'h-28 w-28 text-3xl' : 'h-20 w-20 text-2xl'
  return (
    <div className={`${dimension} shrink-0 overflow-hidden rounded-full bg-foret-50 ring-4 ring-white shadow-carte`}>
      {membre.photo ? (
        <ImagePublique src={membre.photo} alt={`Portrait de ${membre.prenom} ${membre.nom}`} />
      ) : (
        <span className="titre-display flex h-full w-full items-center justify-center font-semibold text-foret-700" aria-hidden>
          {initiales(membre.prenom, membre.nom)}
        </span>
      )}
    </div>
  )
}

export function CarteMembre({
  membre,
  avecBiographie = true,
  titreNiveau = 'h3',
}: {
  membre: MembrePublic
  avecBiographie?: boolean
  titreNiveau?: 'h3' | 'h4'
}) {
  const Titre = titreNiveau
  return (
    <article className="flex h-full flex-col items-center rounded-2xl bg-white p-6 text-center shadow-carte ring-1 ring-stone-200/70">
      <Portrait membre={membre} taille="lg" />
      <Titre className="titre-display mt-4 text-lg font-semibold text-stone-900">
        {membre.prenom} {membre.nom}
      </Titre>
      <p className="mt-1 text-sm font-medium text-accent">{membre.fonction}</p>
      {membre.branche && <p className="mt-0.5 text-xs text-stone-500">{membre.branche}</p>}
      {avecBiographie && membre.biographie && <p className="mt-3 text-sm leading-relaxed text-stone-600">{membre.biographie}</p>}
    </article>
  )
}

export function CarteAlbum({ album, titreNiveau = 'h2' }: { album: AlbumResume; titreNiveau?: 'h2' | 'h3' }) {
  const Titre = titreNiveau
  return (
    <article className="group relative h-full overflow-hidden rounded-2xl bg-white shadow-carte ring-1 ring-stone-200/70 transition hover:-translate-y-0.5 hover:shadow-flottante">
      <div className="aspect-[4/3] overflow-hidden bg-sable-100">
        {album.couverture ? (
          <ImagePublique
            src={album.couverture.url}
            alt={album.couverture.texteAlt ?? ''}
            className="transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <VisuelVide />
        )}
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
          {album.categorie && <span className="font-semibold tracking-wide text-accent uppercase">{album.categorie}</span>}
          {album.dateEvenement && <time dateTime={album.dateEvenement}>{dateLongue(album.dateEvenement)}</time>}
        </div>
        <Titre className="titre-display mt-1.5 text-lg font-semibold text-stone-900">
          <Link href={`/galerie/${album.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {album.titre}
          </Link>
        </Titre>
        <p className="mt-1 text-sm text-stone-500">
          {album.nombrePhotos} photo{album.nombrePhotos > 1 ? 's' : ''}
        </p>
      </div>
      <span className="pointer-events-none absolute inset-0 rounded-2xl ring-primaire group-has-[a:focus-visible]:ring-2" aria-hidden />
    </article>
  )
}

/** Pagination par liens (pages serveur, compatible sans JavaScript). */
export function PaginationLiens({
  page,
  totalPages,
  lien,
}: {
  page: number
  totalPages: number
  lien: (page: number) => string
}) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  )
  const classe =
    'inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-medium transition'
  return (
    <nav aria-label="Pagination" className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={lien(page - 1)} className={`${classe} text-stone-700 hover:bg-stone-100`} rel="prev">
              <ChevronLeft className="h-4 w-4" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:ml-1">Précédente</span>
            </Link>
          ) : (
            <span className={`${classe} text-stone-300`} aria-hidden>
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
        </li>
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-1.5">
            {i > 0 && pages[i - 1] !== p - 1 && (
              <span className="px-1 text-stone-400" aria-hidden>
                …
              </span>
            )}
            <Link
              href={lien(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={`${classe} ${p === page ? 'bg-primaire text-white' : 'text-stone-700 hover:bg-stone-100'}`}
            >
              {p}
            </Link>
          </li>
        ))}
        <li>
          {page < totalPages ? (
            <Link href={lien(page + 1)} className={`${classe} text-stone-700 hover:bg-stone-100`} rel="next">
              <span className="sr-only sm:not-sr-only sm:mr-1">Suivante</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={`${classe} text-stone-300`} aria-hidden>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}

/** Lien « voir tout » discret en fin de section. */
export function LienSuite({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-primaire hover:text-primaire"
    >
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

/** Lien de retour (fil d'Ariane minimal), clair sur fond sombre si besoin. */
export function LienRetour({ href, children, clair = false }: { href: string; children: React.ReactNode; clair?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1.5 text-sm font-medium transition ${
        clair ? 'text-white/80 hover:text-white focus-visible:outline-white' : 'text-stone-600 hover:text-stone-900'
      }`}
    >
      <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" aria-hidden />
      {children}
    </Link>
  )
}
