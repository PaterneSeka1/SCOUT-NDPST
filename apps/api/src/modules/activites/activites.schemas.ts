import { z } from 'zod'
import {
  BrancheTypeSchema,
  StatutActiviteSchema,
  TypeActiviteSchema,
  TypeAutorisationCampSchema,
  estCheminLocalValide,
} from '@scout/shared'

// Schémas des corps de requête du module Activités. Seule la forme des données
// est contrôlée ici (types, formats, dates) ; les règles d'autorisation et de
// périmètre (rôle, branche, responsable actif, existence en base) restent dans
// ActivitesService.

const MESSAGE_CORPS_INVALIDE = 'Données invalides'
const MESSAGE_TITRE_DATE_REQUIS = 'Le titre et la date de début sont obligatoires'
const MESSAGE_TYPE_INVALIDE = "Type d'activité invalide"
const MESSAGE_BRANCHE_INVALIDE = 'Branche invalide'
const MESSAGE_DATE_DEBUT_INVALIDE = 'La date de début est invalide'
const MESSAGE_DATE_FIN_INVALIDE = 'La date de fin est invalide'
const MESSAGE_SCOUT_TYPE_REQUIS = 'Scout et type sont requis'
const MESSAGE_FORMAT_INVALIDE = 'Format invalide'

function dateValide(valeur: string): boolean {
  return !Number.isNaN(new Date(valeur).getTime())
}

// Texte libre facultatif (description, lieu) : absent = inchangé, chaîne
// nettoyée (vide = effacée), toute autre valeur = effacée.
const texteLibre = z
  .unknown()
  .transform((valeur) => (typeof valeur === 'string' ? valeur.trim() || null : null))
  .optional()

const typeActivite = z.enum(TypeActiviteSchema.options, { error: MESSAGE_TYPE_INVALIDE })
const statutActivite = z.enum(StatutActiviteSchema.options, { error: "Statut d'activité invalide" })

// Publication sur le site public : uniquement sur demande explicite (booléen).
const publique = z.boolean({ error: 'Le champ « publique » doit être un booléen' }).optional()

// Responsable désigné : identifiant d'un compte de la maîtrise (vérifié en
// base par le service). null ou '' = aucun responsable.
const responsableId = z
  .string({ error: 'Responsable invalide' })
  .trim()
  .max(64, 'Responsable invalide')
  .nullable()
  .transform((valeur) => valeur || null)
  .optional()

// Champs de suivi communs à la création et à la modification.
const champsSuivi = {
  statut: statutActivite.optional(),
  bilan: texteLibre,
  publique,
  descriptionPublique: texteLibre,
  responsableId,
}

// ---------------------------------------------------------------------------
// Création et modification
// ---------------------------------------------------------------------------

export const SchemaCreationActivite = z
  .object(
    {
      titre: z.string({ error: MESSAGE_TITRE_DATE_REQUIS }).trim().min(1, MESSAGE_TITRE_DATE_REQUIS),
      dateDebut: z
        .string({ error: MESSAGE_TITRE_DATE_REQUIS })
        .min(1, MESSAGE_TITRE_DATE_REQUIS)
        .refine(dateValide, MESSAGE_DATE_DEBUT_INVALIDE)
        .transform((valeur) => new Date(valeur)),
      // Absente ou chaîne vide = pas de date de fin.
      dateFin: z
        .string({ error: MESSAGE_DATE_FIN_INVALIDE })
        .refine((valeur) => !valeur || dateValide(valeur), MESSAGE_DATE_FIN_INVALIDE)
        .optional()
        .transform((valeur) => (valeur ? new Date(valeur) : null)),
      // Absent = REUNION (valeur par défaut appliquée par le service).
      type: typeActivite.optional(),
      // null = activité inter-branches.
      brancheType: z.enum(BrancheTypeSchema.options, { error: MESSAGE_BRANCHE_INVALIDE }).nullish(),
      description: texteLibre,
      lieu: texteLibre,
      ...champsSuivi,
    },
    { error: MESSAGE_CORPS_INVALIDE },
  )
  .refine(
    (corps) => !corps.dateFin || corps.dateFin > corps.dateDebut,
    'La date de fin doit être après la date de début',
  )
  .refine(
    (corps) => corps.publique !== true || !!corps.descriptionPublique,
    'Une description publique est requise pour publier une activité',
  )

