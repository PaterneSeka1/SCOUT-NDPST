// Paramètre de query string : Express produit un tableau quand le paramètre
// est répété — on retient la première valeur, comme URLSearchParams.get().
export function premiereValeur(valeur: unknown): string | null {
  if (typeof valeur === 'string') return valeur
  if (Array.isArray(valeur) && typeof valeur[0] === 'string') return valeur[0]
  return null
}

// Champ texte d'un objet quelconque (ligne d'import, contact d'urgence…) :
// tout ce qui n'est pas une chaîne est traité comme absent.
export function chaine(objet: unknown, cle: string): string | undefined {
  if (typeof objet !== 'object' || objet === null) return undefined
  const valeur = (objet as Record<string, unknown>)[cle]
  return typeof valeur === 'string' ? valeur : undefined
}
