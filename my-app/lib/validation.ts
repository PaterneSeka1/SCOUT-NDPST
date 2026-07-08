import { z } from 'zod'

// Schémas correspondant exactement aux enums Prisma (prisma/schema.prisma).
// Utilisés pour valider les entrées utilisateur avant de les transmettre à
// Prisma : sans ce contrôle, une valeur invalide provoque une erreur 500 non
// maîtrisée au lieu d'un rejet propre en 400.

export const BrancheTypeSchema = z.enum(['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS'])

export const RoleUtilisateurSchema = z.enum([
  'ADMIN_PLATEFORME', 'CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE',
  'RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE', 'PARENT', 'SCOUT',
])

export const SexeSchema = z.enum(['MASCULIN', 'FEMININ'])

export const TypeActiviteSchema = z.enum(['REUNION', 'SORTIE', 'CAMP', 'SERVICE', 'CELEBRATION', 'FORMATION', 'AUTRE'])

export const TypeDocumentSchema = z.enum(['AUTORISATION_PARENTALE', 'CERTIFICAT_MEDICAL', 'PHOTO_IDENTITE', 'AUTRE'])

export const StatutReunionSchema = z.enum(['PLANIFIEE', 'REPORTEE', 'ANNULEE', 'TERMINEE'])

export const StatutPresenceReunionSchema = z.enum(['PRESENT', 'ABSENT', 'EXCUSE'])

export const TypeAutorisationCampSchema = z.enum(['FICHE_MEDICALE', 'AUTORISATION_PARENTALE'])

// N'accepte que des chemins locaux (ex : "/uploads/xxx.png" ou "/api/fichiers/…").
// Refuse les URL absolues ("https://…", "//hote/…") pour empêcher qu'une URL
// externe arbitraire ne soit enregistrée puis potentiellement exploitée (SSRF,
// hameçonnage via un lien qui semble interne à l'application).
//
// Le préfixe "/" seul ne suffit pas : un navigateur résout "/\exemple.com/x"
// comme "https://exemple.com/x" (le backslash est traité comme un séparateur
// de chemin par le parseur d'URL pour les schémas http/https). On revérifie
// donc via le parseur d'URL lui-même que la valeur ne change pas d'origine
// une fois résolue, plutôt que de se fier à une simple vérification de préfixe.
export function estCheminLocalValide(valeur: unknown): valeur is string {
  if (typeof valeur !== 'string' || !valeur.startsWith('/') || valeur.startsWith('//')) return false
  try {
    return new URL(valeur, 'https://internal.invalid').origin === 'https://internal.invalid'
  } catch {
    return false
  }
}

// Comme estCheminLocalValide, mais accepte en plus une URL absolue dont
// l'origine correspond exactement à `origineExterneAutorisee` — utile pour les
// fichiers publics (logo, image d'accueil) quand ils sont servis depuis un
// stockage S3 externe plutôt que depuis /public. Ne jamais appeler avec une
// valeur venant de l'utilisateur : `origineExterneAutorisee` doit toujours
// provenir de la configuration serveur (ex : lib/storage.ts urlPubliqueBase()),
// jamais du corps de la requête.
export function estUrlFichierValide(valeur: unknown, origineExterneAutorisee?: string | null): valeur is string {
  if (estCheminLocalValide(valeur)) return true
  if (typeof valeur !== 'string' || !origineExterneAutorisee) return false
  try {
    return new URL(valeur).origin === new URL(origineExterneAutorisee).origin
  } catch {
    return false
  }
}
