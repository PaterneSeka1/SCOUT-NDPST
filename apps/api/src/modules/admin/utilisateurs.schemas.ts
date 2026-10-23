import {
  BrancheTypeSchema,
  motDePasseValide,
  REGLE_MOT_DE_PASSE,
  ROLES_ASSIGNABLES_PAROISSE,
  ROLES_BRANCHE,
  ROLES_DISTRICT_ETENDU,
} from '@scout/shared'
import { z } from 'zod'
import type { BrancheType } from '../../generated/prisma/client'
import {
  brancheValide,
  champBooleen,
  champTexte,
  champTexteEffacable,
  champTexteNettoye,
  corpsAdmin,
} from './admin.schemas'

// Nom ou prénom modifiable : absent → inchangé, sinon texte non vide (nettoyé).
function texteNonVide(message: string) {
  return z.string({ error: message }).trim().min(1, { error: message }).optional()
}

// POST /admin/utilisateurs — `role` est toujours un rôle PAROISSIAL :
// ROLES_ASSIGNABLES_PAROISSE exclut ADMIN_PLATEFORME et les rôles de district.
export const SchemaCreationUtilisateur = corpsAdmin({
  paroisseId: champTexte('paroisseId'),
  nom: champTexteNettoye('nom'),
  prenom: champTexteNettoye('prenom'),
  email: champTexteNettoye('email'),
  matricule: champTexteNettoye('matricule'),
  telephone: champTexteNettoye('telephone'),
  role: champTexte('role'),
  password: champTexte('password'),
  fonction: champTexte('fonction'),
  brancheType: z.unknown().optional(),
}).transform((corps, ctx) => {
  const { paroisseId, nom, prenom, role, brancheType, telephone, matricule } = corps
  const rejeter = (message: string) => {
    ctx.addIssue({ code: 'custom', message })
    return z.NEVER
  }

  if (!paroisseId || !nom || !prenom || !role) {
    return rejeter('Les champs paroisseId, nom, prenom, role sont requis')
  }
  if (!ROLES_ASSIGNABLES_PAROISSE.includes(role)) return rejeter('Rôle invalide')
  if (!brancheValide(brancheType)) return rejeter('Branche invalide')

  // brancheType n'a de sens que pour l'encadrement de branche paroissial :
  // requis pour ces rôles, forcé à null pour tout autre rôle même si fourni.
  const estBranche = ROLES_BRANCHE.includes(role)
  if (estBranche && !brancheType) return rejeter('La branche est requise pour ce rôle')

  const estParent = role === 'PARENT'
  if (estParent && !telephone) return rejeter('Le numéro de téléphone est requis pour un parent')
  if (!estParent && !matricule) return rejeter('Le matricule est requis')

  return {
    paroisseId,
    nom,
    prenom,
    email: corps.email || null,
    matricule: matricule || null,
    telephone: telephone || null,
    role,
    fonction: corps.fonction?.trim() || null,
    brancheType: estBranche ? (brancheType as BrancheType) : null,
  }
})
export type DonneesCreationUtilisateur = z.infer<typeof SchemaCreationUtilisateur>

// PUT /admin/utilisateurs/:id — mise à jour partielle. Le contrôle du rôle
// au regard du rôle actuel et la branche requise restent dans le service.
export const SchemaModificationUtilisateur = corpsAdmin({
  actif: champBooleen('actif'),
  role: z.string({ error: 'Rôle invalide' }).optional(),
  nom: texteNonVide('Le nom est invalide'),
  prenom: texteNonVide('Le prénom est invalide'),
  email: champTexteEffacable('L’adresse e-mail est invalide'),
  fonction: champTexteEffacable('La fonction est invalide'),
  brancheType: z.unknown().optional(),
}).transform((corps, ctx) => {
  if (!brancheValide(corps.brancheType)) {
    ctx.addIssue({ code: 'custom', message: 'Branche invalide', path: ['brancheType'] })
    return z.NEVER
  }
  return { ...corps, brancheType: corps.brancheType as BrancheType | null | undefined }
})
export type DonneesModificationUtilisateur = z.infer<typeof SchemaModificationUtilisateur>

function brancheReconnue(valeur: string | null | undefined): boolean {
  return !valeur || BrancheTypeSchema.safeParse(valeur).success
}

// PUT /admin/utilisateurs/:id/nominations — champs nettoyés (vide → null).
export const SchemaNomination = corpsAdmin({
  role: z.string({ error: 'Rôle invalide' }).optional(),
  roleDistrict: champTexteEffacable('Rôle de district invalide'),
  brancheType: champTexteEffacable('Branche invalide'),
  brancheTypeDistrict: champTexteEffacable('Branche de district invalide'),
  fonctionDistrict: champTexteEffacable('Fonction de district invalide'),
}).transform((corps, ctx) => {
  const rejeter = (message: string) => {
    ctx.addIssue({ code: 'custom', message })
    return z.NEVER
  }
  if (!brancheReconnue(corps.brancheType)) return rejeter('Branche invalide')
  if (corps.roleDistrict && !ROLES_DISTRICT_ETENDU.includes(corps.roleDistrict)) {
    return rejeter('Rôle de district invalide')
  }
  if (!brancheReconnue(corps.brancheTypeDistrict)) return rejeter('Branche de district invalide')
  return {
    ...corps,
    brancheType: corps.brancheType as BrancheType | null | undefined,
    brancheTypeDistrict: corps.brancheTypeDistrict as BrancheType | null | undefined,
  }
})
export type DonneesNomination = z.infer<typeof SchemaNomination>

// PUT /admin/utilisateurs/:id/password
export const SchemaMotDePasseAdmin = corpsAdmin({
  nouveauMotDePasse: z.string({ error: REGLE_MOT_DE_PASSE }).refine(motDePasseValide, { error: REGLE_MOT_DE_PASSE }),
})
export type DonneesMotDePasseAdmin = z.infer<typeof SchemaMotDePasseAdmin>
