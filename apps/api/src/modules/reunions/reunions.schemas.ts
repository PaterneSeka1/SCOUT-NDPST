import { z } from 'zod'
import { BrancheTypeSchema, StatutPresenceReunionSchema, StatutReunionSchema } from '@scout/shared'

// Schémas des corps de requête du module Réunions. Seule la forme des données
// est contrôlée ici ; le périmètre (branche de l'utilisateur) et
// l'appartenance des scouts à la réunion restent dans ReunionsService.

const MAX_REUNIONS_SERIE = 60

const MESSAGE_CORPS_INVALIDE = 'Données invalides'
const MESSAGE_BRANCHE_INVALIDE = 'Branche invalide'
const MESSAGE_FORMAT_INVALIDE = 'Format invalide'
const MESSAGE_CHAMPS_REQUIS = 'Champs requis manquants'
const MESSAGE_JOUR_SEMAINE = 'jourSemaine doit être compris entre 0 (dimanche) et 6 (samedi)'

function dateValide(valeur: string): boolean {
  return !Number.isNaN(new Date(valeur).getTime())
}

// Champs texte libres optionnels (titre, lieu, notes) : chaîne, null ou absent.
function texteOptionnel(message: string) {
  return z.string({ error: message }).nullish()
}

const dureeMinutes = z
  .number({ error: 'La durée est invalide' })
  .int({ error: 'La durée est invalide' })
  .nullish()

const brancheOptionnelle = z.enum(BrancheTypeSchema.options, { error: MESSAGE_BRANCHE_INVALIDE }).nullish()

// ---------------------------------------------------------------------------
// Création en série et modification
// ---------------------------------------------------------------------------

export const SchemaCreationReunions = z.object(
  {
    dates: z
      .array(z.unknown(), { error: 'Au moins une date est requise' })
      .min(1, 'Au moins une date est requise')
      .max(MAX_REUNIONS_SERIE, 'Maximum 60 réunions par création en série')
      .transform((dates, ctx) => {
        const datesObj = dates.map((d) => (typeof d === 'string' ? new Date(d) : new Date(NaN)))
        if (datesObj.some((d) => Number.isNaN(d.getTime()))) {
          ctx.addIssue({ code: 'custom', message: 'Une ou plusieurs dates sont invalides' })
          return z.NEVER
        }
        return datesObj
      }),
    // null = réunion inter-branches.
    brancheType: brancheOptionnelle,
    titre: texteOptionnel('Le titre est invalide'),
    lieu: texteOptionnel('Le lieu est invalide'),
    notes: texteOptionnel('Les notes sont invalides'),
    dureeMinutes,
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsCreationReunions = z.infer<typeof SchemaCreationReunions>

// Mise à jour partielle : un champ absent reste inchangé.
export const SchemaModificationReunion = z
  .object(
    {
      statut: z.enum(StatutReunionSchema.options, { error: 'Statut invalide' }).optional(),
      // Toute valeur « vide » (null, '') efface la date de report ; une valeur
      // non vide doit être une date valide.
      dateReportee: z
        .unknown()
        .transform((valeur, ctx) => {
          if (!valeur) return null
          const date = typeof valeur === 'string' ? new Date(valeur) : new Date(NaN)
          if (Number.isNaN(date.getTime())) {
            ctx.addIssue({ code: 'custom', message: 'La date de report est invalide' })
            return z.NEVER
          }
          return date
        })
        .optional(),
      dateHeure: z
        .string({ error: 'La date de la réunion est invalide' })
        .refine(dateValide, 'La date de la réunion est invalide')
        .transform((valeur) => new Date(valeur))
        .optional(),
      // null = réunion inter-branches.
      brancheType: brancheOptionnelle,
      titre: texteOptionnel('Le titre est invalide'),
      lieu: texteOptionnel('Le lieu est invalide'),
      notes: texteOptionnel('Les notes sont invalides'),
      dureeMinutes,
    },
    { error: MESSAGE_CORPS_INVALIDE },
  )
  .refine(
    (corps) => corps.statut !== 'REPORTEE' || !!corps.dateReportee,
    'La nouvelle date est requise pour reporter une réunion',
  )

export type CorpsModificationReunion = z.infer<typeof SchemaModificationReunion>

// ---------------------------------------------------------------------------
// Présences
// ---------------------------------------------------------------------------

export const SchemaPresencesReunion = z.object(
  {
    presences: z.array(
      z.object(
        {
          scoutId: z.string({ error: MESSAGE_FORMAT_INVALIDE }).min(1, MESSAGE_FORMAT_INVALIDE),
          statut: z.enum(StatutPresenceReunionSchema.options, { error: 'Statut de présence invalide' }),
          note: z.string({ error: MESSAGE_FORMAT_INVALIDE }).nullish(),
        },
        { error: MESSAGE_FORMAT_INVALIDE },
      ),
      { error: MESSAGE_FORMAT_INVALIDE },
    ),
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsPresencesReunion = z.infer<typeof SchemaPresencesReunion>

// ---------------------------------------------------------------------------
// Configuration hebdomadaire par branche
// ---------------------------------------------------------------------------

export const SchemaConfigReunion = z.object(
  {
    // Valeur absente ou vide : champ requis manquant.
    brancheType: z.enum(BrancheTypeSchema.options, {
      error: (issue) => (issue.input ? MESSAGE_BRANCHE_INVALIDE : MESSAGE_CHAMPS_REQUIS),
    }),
    jourSemaine: z
      .number({ error: (issue) => (issue.input === undefined ? MESSAGE_CHAMPS_REQUIS : MESSAGE_JOUR_SEMAINE) })
      .int({ error: MESSAGE_JOUR_SEMAINE })
      .min(0, { error: MESSAGE_JOUR_SEMAINE })
      .max(6, { error: MESSAGE_JOUR_SEMAINE }),
    heureDebut: z
      .string({ error: (issue) => (issue.input ? "L'heure de début est invalide" : MESSAGE_CHAMPS_REQUIS) })
      .min(1, MESSAGE_CHAMPS_REQUIS),
    // Absente ou null = 90 minutes (valeur par défaut appliquée par le service).
    dureeMinutes,
    lieu: texteOptionnel('Le lieu est invalide'),
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsConfigReunion = z.infer<typeof SchemaConfigReunion>
