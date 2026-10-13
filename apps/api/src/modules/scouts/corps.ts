import { BadRequestException } from '@nestjs/common'

// Lecture défensive des corps JSON : les routes Next d'origine destructuraient
// le corps sans en vérifier les types, si bien qu'un champ d'un type inattendu
// (nombre à la place d'un texte, null à la place d'un objet…) finissait en
// erreur 500. Ici, ces cas sont rejetés en 400 avant d'atteindre Prisma.

export type Corps = Record<string, unknown>

// Corps attendu : un objet JSON. Express laisse `req.body` à undefined
// lorsqu'aucun corps JSON n'est envoyé.
export function corpsObjet(corps: unknown): Corps {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw new BadRequestException('Données invalides')
  }
  return corps as Corps
}

// Texte facultatif : undefined si absent, sinon une chaîne obligatoirement.
export function texte(corps: Corps, cle: string): string | undefined {
  const valeur = corps[cle]
  if (valeur === undefined) return undefined
  if (typeof valeur !== 'string') throw new BadRequestException(`Champ ${cle} invalide`)
  return valeur
}

// Texte facultatif et effaçable : null est accepté (efface la valeur).
export function texteOuNull(corps: Corps, cle: string): string | null | undefined {
  if (corps[cle] === null) return null
  return texte(corps, cle)
}

// Booléen facultatif.
export function booleen(corps: Corps, cle: string): boolean | undefined {
  const valeur = corps[cle]
  if (valeur === undefined) return undefined
  if (typeof valeur !== 'boolean') throw new BadRequestException(`Champ ${cle} invalide`)
  return valeur
}

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
