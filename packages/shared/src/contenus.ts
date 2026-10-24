// Règles pures des contenus publics : slugs, libellés, rendu sûr du texte
// éditorial et visibilité des photos. Partagées par l'API (validation) et le
// frontend (aperçu, rendu public).

export const LABELS_STATUT_PUBLICATION: Record<string, string> = {
  BROUILLON: 'Brouillon',
  PUBLIEE: 'Publiée',
  ARCHIVEE: 'Archivée',
}

export const LABELS_TYPE_EVENEMENT_HISTORIQUE: Record<string, string> = {
  ORIGINE: 'Origines',
  FONDATION: 'Fondation',
  CHEF_DE_GROUPE: 'Chef de groupe',
  CAMP: 'Camp historique',
  ETAPE: 'Grande étape',
  TEMOIGNAGE: 'Témoignage',
  ARCHIVE: "Document d'archive",
}

export const LABELS_STATUT_VALIDATION_HISTORIQUE: Record<string, string> = {
  A_VERIFIER: 'À confirmer par les archives',
  VALIDE: 'Confirmé par une source',
}

export const LABELS_TYPE_DEMANDE: Record<string, string> = {
  INSCRIPTION_JEUNE: "Inscription d'un jeune",
  ENGAGEMENT_ADULTE: 'Engagement comme adulte',
  INFORMATION: "Demande d'information",
}

export const LABELS_STATUT_DEMANDE: Record<string, string> = {
  NOUVELLE: 'Nouvelle',
  EN_COURS: 'En cours',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
  ARCHIVEE: 'Archivée',
}

/** Slug d'URL : minuscules ASCII, chiffres et tirets (accents retirés). */
export function slugifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Slug public de chaque branche du référentiel (identique à la migration). */
export const SLUGS_BRANCHES: Record<string, string> = {
  OISILLONS: 'oisillons',
  LOUVETEAUX: 'louveteaux',
  ECLAIREURS: 'eclaireurs',
  CHEMINOTS: 'cheminots',
  COMPAGNONS: 'compagnons',
  RESSOURCES_ADULTES: 'ressources-adultes',
}

// ---------------------------------------------------------------------------
// Texte éditorial structuré léger. Aucun HTML n'est jamais interprété : le
// texte est découpé en blocs typés, rendus par des composants React (échappement
// automatique). Syntaxe : « ## Titre », « ### Sous-titre », « - élément »,
// « > citation », paragraphes séparés par une ligne vide.
// ---------------------------------------------------------------------------

export type BlocContenu =
  | { type: 'titre'; niveau: 2 | 3; texte: string }
  | { type: 'paragraphe'; texte: string }
  | { type: 'liste'; elements: string[] }
  | { type: 'citation'; texte: string }

export function analyserContenu(texte: string): BlocContenu[] {
  const blocs: BlocContenu[] = []
  let paragraphe: string[] = []
  let liste: string[] = []
  let citation: string[] = []

  const vider = () => {
    if (paragraphe.length) blocs.push({ type: 'paragraphe', texte: paragraphe.join(' ') })
    if (liste.length) blocs.push({ type: 'liste', elements: liste })
    if (citation.length) blocs.push({ type: 'citation', texte: citation.join(' ') })
    paragraphe = []
    liste = []
    citation = []
  }

  for (const brute of texte.replace(/\r\n?/g, '\n').split('\n')) {
    const ligne = brute.trim()
    if (!ligne) {
      vider()
      continue
    }
    const titre = /^(#{2,3})\s+(.+)$/.exec(ligne)
    if (titre) {
      vider()
      blocs.push({ type: 'titre', niveau: titre[1].length === 2 ? 2 : 3, texte: titre[2].trim() })
      continue
    }
    const element = /^[-*]\s+(.+)$/.exec(ligne)
    if (element) {
      if (paragraphe.length || citation.length) vider()
      liste.push(element[1].trim())
      continue
    }
    const cite = /^>\s?(.*)$/.exec(ligne)
    if (cite) {
      if (paragraphe.length || liste.length) vider()
      citation.push(cite[1].trim())
      continue
    }
    if (liste.length || citation.length) vider()
    paragraphe.push(ligne)
  }
  vider()
  return blocs
}

/** Résumé automatique (texte brut) quand l'auteur n'en a pas saisi. */
export function resumeAutomatique(texte: string, longueur = 180): string {
  const brut = analyserContenu(texte)
    .map((b) => (b.type === 'liste' ? b.elements.join(', ') : b.texte))
    .join(' ')
  return brut.length <= longueur ? brut : `${brut.slice(0, longueur).replace(/\s+\S*$/, '')}…`
}

/**
 * Une photo n'est visible du public que si elle est publiée, dans un album
 * publié, et — si elle montre des mineurs — après vérification explicite des
 * consentements à l'image. Jamais de publication automatique.
 */
export function mediaVisiblePublic(media: {
  publie: boolean
  contientMineurs: boolean
  consentementVerifie: boolean
  album?: { publie: boolean } | null
}): boolean {
  if (!media.publie || media.album?.publie === false) return false
  return !media.contientMineurs || media.consentementVerifie
}

/** URL https d'un réseau social (refuse javascript:, http:, etc.). */
export function estUrlHttps(valeur: unknown): valeur is string {
  if (typeof valeur !== 'string') return false
  try {
    const url = new URL(valeur)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export const RESEAUX_SOCIAUX = ['facebook', 'instagram', 'youtube', 'whatsapp', 'tiktok'] as const
export type ReseauSocial = (typeof RESEAUX_SOCIAUX)[number]
