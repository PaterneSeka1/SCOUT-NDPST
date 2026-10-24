// Contrats complémentaires des routes publiques (/api/public/*), alignés sur
// les `select` des services de l'API (site-public, publications, galerie).
import type {
  ActivitePublique,
  AlbumResume,
  ArticleResume,
  BranchePublique,
  MembrePublic,
  PaginationPublique,
} from './types'

/** GET /api/public/branches/:slug */
export interface BrancheDetail extends BranchePublique {
  identite: string | null
  objectifs: string | null
  pedagogie: string | null
  activitesTypes: string | null
  responsables: MembrePublic[]
  activites: ActivitePublique[]
}

/** GET /api/public/publications */
export interface ListeArticles {
  publications: ArticleResume[]
  pagination: PaginationPublique
}

/** GET /api/public/categories */
export interface CategoriePublique {
  nom: string
  slug: string
}

/** GET /api/public/activites */
export interface ListeActivites {
  activites: ActivitePublique[]
  pagination: PaginationPublique
}

/** GET /api/public/galerie */
export interface ListeAlbums {
  albums: AlbumResume[]
  pagination: PaginationPublique
}

/** GET /api/public/galerie/:slug */
export interface AlbumDetail {
  titre: string
  slug: string
  description: string | null
  categorie: string | null
  dateEvenement: string | null
  medias: { id: string; url: string; legende: string | null; texteAlt: string | null }[]
}
