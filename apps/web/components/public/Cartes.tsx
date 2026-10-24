import Link from 'next/link'
import { LABELS_BRANCHES, LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { dateLongue, jourMois } from '@/lib/format'
import { accentBranche, encreBranche, styleAccent } from '@/lib/branches-visuel'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ICONES_TYPE_ACTIVITE,
  Images,
  MapPin,
  Newspaper,
} from '@/lib/icons'
import type { ActivitePublique, AlbumResume, ArticleResume, BranchePublique, MembrePublic } from './types'
import { initiales } from './outils'
import { ImagePublique } from './ImagePublique'

export { ImagePublique }

/** Visuel de repli quand aucune image n'est publiée : courbes de niveau et pictogramme. */
export function VisuelVide({ icone: Icone = Images, className = '', teinte }: { icone?: typeof Images; className?: string; teinte?: string }) {
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-papier-fonce text-encre-pale ${className}`}
      style={teinte ? { backgroundColor: `color-mix(in srgb, ${teinte} 12%, var(--color-papier))`, color: teinte } : undefined}
      aria-hidden
    >
      <div className="motif-topo absolute inset-0 opacity-[0.12]" />
      <Icone className="relative h-9 w-9" strokeWidth={1.25} />
    </div>
  )
}

/** Pastille de branche : point de couleur + nom (la couleur n'est jamais seule). */
export function PastilleBranche({ type, libelle, clair = false }: { type: string | null; libelle?: string; clair?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${clair ? 'text-white/85' : 'text-encre-douce'}`}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accentBranche(type) }} aria-hidden />
      {libelle ?? (type ? (LABELS_BRANCHES[type] ?? type) : 'Tout le groupe')}
    </span>
  )
}

