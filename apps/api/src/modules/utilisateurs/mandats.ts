import { ConflictException } from '@nestjs/common'
import { ROLES_TOUT_STAFF } from '@scout/shared'
import type { BrancheType, Prisma, RoleUtilisateur } from '../../generated/prisma/client'

// Historique des responsabilités de la maîtrise (modèle Mandat), partagé entre
// la gestion de la maîtrise par le Chef de Groupe (/utilisateurs) et la
// gestion des comptes par l'administrateur (/admin/utilisateurs).
//
// Règles :
//   - seul un rôle de la maîtrise (ROLES_TOUT_STAFF) ouvre un mandat —
//     ADMINISTRATEUR, PARENT et SCOUT n'en ont pas ;
//   - un compte actif de la maîtrise a exactement un mandat ouvert
//     (finLe = null) ; un compte inactif n'en a aucun ;
//   - tout changement de rôle ou de branche clôt le mandat ouvert et en ouvre
//     un nouveau ; la désactivation clôt ; la réactivation rouvre.
// Toujours appelé dans la transaction qui modifie le compte.

export interface PosteCompte {
  role: RoleUtilisateur | string
  brancheType: BrancheType | string | null
  actif: boolean
}

export interface ContexteMandat {
  utilisateurId: string
  auteurId: string | null
  motif?: string | null
}

export const SELECTION_MANDAT = {
  id: true,
  role: true,
  brancheType: true,
  debutLe: true,
  finLe: true,
  auteurId: true,
  motif: true,
} as const

export function estRoleMaitrise(role: string): boolean {
  return ROLES_TOUT_STAFF.includes(role)
}

function memePoste(a: PosteCompte, b: PosteCompte): boolean {
  return a.role === b.role && (a.brancheType ?? null) === (b.brancheType ?? null)
}

// Motif par défaut déduit de la transition (si l'appelant n'en fournit pas).
function motifTransition(avant: PosteCompte | null, apres: PosteCompte): string {
  if (!avant) return 'Création du compte'
  if (!avant.actif && apres.actif) return 'Réactivation du compte'
  if (avant.role !== apres.role) return 'Changement de rôle'
  return 'Changement de branche'
}

/**
 * Applique à l'historique la transition `avant` → `apres` d'un compte
 * (`avant` = null pour une création). Renvoie true si l'historique a changé.
 */
export async function historiserMandat(
  tx: Prisma.TransactionClient,
  avant: PosteCompte | null,
  apres: PosteCompte,
  contexte: ContexteMandat,
): Promise<boolean> {
  const avantActif = avant?.actif === true
  // Aucun changement de poste, ou compte resté inactif : rien à historiser.
  if (avant && avantActif === apres.actif && (!apres.actif || memePoste(avant, apres))) return false

  let modifie = false
  if (avantActif) {
    const clos = await tx.mandat.updateMany({
      where: { utilisateurId: contexte.utilisateurId, finLe: null },
      data: { finLe: new Date() },
    })
    modifie = clos.count > 0
  }

  if (apres.actif && estRoleMaitrise(apres.role)) {
    await tx.mandat.create({
      data: {
        utilisateurId: contexte.utilisateurId,
        role: apres.role as RoleUtilisateur,
        brancheType: (apres.brancheType ?? null) as BrancheType | null,
        auteurId: contexte.auteurId,
        motif: contexte.motif ?? motifTransition(avant, apres),
      },
    })
    modifie = true
  }
  return modifie
}

/**
 * Verrouille la ligne du compte (FOR UPDATE) et vérifie que son poste n'a
 * pas changé depuis la lecture faite hors transaction : sans cela, deux
 * modifications concurrentes pourraient produire un historique incohérent.
 */
export async function verrouillerPoste(
  tx: Prisma.TransactionClient,
  utilisateurId: string,
  attendu: PosteCompte,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Utilisateur" WHERE id = ${utilisateurId} FOR UPDATE`
  const courant = await tx.utilisateur.findUniqueOrThrow({
    where: { id: utilisateurId },
    select: { role: true, brancheType: true, actif: true },
  })
  if (courant.actif !== attendu.actif || !memePoste(courant, attendu)) {
    throw new ConflictException('Ce compte vient d’être modifié ; rechargez la fiche puis réessayez.')
  }
}

export async function listerMandats(client: Prisma.TransactionClient, utilisateurId: string) {
  return client.mandat.findMany({
    where: { utilisateurId },
    select: SELECTION_MANDAT,
    orderBy: { debutLe: 'desc' },
  })
}
