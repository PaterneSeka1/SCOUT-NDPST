import { prisma } from './prisma'

// La branche gérée par un compte paroissial vit directement sur
// Utilisateur.brancheType (RESPONSABLE_BRANCHE/ADJOINT_BRANCHE/
// ASSISTANT_BRANCHE). Le paramètre paroisseId n'est plus nécessaire pour ce
// calcul, mais reste accepté et ignoré pour ne pas casser les appelants
// existants.
export async function getBrancheUtilisateur(
  utilisateurId: string,
  _paroisseId?: string,
): Promise<string | null> {
  void _paroisseId
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    select: { brancheType: true },
  })
  return utilisateur?.brancheType ?? null
}

// Équivalent pour l'affectation DISTRICT (roleDistrict=ASSISTANT_DISTRICT
// chargé d'une branche) — distincte de la branche paroissiale ci-dessus :
// une même personne peut gérer une branche dans sa paroisse ET une branche
// différente à l'échelle du district.
export async function getBrancheDistrictUtilisateur(utilisateurId: string): Promise<string | null> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    select: { brancheTypeDistrict: true },
  })
  return utilisateur?.brancheTypeDistrict ?? null
}
