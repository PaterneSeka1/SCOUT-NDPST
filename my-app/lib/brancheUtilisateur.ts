import { prisma } from './prisma'

// Renvoie la branche assignée à un utilisateur (via son PosteBranche) dans une
// paroisse donnée, ou null s'il n'en a aucune. Centralisé ici pour que les
// routes scopées par branche partagent la même logique — plusieurs routes
// dupliquaient cette fonction localement, avec un risque de divergence.
export async function getBrancheUtilisateur(
  utilisateurId: string,
  paroisseId: string,
): Promise<string | null> {
  const poste = await prisma.posteBranche.findFirst({
    where: { utilisateurId, paroisseId },
    select: { brancheType: true },
    orderBy: { createdAt: 'asc' },
  })
  return poste?.brancheType ?? null
}
