import { BadRequestException } from '@nestjs/common'
import type { BrancheType, Prisma, RoleUtilisateur } from '../../generated/prisma/client'

export interface AffectationCourante {
  roleDistrict: RoleUtilisateur | null
  fonctionDistrict: string | null
  brancheTypeDistrict: BrancheType | null
}

// À appeler DANS la transaction qui met à jour la projection Utilisateur.
// Verrouiller le district avant toute mutation évite deux nominations
// concurrentes de commissaire et sérialise l'historique de cette structure.
export async function verrouillerDistrict(tx: Prisma.TransactionClient, districtId: string) {
  await tx.$queryRaw`SELECT id FROM "District" WHERE id = ${districtId} FOR UPDATE`
}

export async function historiserAffectation(
  tx: Prisma.TransactionClient,
  utilisateurId: string,
  nouvelle: AffectationCourante,
  acteurId: string,
  motif: string | null = null,
) {
  // Ordre partagé avec connexion/réinitialisation : district (appelant),
  // puis utilisateur, puis historique/sessions et projection utilisateur.
  await tx.$queryRaw`SELECT id FROM "Utilisateur" WHERE id = ${utilisateurId} FOR UPDATE`
  const actuelle = await tx.utilisateur.findUniqueOrThrow({
    where: { id: utilisateurId },
    select: {
      roleDistrict: true, fonctionDistrict: true, brancheTypeDistrict: true,
      paroisse: { select: { districtId: true } },
    },
  })
  if (actuelle.roleDistrict === nouvelle.roleDistrict &&
      actuelle.fonctionDistrict === nouvelle.fonctionDistrict &&
      actuelle.brancheTypeDistrict === nouvelle.brancheTypeDistrict) return false

  const districtId = actuelle.paroisse?.districtId
  if (!districtId) throw new BadRequestException('Une affectation district requiert une paroisse rattachée')
  const maintenant = new Date()
  const fermees = await tx.affectationDistrict.updateMany({
    where: { utilisateurId, finLe: null },
    data: { finLe: maintenant, revoqueParId: acteurId, motifRevocation: motif },
  })
  // Compatible avec les comptes créés/modifiés par une ancienne release
  // pendant le déploiement : ne pas perdre leur dernière affectation connue.
  if (!fermees.count && actuelle.roleDistrict) {
    await tx.affectationDistrict.create({ data: {
      utilisateurId, districtId, role: actuelle.roleDistrict,
      fonction: actuelle.fonctionDistrict, brancheType: actuelle.brancheTypeDistrict,
      debutLe: maintenant, finLe: maintenant, reprise: true,
      revoqueParId: acteurId, motifRevocation: motif,
    } })
  }
  if (nouvelle.roleDistrict) {
    await tx.affectationDistrict.create({ data: {
      utilisateurId, districtId, role: nouvelle.roleDistrict,
      fonction: nouvelle.fonctionDistrict, brancheType: nouvelle.brancheTypeDistrict,
      auteurId: acteurId, motif, debutLe: maintenant,
    } })
  }
  await tx.sessionUtilisateur.updateMany({
    where: { utilisateurId, revoqueeLe: null }, data: { revoqueeLe: maintenant },
  })
  return true
}

export function motifAffectation(valeur: unknown): string | null {
  if (valeur === undefined || valeur === null) return null
  if (typeof valeur !== 'string' || valeur.length > 500) {
    throw new BadRequestException('Le motif doit contenir au maximum 500 caractères')
  }
  return valeur.trim() || null
}
