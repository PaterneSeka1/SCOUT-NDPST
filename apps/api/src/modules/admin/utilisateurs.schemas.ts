import {
  BrancheTypeSchema,
  motDePasseValide,
  REGLE_MOT_DE_PASSE,
  ROLES_ASSIGNABLES_ADMIN,
  ROLES_BRANCHE,
  RoleUtilisateurSchema,
} from '@scout/shared'
import { z } from 'zod'
import type { BrancheType, RoleUtilisateur } from '../../generated/prisma/client'
import { champsProfilPublic } from '../utilisateurs/utilisateurs.schemas'
import {
  brancheValide,
  champBooleen,
  champTexte,
  champTexteEffacable,
  champTexteNettoye,
  corpsAdmin,
} from './admin.schemas'
import { entierBorneRequete, parametre } from './admin.utils'

// Nom ou prénom modifiable : absent → inchangé, sinon texte non vide (nettoyé).
function texteNonVide(message: string) {
  return z.string({ error: message }).trim().min(1, { error: message }).optional()
}

// GET /admin/utilisateurs — filtres de la liste (query string). Une valeur
// répétée (tableau) est ignorée ; une valeur inconnue est rejetée en 400.
export const SchemaFiltresUtilisateurs = z
  .object(
    {
      page: z.unknown().optional(),
      limite: z.unknown().optional(),
      role: z.unknown().optional(),
      actif: z.unknown().optional(),
      brancheType: z.unknown().optional(),
      recherche: z.unknown().optional(),
    },
    { error: 'Données invalides' },
  )
  .transform((requete, ctx) => {
    const rejeter = (message: string) => {
      ctx.addIssue({ code: 'custom', message })
      return z.NEVER
    }
    const role = parametre(requete.role)?.trim() || undefined
    if (role && !RoleUtilisateurSchema.safeParse(role).success) return rejeter('Rôle invalide')
    const actif = parametre(requete.actif)?.trim() || undefined
    if (actif && actif !== 'true' && actif !== 'false') return rejeter('Le filtre actif est invalide')
    const brancheType = parametre(requete.brancheType)?.trim() || undefined
    if (brancheType && !BrancheTypeSchema.safeParse(brancheType).success) return rejeter('Branche invalide')
    return {
      page: entierBorneRequete(requete.page, 1),
      limite: entierBorneRequete(requete.limite, 20, 100),
      role: role as RoleUtilisateur | undefined,
      actif: actif === undefined ? undefined : actif === 'true',
      brancheType: brancheType as BrancheType | undefined,
      recherche: parametre(requete.recherche)?.trim().slice(0, 100) || undefined,
    }
  })
export type FiltresUtilisateurs = z.infer<typeof SchemaFiltresUtilisateurs>

// POST /admin/utilisateurs — `role` parmi ROLES_ASSIGNABLES_ADMIN
// (ADMINISTRATEUR et les rôles de la maîtrise).
export const SchemaCreationUtilisateur = corpsAdmin({
  nom: champTexteNettoye('nom'),
  prenom: champTexteNettoye('prenom'),
  email: champTexteNettoye('email'),
  matricule: champTexteNettoye('matricule'),
  telephone: champTexteNettoye('telephone'),
  role: champTexte('role'),
  // Ancien client accepté, mais ce secret n'est jamais utilisé : un secret
  // temporaire est généré par le serveur.
  password: champTexte('password'),
  fonction: champTexte('fonction'),
  brancheType: z.unknown().optional(),
  editeurContenu: champBooleen('editeurContenu'),
}).transform((corps, ctx) => {
  const { nom, prenom, role, brancheType, telephone, matricule } = corps
  const rejeter = (message: string) => {
    ctx.addIssue({ code: 'custom', message })
    return z.NEVER
  }

  if (!nom || !prenom || !role) return rejeter('Les champs nom, prenom, role sont requis')
  if (!ROLES_ASSIGNABLES_ADMIN.includes(role)) return rejeter('Rôle invalide')
  if (!brancheValide(brancheType)) return rejeter('Branche invalide')

  // brancheType n'a de sens que pour l'encadrement de branche : requis pour
  // ces rôles, forcé à null pour tout autre rôle même si fourni.
  const estBranche = ROLES_BRANCHE.includes(role)
  if (estBranche && !brancheType) return rejeter('La branche est requise pour ce rôle')

  const estParent = role === 'PARENT'
  if (estParent && !telephone) return rejeter('Le numéro de téléphone est requis pour un parent')
  if (!estParent && !matricule) return rejeter('Le matricule est requis')

  return {
    nom,
    prenom,
    email: corps.email || null,
    matricule: matricule || null,
    telephone: telephone || null,
    role: role as RoleUtilisateur,
    fonction: corps.fonction?.trim() || null,
    brancheType: estBranche ? (brancheType as BrancheType) : null,
    editeurContenu: corps.editeurContenu ?? false,
  }
})
export type DonneesCreationUtilisateur = z.infer<typeof SchemaCreationUtilisateur>

// PUT /admin/utilisateurs/:id — mise à jour partielle (champ absent =
// inchangé). Le contrôle du rôle au regard du compte existant, la branche
// requise et la protection du dernier administrateur restent dans le service.
export const SchemaModificationUtilisateur = corpsAdmin({
  actif: champBooleen('actif'),
  role: z.string({ error: 'Rôle invalide' }).optional(),
  nom: texteNonVide('Le nom est invalide'),
  prenom: texteNonVide('Le prénom est invalide'),
  email: champTexteEffacable('L’adresse e-mail est invalide'),
  fonction: champTexteEffacable('La fonction est invalide'),
  brancheType: z.unknown().optional(),
  editeurContenu: champBooleen('editeurContenu'),
  ...champsProfilPublic,
}).transform((corps, ctx) => {
  if (corps.role !== undefined && !RoleUtilisateurSchema.safeParse(corps.role).success) {
    ctx.addIssue({ code: 'custom', message: 'Rôle invalide', path: ['role'] })
    return z.NEVER
  }
  if (!brancheValide(corps.brancheType)) {
    ctx.addIssue({ code: 'custom', message: 'Branche invalide', path: ['brancheType'] })
    return z.NEVER
  }
  return {
    ...corps,
    role: corps.role as RoleUtilisateur | undefined,
    brancheType: corps.brancheType as BrancheType | null | undefined,
  }
})
export type DonneesModificationUtilisateur = z.infer<typeof SchemaModificationUtilisateur>

// PUT /admin/utilisateurs/:id/password
export const SchemaMotDePasseAdmin = corpsAdmin({
  nouveauMotDePasse: z.string({ error: REGLE_MOT_DE_PASSE }).refine(motDePasseValide, { error: REGLE_MOT_DE_PASSE }),
})
export type DonneesMotDePasseAdmin = z.infer<typeof SchemaMotDePasseAdmin>
