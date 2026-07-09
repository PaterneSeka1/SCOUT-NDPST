import { prisma } from './prisma'

// La branche gérée par un compte vit directement sur Utilisateur.brancheType
// (RESPONSABLE_BRANCHE/ADJOINT_BRANCHE/ASSISTANT_BRANCHE au niveau paroisse,
// ASSISTANT_DISTRICT chargé d'une branche au niveau district) — le paramètre
// paroisseId n'est plus nécessaire pour ce calcul (un compte n'a qu'une seule
// paroisse d'ancrage), mais reste accepté et ignoré pour ne pas casser les
// appelants existants.
export async function getBrancheUtilisateur(
  utilisateurId: string,
  _paroisseId?: string,
): Promise<string | null> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    select: { brancheType: true },
  })
  return utilisateur?.brancheType ?? null
}
