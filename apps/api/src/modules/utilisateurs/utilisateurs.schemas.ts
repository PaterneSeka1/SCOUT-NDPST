import { z } from 'zod'
import {
  BrancheTypeSchema,
  REGLE_MOT_DE_PASSE,
  RoleUtilisateurSchema,
  estUrlFichierValide,
  motDePasseValide,
} from '@scout/shared'
import { urlPubliqueBase } from '../../common/lib/storage'

// Schémas des corps de requête de la gestion de la maîtrise.
// Seule la forme des données est contrôlée ici ; la hiérarchie des rôles
// (rôles assignables, pas d'auto-promotion, comptes administrateurs protégés),
// la branche requise selon le rôle et l'unicité des postes restent dans
// UtilisateursService.

const MESSAGE_CORPS_INVALIDE = 'Données invalides'
const MESSAGE_CHAMPS_REQUIS = 'Les champs nom, prenom et role sont requis'
const MESSAGE_ROLE_INVALIDE = 'Rôle invalide'

const role = z.enum(RoleUtilisateurSchema.options, { error: MESSAGE_ROLE_INVALIDE })

const brancheType = z.enum(BrancheTypeSchema.options, { error: 'Branche invalide' }).nullish()

// Liste d'identifiants de scouts, dédoublonnée (entrées non textuelles ou vides ignorées).
const scoutIds = z
  .array(z.unknown(), { error: 'La liste des enfants est invalide' })
  .transform((ids) => [...new Set(ids.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean))])

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

export const SchemaReinitialisationMotDePasse = z.object({ nouveauMotDePasse }, { error: MESSAGE_CORPS_INVALIDE })

export type CorpsReinitialisationMotDePasse = z.infer<typeof SchemaReinitialisationMotDePasse>

// ---------------------------------------------------------------------------
// Profil public (page « Notre équipe »). Champs partagés avec la modification
// d'un compte par l'administrateur (/admin/utilisateurs/:id).
// Absent = inchangé ; null ou texte vide = effacé.
// ---------------------------------------------------------------------------

function texteEffacable(message: string, max: number) {
  return z
    .string({ error: message })
    .max(max, { error: message })
    .nullish()
    .transform((valeur) => (valeur === undefined ? undefined : valeur?.trim() || null))
}

export const MESSAGE_PHOTO_INVALIDE =
  'La photo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée'

export const champsProfilPublic = {
  profilPublic: z.boolean({ error: 'Le champ profilPublic est invalide' }).optional(),
  fonctionPublique: texteEffacable('La fonction publique est invalide (120 caractères au plus)', 120),
  // Affichée telle quelle sur le site public : seul un chemin local ou une URL
  // du stockage configuré côté serveur est accepté.
  photoPublique: texteEffacable('La photo est invalide', 500).refine(
    (url) => url == null || estUrlFichierValide(url, urlPubliqueBase()),
    MESSAGE_PHOTO_INVALIDE,
  ),
  biographie: texteEffacable('La biographie est invalide (2000 caractères au plus)', 2000),
  ordrePublic: z
    .number({ error: 'L’ordre d’affichage est invalide' })
    .int({ error: 'L’ordre d’affichage est invalide' })
    .min(0, { error: 'L’ordre d’affichage est invalide' })
    .max(9999, { error: 'L’ordre d’affichage est invalide' })
    .optional(),
}

export const SchemaProfilPublic = z.object(champsProfilPublic, { error: MESSAGE_CORPS_INVALIDE })

export type CorpsProfilPublic = z.infer<typeof SchemaProfilPublic>
