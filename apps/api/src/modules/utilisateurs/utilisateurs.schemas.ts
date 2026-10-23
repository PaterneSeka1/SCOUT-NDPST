import { z } from 'zod'
import { BrancheTypeSchema, REGLE_MOT_DE_PASSE, RoleUtilisateurSchema, motDePasseValide } from '@scout/shared'

// Schémas des corps de requête de la gestion des comptes de la paroisse.
// Seule la forme des données est contrôlée ici ; la hiérarchie des rôles
// (rôles assignables, pas d'auto-promotion, comptes de district protégés),
// la branche requise selon le rôle, l'unicité et le périmètre paroisse restent
// dans UtilisateursService.

const MESSAGE_CORPS_INVALIDE = 'Données invalides'
const MESSAGE_CHAMPS_REQUIS = 'Les champs nom, prenom et role sont requis'
const MESSAGE_ROLE_INVALIDE = 'Rôle invalide'

const role = z.enum(RoleUtilisateurSchema.options, { error: MESSAGE_ROLE_INVALIDE })

const brancheType = z.enum(BrancheTypeSchema.options, { error: 'Branche invalide' }).nullish()

// Liste d'identifiants de scouts, dédoublonnée (entrées non textuelles ou vides ignorées).
const scoutIds = z
  .array(z.unknown(), { error: 'La liste des enfants est invalide' })
  .transform((ids) => [
    ...new Set(ids.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)),
  ])

function texteOptionnel(message: string) {
  return z.string({ error: message }).nullish()
}

const nouveauMotDePasse = z
  .string({ error: REGLE_MOT_DE_PASSE })
  .refine((motDePasse) => !!motDePasse && motDePasseValide(motDePasse), REGLE_MOT_DE_PASSE)

export const SchemaCreationUtilisateur = z.object(
  {
    nom: z.string({ error: MESSAGE_CHAMPS_REQUIS }).trim().min(1, MESSAGE_CHAMPS_REQUIS),
    prenom: z.string({ error: MESSAGE_CHAMPS_REQUIS }).trim().min(1, MESSAGE_CHAMPS_REQUIS),
    role: z.string({ error: MESSAGE_CHAMPS_REQUIS }).min(1, MESSAGE_CHAMPS_REQUIS).pipe(role),
    // Ancien client accepté, mais ce secret ne sera jamais utilisé à la création.
    password: z.string().max(200).optional(),
    email: texteOptionnel('L’adresse e-mail est invalide'),
    matricule: texteOptionnel('Le matricule est invalide'),
    telephone: texteOptionnel('Le numéro de téléphone est invalide'),
    brancheType,
    // Absente = aucun enfant rattaché.
    scoutIds: scoutIds.optional().transform((ids) => ids ?? []),
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsCreationUtilisateur = z.infer<typeof SchemaCreationUtilisateur>

// Mise à jour partielle : un champ absent reste inchangé.
export const SchemaModificationUtilisateur = z.object(
  {
    role: role.optional(),
    nom: z.string({ error: 'Le nom est invalide' }).trim().min(1, 'Le nom est invalide').optional(),
    prenom: z.string({ error: 'Le prénom est invalide' }).trim().min(1, 'Le prénom est invalide').optional(),
    email: texteOptionnel('L’adresse e-mail est invalide'),
    actif: z.boolean({ error: 'Le statut est invalide' }).optional(),
    // Absente = enfants inchangés ; tableau (même vide) = remplacement intégral.
    scoutIds: scoutIds.optional(),
    brancheType,
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsModificationUtilisateur = z.infer<typeof SchemaModificationUtilisateur>

export const SchemaReinitialisationMotDePasse = z.object(
  { nouveauMotDePasse },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsReinitialisationMotDePasse = z.infer<typeof SchemaReinitialisationMotDePasse>
