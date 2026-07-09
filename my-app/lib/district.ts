import { prisma } from './prisma'

export interface ParoisseDuDistrict {
  id: string
  nom: string
  ville: string
  actif: boolean
}

export class DistrictInvalideError extends Error {}

// Trim uniquement : '' et les chaînes ne contenant que des espaces deviennent null.
export function normaliserDoyenne(doyenne?: string | null): string | null {
  const trim = doyenne?.trim()
  return trim ? trim : null
}

// Correspondance EXACTE (après trim), volontairement sans rapprochement approximatif :
// deux valeurs différant par la casse ou un espace mal placé sont deux districts
// distincts. Le champ doyenne restant du texte libre côté admin, c'est un choix
// assumé plutôt qu'une heuristique fragile de rapprochement.
export async function paroissesParDoyenne(doyenne: string): Promise<ParoisseDuDistrict[]> {
  return prisma.paroisse.findMany({
    where: { doyenne },
    select: { id: true, nom: true, ville: true, actif: true },
    orderBy: { nom: 'asc' },
  })
}

// Point d'entrée de la zone /district : dérive le district d'un membre de
// l'équipe district à partir du doyenne de SA paroisse d'ancrage (paroisseId).
export async function getParoissesDuDistrict(
  paroisseId: string,
): Promise<{ doyenne: string; paroisses: ParoisseDuDistrict[] }> {
  const paroisse = await prisma.paroisse.findUnique({ where: { id: paroisseId }, select: { doyenne: true } })
  if (!paroisse) throw new DistrictInvalideError('Paroisse introuvable')

  const doyenne = normaliserDoyenne(paroisse.doyenne)
  if (!doyenne) {
    throw new DistrictInvalideError(
      "Cette paroisse n'a pas de doyenné renseigné — impossible de déterminer son district. Contactez un administrateur.",
    )
  }

  return { doyenne, paroisses: await paroissesParDoyenne(doyenne) }
}
