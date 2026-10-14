import { z } from 'zod'
import { BrancheTypeSchema } from '@scout/shared'

// Schémas des corps de requête du module Programmes. Seule la forme des
// données est contrôlée ici ; les droits (rôle, branche, district), l'existence
// en base et la cohérence avec les dates existantes restent dans ProgrammesService.

// Historiquement, un corps qui n'est pas un objet est traité comme un objet vide.
function objetOuVide(valeur: unknown): unknown {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur) ? valeur : {}
}

// Champ texte : chaîne obligatoirement (jamais un objet transmis tel quel à Prisma).
function texte(champ: string) {
  return z.string({ error: `${champ} doit être une chaîne de caractères` })
}

// Champ texte requis : absent ou vide = messageRequis, autre type = message de type.
function texteRequis(champ: string, messageRequis: string) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined ? messageRequis : `${champ} doit être une chaîne de caractères`,
    })
    .min(1, messageRequis)
}

function dateValide(valeur: string): boolean {
  return !Number.isNaN(new Date(valeur).getTime())
}

const MESSAGE_DATE_INVALIDE = 'Date invalide'
const MESSAGE_TITRE_PERIODE_REQUIS = 'Le titre et la période sont obligatoires'

// Date au format texte, convertie en Date.
function date(champ: string, messageRequis?: string) {
  return (messageRequis ? texteRequis(champ, messageRequis) : texte(champ))
    .refine(dateValide, MESSAGE_DATE_INVALIDE)
    .transform((valeur) => new Date(valeur))
}

// Date facultative d'une ligne : null ou '' = aucune date.
const datePrevue = texte('datePrevue')
  .nullable()
  .refine((valeur) => !valeur || dateValide(valeur), MESSAGE_DATE_INVALIDE)
  .transform((valeur) => (valeur ? new Date(valeur) : null))

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------

export const SchemaCreationProgramme = z.preprocess(
  objetOuVide,
  z
    .object({
      titre: texteRequis('titre', MESSAGE_TITRE_PERIODE_REQUIS),
      description: texte('description').nullish(),
      periodeDebut: date('periodeDebut', MESSAGE_TITRE_PERIODE_REQUIS),
      periodeFin: date('periodeFin', MESSAGE_TITRE_PERIODE_REQUIS),
      // null = programme du groupe (toutes branches).
      brancheType: z.enum(BrancheTypeSchema.options, { error: 'Branche invalide' }).nullish(),
      // Lu uniquement pour la création via le district (contrôlée par le
      // service selon le rôle) ; une valeur non textuelle est ignorée.
      paroisseId: z
        .unknown()
        .transform((valeur) => (typeof valeur === 'string' ? valeur : undefined))
        .optional(),
    })
    .refine(
      (corps) => corps.periodeFin > corps.periodeDebut,
      'La date de fin doit être après la date de début',
    ),
)

export type CorpsCreationProgramme = z.infer<typeof SchemaCreationProgramme>

// Mise à jour partielle : un champ absent reste inchangé. L'ordre des dates
// est vérifié par le service, avec les dates existantes.
export const SchemaModificationProgramme = z.preprocess(
  objetOuVide,
  z.object({
    titre: texte('titre').optional(),
    description: texte('description').nullish(),
    periodeDebut: date('periodeDebut').optional(),
    periodeFin: date('periodeFin').optional(),
  }),
)

export type CorpsModificationProgramme = z.infer<typeof SchemaModificationProgramme>

// ---------------------------------------------------------------------------
// Lignes de programme
// ---------------------------------------------------------------------------

export const SchemaCreationLigne = z.preprocess(
  objetOuVide,
  z.object({
    theme: texteRequis('theme', 'Le thème est obligatoire'),
    objectif: texte('objectif').nullish(),
    datePrevue: datePrevue.optional(),
  }),
)

export type CorpsCreationLigne = z.infer<typeof SchemaCreationLigne>

export const SchemaModificationLigne = z.preprocess(
  objetOuVide,
  z.object({
    theme: texte('theme').optional(),
    objectif: texte('objectif').nullish(),
    datePrevue: datePrevue.optional(),
    ordre: z.number({ error: 'ordre doit être un entier' }).int({ error: 'ordre doit être un entier' }).optional(),
    // null détache la ligne de son activité.
    activiteId: texte('activiteId').nullish(),
  }),
)

export type CorpsModificationLigne = z.infer<typeof SchemaModificationLigne>
