import { BadRequestException } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import type { CorpsProfilPublic } from './utilisateurs.schemas'

// Règles du profil public (page « Notre équipe »), partagées entre
// /utilisateurs/:id/profil-public et /admin/utilisateurs/:id.
// Un compte n'apparaît jamais publiquement sans profilPublic = true ; les
// comptes familles (PARENT) et les jeunes (SCOUT, mineurs) ne peuvent jamais
// être rendus publics.

const ROLES_SANS_PROFIL_PUBLIC = ['PARENT', 'SCOUT']

export const SELECTION_PROFIL_PUBLIC = {
  profilPublic: true,
  fonctionPublique: true,
  photoPublique: true,
  biographie: true,
  ordrePublic: true,
} as const

export interface ProfilPublic {
  profilPublic: boolean
  fonctionPublique: string | null
  photoPublique: string | null
  biographie: string | null
  ordrePublic: number
}

export function profilPublicAutorise(role: string): boolean {
  return !ROLES_SANS_PROFIL_PUBLIC.includes(role)
}

// Données Prisma à appliquer : seuls les champs envoyés sont repris (jamais
// l'objet de requête brut).
export function donneesProfilPublic(corps: Partial<CorpsProfilPublic>): Prisma.UtilisateurUpdateInput {
  return {
    ...(corps.profilPublic !== undefined ? { profilPublic: corps.profilPublic } : {}),
    ...(corps.fonctionPublique !== undefined ? { fonctionPublique: corps.fonctionPublique } : {}),
    ...(corps.photoPublique !== undefined ? { photoPublique: corps.photoPublique } : {}),
    ...(corps.biographie !== undefined ? { biographie: corps.biographie } : {}),
    ...(corps.ordrePublic !== undefined ? { ordrePublic: corps.ordrePublic } : {}),
  }
}

/**
 * Valeur finale de profilPublic pour un compte dont le rôle final est
 * `roleFinal`. Une publication demandée explicitement pour un rôle non
 * éligible est refusée (400) ; un profil déjà public devenu non éligible
 * (changement de rôle) est retiré d'office.
 */
export function profilPublicFinal(roleFinal: string, demande: boolean | undefined, actuel: boolean): boolean {
  if (profilPublicAutorise(roleFinal)) return demande ?? actuel
  if (demande === true) throw new BadRequestException('Ce compte ne peut pas figurer sur la page publique')
  return false
}

// Liste des champs effectivement modifiés (pour le journal d'audit).
export function champsProfilModifies(avant: ProfilPublic, corps: Partial<CorpsProfilPublic>): string[] {
  return (Object.keys(SELECTION_PROFIL_PUBLIC) as (keyof ProfilPublic)[]).filter(
    (cle) => corps[cle] !== undefined && corps[cle] !== avant[cle],
  )
}
