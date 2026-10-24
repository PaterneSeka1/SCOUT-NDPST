// Petits utilitaires d'affichage du site public (sans dépendance serveur).

/** Lit un paramètre de recherche unique (le premier si répété). */
export function parametre(valeur: string | string[] | undefined): string {
  return (Array.isArray(valeur) ? valeur[0] : valeur)?.trim() ?? ''
}

/** Numéro de page valide (entier ≥ 1). */
export function numeroPage(valeur: string | string[] | undefined): number {
  const page = Number.parseInt(parametre(valeur), 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

/** Initiales d'une personne (photo absente). */
export function initiales(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase() || '?'
}

/** Construit une query string en ignorant les valeurs vides ou par défaut. */
export function chaineRequete(params: Record<string, string | number | null | undefined>): string {
  const recherche = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') recherche.set(cle, String(valeur))
  }
  const texte = recherche.toString()
  return texte ? `?${texte}` : ''
}

/** Extrait court et propre d'un texte (métadonnées, aperçus). */
export function extrait(texte: string | null | undefined, longueur = 160): string {
  const propre = (texte ?? '').replace(/[#>*_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (propre.length <= longueur) return propre
  return `${propre.slice(0, longueur - 1).replace(/\s+\S*$/, '')}…`
}
