import { BrancheTypeSchema } from '@scout/shared'
import { z } from 'zod'

// Briques communes aux schémas Zod des routes d'administration plateforme.
// Elles ne portent que la forme des données : autorisations, unicité et
// existence en base restent dans les services.

// Corps JSON d'une requête d'administration : un objet (jamais un tableau ni
// une valeur scalaire). Les clés inconnues sont retirées, rien n'est transmis
// tel quel à Prisma.
export function corpsAdmin<T extends z.ZodRawShape>(forme: T) {
  return z.object(forme, { error: 'Données invalides' })
}

// Champ texte optionnel : undefined s'il est absent, chaîne vide s'il vaut
// null (effacement), rejet en 400 s'il est d'un autre type.
export function champTexte(cle: string) {
  return z
    .string({ error: `Le champ ${cle} est invalide` })
    .nullish()
    .transform((valeur) => (valeur === null ? '' : valeur))
}

// Même règle, valeur débarrassée de ses espaces de début et de fin.
export function champTexteNettoye(cle: string) {
  return champTexte(cle).transform((valeur) => valeur?.trim())
}

export function champBooleen(cle: string) {
  return z.boolean({ error: `Le champ ${cle} est invalide` }).optional()
}

// Champ texte facultatif ou effaçable : absent → undefined, null → null,
// sinon texte nettoyé (vide → null). Tout autre type est rejeté avec `message`.
export function champTexteEffacable(message: string) {
  return z
    .string({ error: message })
    .nullish()
    .transform((valeur) => (valeur === undefined ? undefined : valeur?.trim() || null))
}

// Branche absente, nulle ou appartenant à l'énumération BrancheType.
export function brancheValide(valeur: unknown): boolean {
  return valeur == null || BrancheTypeSchema.safeParse(valeur).success
}
