import { z } from 'zod'
import { BrancheTypeSchema, anneeScolaireValide } from '@scout/shared'
import { StatutCotisation, TypeCotisation, type BrancheType } from '../../generated/prisma/client'

// Schémas des corps de requête du module Cotisations. Seule la forme des
// données est contrôlée ici ; le périmètre (branche), l'existence des
// scouts et de l'activité et la cohérence avec le montant dû restent dans CotisationsService.

// Historiquement, un corps qui n'est pas un objet est traité comme un objet
// vide (les champs requis sont alors signalés comme manquants).
function objetOuVide(valeur: unknown): unknown {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur) ? valeur : {}
}

// Texte optionnel : absent, null ou chaîne ; toute autre valeur est refusée.
function texteOptionnel(champ: string) {
  return z.string({ error: `${champ} doit être une chaîne de caractères` }).nullish()
}

const MESSAGE_CIBLES_REQUISES = 'scoutId ou scoutIds est requis'

export const SchemaCreationCotisation = z.preprocess(
  objetOuVide,
  z
    .object({
      // Cibles : `scoutIds` (tableau non vide) prime sur `scoutId`.
      scoutId: z.unknown().optional(),
      scoutIds: z.unknown().optional(),
      type: z.enum(TypeCotisation, { error: 'Type de cotisation invalide' }),
      montant: z
        .number({ error: 'Le montant doit être un entier positif' })
        .int({ error: 'Le montant doit être un entier positif' })
        .min(0, { error: 'Le montant doit être un entier positif' }),
      libelle: texteOptionnel('libelle'),
      anneeScolaire: texteOptionnel('anneeScolaire'),
      // Cotisation d'activité (camp, sortie…) : existence vérifiée par le service.
      activiteId: z
        .string({ error: 'Activité invalide' })
        .trim()
        .max(64, 'Activité invalide')
        .nullish()
        .transform((valeur) => valeur || undefined),
    })
    .transform(({ scoutId, scoutIds, ...corps }, ctx) => {
      const cibles: unknown[] =
        Array.isArray(scoutIds) && scoutIds.length ? scoutIds : scoutId ? [scoutId] : []
      if (cibles.length === 0 || !cibles.every((c): c is string => typeof c === 'string' && c.length > 0)) {
        ctx.addIssue({ code: 'custom', message: MESSAGE_CIBLES_REQUISES })
        return z.NEVER
      }
      return { ...corps, cibles }
    }),
)

export type CorpsCreationCotisation = z.infer<typeof SchemaCreationCotisation>

// Mise à jour partielle : un champ absent reste inchangé.
export const SchemaModificationCotisation = z.preprocess(
  objetOuVide,
  z.object({
    statut: z.enum(StatutCotisation, { error: 'Statut invalide' }).optional(),
    modePaiement: texteOptionnel('modePaiement'),
    notes: texteOptionnel('notes'),
    // N'est lu que pour PARTIELLEMENT_PAYEE : son contrôle (entier positif,
    // inférieur au montant dû) est fait par le service. Une valeur non
    // numérique est ignorée.
    montantPaye: z
      .unknown()
      .transform((valeur) => (typeof valeur === 'number' ? valeur : undefined))
      .optional(),
  }),
)

export type CorpsModificationCotisation = z.infer<typeof SchemaModificationCotisation>

const MESSAGE_STATUT_REQUIS = 'scoutId et cotisant sont requis'

export const SchemaStatutCotisant = z.preprocess(
  objetOuVide,
  z.object({
    scoutId: z.string({ error: MESSAGE_STATUT_REQUIS }).min(1, MESSAGE_STATUT_REQUIS),
    cotisant: z.boolean({ error: MESSAGE_STATUT_REQUIS }),
    // Absente ou null = année scolaire courante (appliquée par le service).
    anneeScolaire: z
      .string({ error: 'Année scolaire invalide' })
      .refine(anneeScolaireValide, 'Année scolaire invalide')
      .nullish()
      .transform((valeur) => valeur ?? undefined),
  }),
)

export type CorpsStatutCotisant = z.infer<typeof SchemaStatutCotisant>

// ---------------------------------------------------------------------------
// Barème des cotisations (montants de référence par année, type et branche)
// ---------------------------------------------------------------------------

const MESSAGE_MONTANT_BAREME = 'Le montant doit être un entier positif ou nul'

const montantBareme = z
  .number({ error: MESSAGE_MONTANT_BAREME })
  .int({ error: MESSAGE_MONTANT_BAREME })
  .min(0, { error: MESSAGE_MONTANT_BAREME })
  .max(100_000_000, { error: 'Montant trop élevé' })

const anneeScolaireBareme = z
  .string({ error: 'Année scolaire invalide' })
  .trim()
  .refine(anneeScolaireValide, 'Année scolaire invalide')

// null ou '' = barème valable pour toutes les branches.
const brancheBareme = z
  .enum([...BrancheTypeSchema.options, ''], { error: 'Branche invalide' })
  .nullable()
  .transform((valeur): BrancheType | null => valeur || null)

// Libellé facultatif : vide = aucun.
const libelleBareme = z
  .string({ error: 'libelle doit être une chaîne de caractères' })
  .trim()
  .max(200, 'Libellé trop long (200 caractères maximum)')
  .nullable()
  .transform((valeur) => valeur || null)

export const SchemaCreationBareme = z.preprocess(
  objetOuVide,
  z.object({
    anneeScolaire: anneeScolaireBareme,
    type: z.enum(TypeCotisation, { error: 'Type de cotisation invalide' }),
    brancheType: brancheBareme.optional().transform((valeur) => valeur ?? null),
    libelle: libelleBareme.optional().transform((valeur) => valeur ?? null),
    montant: montantBareme,
  }),
)

export type CorpsCreationBareme = z.infer<typeof SchemaCreationBareme>

// Mise à jour partielle : un champ absent reste inchangé.
export const SchemaModificationBareme = z.preprocess(
  objetOuVide,
  z.object({
    anneeScolaire: anneeScolaireBareme.optional(),
    type: z.enum(TypeCotisation, { error: 'Type de cotisation invalide' }).optional(),
    brancheType: brancheBareme.optional(),
    libelle: libelleBareme.optional(),
    montant: montantBareme.optional(),
  }),
)

export type CorpsModificationBareme = z.infer<typeof SchemaModificationBareme>
