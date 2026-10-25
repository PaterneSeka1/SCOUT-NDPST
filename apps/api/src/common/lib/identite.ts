// Comparaison des noms insensible à la casse, aux accents et aux espaces
// multiples. Côté base, `translate` couvre les lettres accentuées usuelles
// (minuscules et majuscules, sans dépendre de l'extension PostgreSQL unaccent
// ni de la locale) ; ces tables restent alignées sur normaliserNom (vérifié
// par les tests).
const ACCENTS_MINUSCULES = 'àáâãäåāăąçćĉċčďèéêëēĕėęěìíîïĩīĭįñńňòóôõöōŏőùúûüũūŭůűųýÿŷźżž'
const BASES_MINUSCULES = 'aaaaaaaaacccccdeeeeeeeeeiiiiiiiinnnoooooooouuuuuuuuuuyyyzzz'
export const ACCENTS_SOURCE = ACCENTS_MINUSCULES + ACCENTS_MINUSCULES.toUpperCase()
export const ACCENTS_CIBLE = BASES_MINUSCULES + BASES_MINUSCULES

export function normaliserNom(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