export type CorpsCreationActivite = z.infer<typeof SchemaCreationActivite>

// Mise à jour partielle : un champ absent reste inchangé. La cohérence des
// dates avec les valeurs existantes est vérifiée par le service.
export const SchemaModificationActivite = z.object(
  {
    titre: z.string({ error: 'Le titre est invalide' }).trim().min(1, 'Le titre est requis').optional(),
    dateDebut: z
      .string({ error: MESSAGE_DATE_DEBUT_INVALIDE })
      .refine(dateValide, MESSAGE_DATE_DEBUT_INVALIDE)
      .transform((valeur) => new Date(valeur))
      .optional(),
    // null ou '' efface la date de fin.
    dateFin: z
      .string({ error: MESSAGE_DATE_FIN_INVALIDE })
      .nullable()
      .refine((valeur) => !valeur || dateValide(valeur), MESSAGE_DATE_FIN_INVALIDE)
      .transform((valeur) => (valeur ? new Date(valeur) : null))
      .optional(),
    type: typeActivite.optional(),
    // null ou '' rend l'activité inter-branches.
    brancheType: z
      .enum([...BrancheTypeSchema.options, ''], { error: MESSAGE_BRANCHE_INVALIDE })
      .nullable()
      .transform((valeur) => valeur || null)
      .optional(),
    description: texteLibre,
    lieu: texteLibre,
    ...champsSuivi,
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsModificationActivite = z.infer<typeof SchemaModificationActivite>

// ---------------------------------------------------------------------------
// Autorisations de camp
// ---------------------------------------------------------------------------

const scoutEtType = {
  scoutId: z.string({ error: MESSAGE_SCOUT_TYPE_REQUIS }).min(1, MESSAGE_SCOUT_TYPE_REQUIS),
  type: z.enum(TypeAutorisationCampSchema.options, { error: MESSAGE_SCOUT_TYPE_REQUIS }),
}

// Champ texte du document : toute valeur non textuelle vaut chaîne vide.
const texteDocument = z
  .unknown()
  .optional()
  .transform((valeur) => (typeof valeur === 'string' ? valeur.trim() : ''))

export const SchemaConfirmationAutorisation = z
  .object(
    {
      ...scoutEtType,
      // Seule la valeur 'DOCUMENT' est significative (confirmation par document signé).
      mode: z.unknown().optional(),
      documentUrl: texteDocument,
      documentNomFichier: texteDocument,
    },
    { error: MESSAGE_CORPS_INVALIDE },
  )
  .superRefine((corps, ctx) => {
    if (corps.mode !== 'DOCUMENT') return
    if (!corps.documentUrl || !corps.documentNomFichier) {
      ctx.addIssue({ code: 'custom', message: 'Le document est requis pour ce mode' })
    } else if (!estCheminLocalValide(corps.documentUrl)) {
      ctx.addIssue({ code: 'custom', message: 'documentUrl doit être un chemin local (ex : /api/fichiers/…)' })
    }
  })
  .transform(({ mode, ...corps }) => ({ ...corps, parDocument: mode === 'DOCUMENT' }))

export type CorpsConfirmationAutorisation = z.infer<typeof SchemaConfirmationAutorisation>

export const SchemaRetraitAutorisation = z.object(scoutEtType, { error: MESSAGE_CORPS_INVALIDE })

export type CorpsRetraitAutorisation = z.infer<typeof SchemaRetraitAutorisation>

// ---------------------------------------------------------------------------
// Présences
// ---------------------------------------------------------------------------

export const SchemaPresencesActivite = z.object(
  {
    presences: z.array(
      z.object(
        {
          scoutId: z.string({ error: MESSAGE_FORMAT_INVALIDE }).min(1, MESSAGE_FORMAT_INVALIDE),
          present: z.boolean({ error: MESSAGE_FORMAT_INVALIDE }),
          commentaire: z.string({ error: MESSAGE_FORMAT_INVALIDE }).nullish(),
        },
        { error: MESSAGE_FORMAT_INVALIDE },
      ),
      { error: MESSAGE_FORMAT_INVALIDE },
    ),
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsPresencesActivite = z.infer<typeof SchemaPresencesActivite>
