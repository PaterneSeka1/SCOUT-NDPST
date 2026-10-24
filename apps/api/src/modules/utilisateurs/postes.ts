import { Prisma, type BrancheType } from '../../generated/prisma/client'
import type { PrismaService } from '../../prisma/prisma.service'

// Unicité des postes « 1 Chef de Groupe actif » et « 1 Responsable de Branche
// actif par branche » : garantie en base par des index partiels uniques
// (violation → P2002, traduite en 409 par les services), vérifiée ici en
// amont pour renvoyer un message clair. Partagé avec /admin/utilisateurs.

export const MESSAGE_CHEF_GROUPE_UNIQUE =
  "Le groupe a déjà un Chef de Groupe actif. Désactivez-le ou changez son rôle avant d'en désigner un nouveau."
export const MESSAGE_RESPONSABLE_UNIQUE = 'Cette branche a déjà un Responsable de Branche actif.'

export async function conflitPosteUnique(
  prisma: PrismaService,
  role: string,
  brancheType: string | null,
  exclureId?: string,
): Promise<string | null> {
  const exclusion = exclureId ? { NOT: { id: exclureId } } : {}
  if (role === 'CHEF_GROUPE') {
    const autre = await prisma.utilisateur.findFirst({
      where: { role: 'CHEF_GROUPE', actif: true, ...exclusion },
      select: { id: true },
    })
    if (autre) return MESSAGE_CHEF_GROUPE_UNIQUE
  }
  if (role === 'RESPONSABLE_BRANCHE' && brancheType) {
    const autre = await prisma.utilisateur.findFirst({
      where: { role: 'RESPONSABLE_BRANCHE', brancheType: brancheType as BrancheType, actif: true, ...exclusion },
      select: { id: true },
    })
    if (autre) return MESSAGE_RESPONSABLE_UNIQUE
  }
  return null
}

export function estErreurUnicite(erreur: unknown): boolean {
  return erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002'
}