/** Article : image, métadonnées, titre. Variante « une » pour l'article mis en avant. */
export function CarteArticle({
  article,
  titreNiveau = 'h3',
  une = false,
}: {
  article: ArticleResume
  titreNiveau?: 'h2' | 'h3'
  une?: boolean
}) {
  const Titre = titreNiveau
  return (
    <article className={`group relative flex h-full flex-col ${une ? 'gap-6 lg:grid lg:grid-cols-12 lg:items-center lg:gap-10' : ''}`}>
      <div className={`overflow-hidden rounded-lg bg-papier-fonce ${une ? 'aspect-[16/10] lg:col-span-7' : 'aspect-[3/2]'}`}>
        {article.imageCouverture ? (
          <ImagePublique src={article.imageCouverture} alt={article.imageAlt ?? ''} className="transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <VisuelVide icone={Newspaper} />
        )}
      </div>
      <div className={`flex flex-1 flex-col ${une ? 'lg:col-span-5' : 'pt-4'}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-encre-pale">
          {article.categorie && <span className="signal text-xs text-accent">{article.categorie.nom}</span>}
          <time dateTime={article.datePublication}>{dateLongue(article.datePublication)}</time>
        </div>
        <Titre className={`titre-display mt-2 leading-snug font-semibold text-encre text-balance ${une ? 'text-3xl sm:text-4xl' : 'text-xl'}`}>
          <Link
            href={`/actualites/${article.slug}`}
            className="decoration-accent decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0 focus-visible:outline-none"
          >
            {article.titre}
          </Link>
        </Titre>
        {article.resume && (
          <p className={`mt-2 leading-relaxed text-encre-douce ${une ? 'text-lg line-clamp-4' : 'text-[0.95rem] line-clamp-3'}`}>{article.resume}</p>
        )}
      </div>
      <span className="pointer-events-none absolute -inset-2 rounded-xl ring-primaire group-has-[a:focus-visible]:ring-2" aria-hidden />
    </article>
  )
}

/** Activité en ligne d'agenda : date signalétique, type, branche, lieu. */
export function CarteActivite({
  activite,
  titreNiveau = 'h3',
  passee = false,
}: {
  activite: ActivitePublique
  titreNiveau?: 'h2' | 'h3'
  passee?: boolean
}) {
  const Titre = titreNiveau
  const { jour, mois } = jourMois(activite.dateDebut)
  const Icone = ICONES_TYPE_ACTIVITE[activite.type] ?? ClipboardList
  const plusieursJours = activite.dateFin && new Date(activite.dateFin).toDateString() !== new Date(activite.dateDebut).toDateString()
  return (
    <article className="flex h-full gap-4 sm:gap-6" style={styleAccent(activite.brancheType)}>
      <div
        className={`flex w-16 shrink-0 flex-col items-center justify-start border-t-4 pt-2 sm:w-20 ${passee ? 'text-encre-pale' : 'text-encre'}`}
        style={{ borderColor: passee ? 'var(--color-ligne-forte)' : 'var(--accent-branche)' }}
      >
        <span className="chiffre-signal text-4xl leading-none sm:text-5xl">{jour}</span>
        <span className="signal mt-1 text-xs">{mois}</span>
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta-700">
            <Icone className="h-4 w-4" aria-hidden />
            {LABELS_TYPE_ACTIVITE[activite.type] ?? activite.type}
          </span>
          <PastilleBranche type={activite.brancheType} />
        </div>
        <Titre className="titre-display mt-1.5 text-xl leading-snug font-semibold text-balance text-encre">{activite.titre}</Titre>
        <p className="mt-1 text-[0.95rem] text-encre-douce">
          <time dateTime={activite.dateDebut}>{dateLongue(activite.dateDebut)}</time>
          {plusieursJours && activite.dateFin && (
            <>
              {' '}
              au <time dateTime={activite.dateFin}>{dateLongue(activite.dateFin)}</time>
            </>
          )}
        </p>
        {activite.lieu && (
          <p className="mt-1 flex items-start gap-1.5 text-[0.95rem] text-encre-douce">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-encre-pale" aria-hidden />
            <span className="sr-only">Lieu : </span>
            <span className="break-words">{activite.lieu}</span>
          </p>
        )}
        {activite.descriptionPublique && <p className="mt-3 max-w-prose leading-relaxed text-encre-douce">{activite.descriptionPublique}</p>}
      </div>
    </article>
  )
}

/** Branche en carte compacte (accueil, liens croisés). */
export function CarteBranche({ branche, titreNiveau = 'h3' }: { branche: BranchePublique; titreNiveau?: 'h2' | 'h3' }) {
  const Titre = titreNiveau
  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-ligne bg-white transition hover:border-ligne-forte hover:shadow-carte"
      style={styleAccent(branche.type)}
    >
      <span className="h-1.5 w-full bg-(--accent-branche)" aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        {branche.trancheAge && <p className="chiffre-signal text-lg text-(--encre-branche)">{branche.trancheAge}</p>}
        <Titre className="titre-display mt-1 text-xl font-semibold text-encre">
          <Link href={`/nos-branches/${branche.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {branche.nom}
          </Link>
        </Titre>
        {branche.presentation && <p className="mt-2 line-clamp-3 text-[0.95rem] leading-relaxed text-encre-douce">{branche.presentation}</p>}
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-encre" aria-hidden>
          Découvrir
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <span className="pointer-events-none absolute inset-0 rounded-lg ring-primaire group-has-[a:focus-visible]:ring-2" aria-hidden />
    </article>
  )
}

/** Portrait : photo publiée ou monogramme teinté selon la branche. */
export function Portrait({
  membre,
  forme = 'rond',
  className = '',
}: {
  membre: Pick<MembrePublic, 'prenom' | 'nom' | 'photo'> & { brancheType?: string | null }
  forme?: 'rond' | 'portrait'
  className?: string
}) {
  const accent = accentBranche(membre.brancheType)
  const encre = encreBranche(membre.brancheType)
  return (
    <div
      className={`relative shrink-0 overflow-hidden ${forme === 'rond' ? 'aspect-square rounded-full' : 'aspect-[4/5] rounded-lg'} ${className}`}
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, var(--color-papier))` }}
    >
      {membre.photo ? (
        <ImagePublique src={membre.photo} alt={`Portrait de ${membre.prenom} ${membre.nom}`} />
      ) : (
        <span className="titre-display flex h-full w-full items-center justify-center text-[2.4em] font-semibold" style={{ color: encre }} aria-hidden>
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
    <article className="flex h-full flex-col" style={styleAccent(membre.brancheType)}>
      <Portrait membre={membre} forme="portrait" className="w-full text-base" />
      <div className="mt-3 border-l-2 border-(--accent-branche) pl-3">
        <Titre className="titre-display text-lg leading-snug font-semibold text-encre">
          {membre.prenom} {membre.nom}
        </Titre>
        <p className="text-[0.95rem] font-medium text-encre-douce">{membre.fonction}</p>
        {membre.branche && <p className="text-sm text-encre-pale">{membre.branche}</p>}
      </div>
      {avecBiographie && membre.biographie && <p className="mt-3 text-[0.95rem] leading-relaxed text-encre-douce">{membre.biographie}</p>}
    </article>
  )
}

/** Album : couverture photographique et légende. Variante « une » plus grande. */
export function CarteAlbum({ album, titreNiveau = 'h2', une = false }: { album: AlbumResume; titreNiveau?: 'h2' | 'h3'; une?: boolean }) {
  const Titre = titreNiveau
  return (
    <article className="group relative flex h-full flex-col">
      <div className={`relative overflow-hidden rounded-lg bg-papier-fonce ${une ? 'aspect-[4/3] lg:aspect-auto lg:min-h-[26rem] lg:flex-1' : 'aspect-[4/3]'}`}>
        {album.couverture ? (
          <ImagePublique
            src={album.couverture.url}
            alt={album.couverture.texteAlt ?? ''}
            className={`transition duration-700 group-hover:scale-[1.03] ${une ? 'lg:absolute lg:inset-0' : ''}`}
          />
        ) : (
          <VisuelVide />
        )}
        <span className="chiffre-signal absolute right-3 bottom-3 rounded bg-black/65 px-2 py-0.5 text-sm text-white">
          {album.nombrePhotos} photo{album.nombrePhotos > 1 ? 's' : ''}
        </span>
      </div>
      <div className="pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-encre-pale">
          {album.categorie && <span className="signal text-xs text-accent">{album.categorie}</span>}
          {album.dateEvenement && <time dateTime={album.dateEvenement}>{dateLongue(album.dateEvenement)}</time>}
        </div>
        <Titre className={`titre-display mt-1 leading-snug font-semibold text-encre text-balance ${une ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>
          <Link
            href={`/galerie/${album.slug}`}
            className="decoration-accent decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0 focus-visible:outline-none"
          >
            {album.titre}
          </Link>
        </Titre>
        {une && album.description && <p className="mt-2 line-clamp-2 text-encre-douce">{album.description}</p>}
      </div>
      <span className="pointer-events-none absolute -inset-2 rounded-xl ring-primaire group-has-[a:focus-visible]:ring-2" aria-hidden />
    </article>
  )
}

/** Pagination par liens (pages serveur, compatible sans JavaScript). */
export function PaginationLiens({ page, totalPages, lien }: { page: number; totalPages: number; lien: (page: number) => string }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
  const classe = 'inline-flex h-10 min-w-10 items-center justify-center rounded-md px-3 text-sm font-medium transition'
  return (
    <nav aria-label="Pagination" className="mt-14 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={lien(page - 1)} className={`${classe} text-encre-douce hover:bg-papier-fonce`} rel="prev">
              <ChevronLeft className="h-4 w-4" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:ml-1">Précédente</span>
            </Link>
          ) : (
            <span className={`${classe} text-ligne-forte`} aria-hidden>
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
        </li>
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-1.5">
            {i > 0 && pages[i - 1] !== p - 1 && (
              <span className="px-1 text-encre-pale" aria-hidden>
                …
              </span>
            )}
            <Link
              href={lien(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={`${classe} chiffre-signal text-base ${p === page ? 'bg-encre text-white' : 'text-encre-douce hover:bg-papier-fonce'}`}
            >
              {p}
            </Link>
          </li>
        ))}
        <li>
          {page < totalPages ? (
            <Link href={lien(page + 1)} className={`${classe} text-encre-douce hover:bg-papier-fonce`} rel="next">
              <span className="sr-only sm:not-sr-only sm:mr-1">Suivante</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={`${classe} text-ligne-forte`} aria-hidden>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}

/** Lien « voir tout » de fin de section. */
export function LienSuite({ href, children, clair = false }: { href: string; children: React.ReactNode; clair?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1.5 border-b-2 pb-0.5 text-[0.95rem] font-semibold transition ${
        clair ? 'border-or-300 text-white hover:text-or-300 focus-visible:outline-white' : 'border-accent text-encre hover:text-accent'
      }`}
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
        clair ? 'text-white/80 hover:text-white focus-visible:outline-white' : 'text-encre-douce hover:text-encre'
      }`}
    >
      <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" aria-hidden />
      {children}
    </Link>
  )
}
