// Contrats des routes publiques de l'API (/api/public/*).

export interface BranchePublique {
  type: string
  slug: string
  nom: string
  trancheAge: string | null
  presentation: string | null
  imageUrl: string | null
  imageAlt: string | null
}

export interface MembrePublic {
  id: string
  prenom: string
  nom: string
  fonction: string
  branche: string | null
  /** Code de branche ; null pour la direction du groupe. */
  brancheType?: string | null
  photo: string | null
  biographie: string | null
}

export interface ActivitePublique {
  id: string
  titre: string
  descriptionPublique: string | null
  dateDebut: string
  dateFin: string | null
  lieu: string | null
  type: string
  brancheType: string | null
  statut: string
}

export interface ArticleResume {
  id: string
  titre: string
  slug: string
  resume: string | null
  imageCouverture: string | null
  imageAlt: string | null
  datePublication: string
  categorie: { id: string; nom: string; slug: string } | null
  auteur: { prenom: string; nom: string } | null
}

export interface Article {
  titre: string
  slug: string
  resume: string | null
  contenu: string
  imageCouverture: string | null
  imageAlt: string | null
  datePublication: string
  seoTitre: string | null
  seoDescription: string | null
  categorie: { nom: string; slug: string } | null
  auteur: { prenom: string; nom: string } | null
}

export interface PhotoPublique {
  id: string
  url: string
  legende: string | null
  texteAlt: string | null
  album?: { slug: string; titre: string }
}

export interface AlbumResume {
  titre: string
  slug: string
  description: string | null
  categorie: string | null
  dateEvenement: string | null
  nombrePhotos: number
  couverture: { url: string; texteAlt: string | null } | null
}

export interface EvenementHistoriquePublic {
  id: string
  annee: number
  date: string | null
  titre: string
  description: string | null
  type: string
  auteurTemoignage: string | null
  imageUrl: string | null
  imageAlt: string | null
  documentUrl: string | null
  source: string | null
  statutValidation: 'A_VERIFIER' | 'VALIDE'
}

export interface PaginationPublique {
  page: number
  limite: number
  total: number
  totalPages: number
}

export interface Accueil {
  branches: BranchePublique[]
  actualites: ArticleResume[]
  activites: ActivitePublique[]
  photos: PhotoPublique[]
  equipe: MembrePublic[]
  histoire: { annee: number; titre: string; statutValidation: string }[]
}
