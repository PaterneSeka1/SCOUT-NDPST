import { prisma } from './prisma'

export interface ParoisseDuDistrict {
  id: string
  nom: string
  ville: string
  actif: boolean
}

export class DistrictInvalideError extends Error {}

// Trim uniquement : '' et les chaînes ne contenant que des espaces deviennent null.
export function normaliserDistrict(district?: string | null): string | null {
  const trim = district?.trim()
  return trim ? trim : null
}

// Correspondance EXACTE (après trim), volontairement sans rapprochement approximatif :
// deux valeurs différant par la casse ou un espace mal placé sont deux districts
// distincts. Le champ district restant du texte libre côté admin, c'est un choix
// assumé plutôt qu'une heuristique fragile de rapprochement.
export async function paroissesParDistrict(district: string): Promise<ParoisseDuDistrict[]> {
  return prisma.paroisse.findMany({
    where: { district },
    select: { id: true, nom: true, ville: true, actif: true },
    orderBy: { nom: 'asc' },
  })
}

// Point d'entrée de la zone /district : dérive le district d'un membre de
// l'équipe district à partir du district de SA paroisse d'ancrage (paroisseId).
export async function getParoissesDuDistrict(
  paroisseId: string,
): Promise<{ nomDistrict: string; paroisses: ParoisseDuDistrict[] }> {
  const paroisse = await prisma.paroisse.findUnique({ where: { id: paroisseId }, select: { district: true } })
  if (!paroisse) throw new DistrictInvalideError('Paroisse introuvable')

  const nomDistrict = normaliserDistrict(paroisse.district)
  if (!nomDistrict) {
    throw new DistrictInvalideError(
      "Cette paroisse n'a pas de district renseigné — impossible de déterminer son district. Contactez un administrateur.",
    )
  }

  return { nomDistrict, paroisses: await paroissesParDistrict(nomDistrict) }
}
