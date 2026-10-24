import { BrancheTypeSchema } from '@scout/shared'
import { z } from 'zod'
import { texteFacultatif, texteRequis } from '../../common/lib/schemas-contenus'

const TELEPHONE = /^\+?[0-9 .-]{8,20}$/

// Formulaire public « Nous rejoindre » : informations strictement nécessaires
// au premier contact. Aucune donnée de santé, aucun compte créé.
export const SchemaDemandePublique = z
  .object(
    {
      type: z.enum(['INSCRIPTION_JEUNE', 'ENGAGEMENT_ADULTE', 'INFORMATION'], { error: 'Type de demande invalide' }),
      nomContact: texteRequis('nom', 100),
      prenomContact: texteRequis('prénom', 100),
      telephone: z.string({ error: 'Téléphone obligatoire' }).trim().regex(TELEPHONE, 'Numéro de téléphone invalide'),
      email: z
        .string()
        .trim()
        .max(200)
        .refine((v) => v === '' || z.email().safeParse(v).success, 'Adresse e-mail invalide')
        .nullish()
        .transform((v) => v || null),
      nomJeune: texteFacultatif('nom du jeune', 100),
      prenomJeune: texteFacultatif('prénom du jeune', 100),
      dateNaissanceJeune: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide')
        .nullish()
        .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null)),
      brancheSouhaitee: BrancheTypeSchema.nullish(),
      message: texteFacultatif('message', 2000),
      consentement: z.literal(true, { error: 'Votre accord pour le traitement de ces informations est nécessaire' }),
      // Anti-spam : champ invisible qui doit rester vide, et délai minimal de
      // remplissage (horodatage d'ouverture du formulaire, en ms).
      siteWeb: z.string().max(200).optional(),
      ouvertLe: z.number().int().positive().optional(),
    },
    { error: 'Données invalides' },
  )
  .refine((d) => d.type !== 'INSCRIPTION_JEUNE' || (!!d.nomJeune && !!d.prenomJeune && !!d.dateNaissanceJeune), {
    message: 'Indiquez le nom, le prénom et la date de naissance du jeune',
    path: ['prenomJeune'],
  })
  .refine((d) => !d.dateNaissanceJeune || d.dateNaissanceJeune.getTime() < Date.now(), {
    message: 'Date de naissance invalide',
    path: ['dateNaissanceJeune'],
  })

export const SchemaTraitementDemande = z.object(
  {
    statut: z.enum(['NOUVELLE', 'EN_COURS', 'ACCEPTEE', 'REFUSEE', 'ARCHIVEE'], { error: 'Statut invalide' }).optional(),
    notesInternes: texteFacultatif('notesInternes', 4000),
  },
  { error: 'Données invalides' },
)

export type CorpsDemandePublique = z.infer<typeof SchemaDemandePublique>
export type CorpsTraitementDemande = z.infer<typeof SchemaTraitementDemande>
