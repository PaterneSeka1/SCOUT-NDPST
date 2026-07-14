import { prisma } from './prisma'

export interface ParoisseDuDistrict {
  id: string
  nom: string
  ville: string
  actif: boolean
}

export class DistrictInvalideError extends Error {}

// Correspondance par districtId (clé étrangère), plus par rapprochement de
// texte libre : depuis que District est une entité à part entière (choisie
// via un select, jamais retapée), il ne peut plus y avoir deux paroisses
// dans "le même district" sous des noms légèrement différents.
export async function paroissesParDistrict(districtId: string): Promise<ParoisseDuDistrict[]> {
  return prisma.paroisse.findMany({
    where: { districtId },
    select: { id: true, nom: true, ville: true, actif: true },
    orderBy: { nom: 'asc' },
  })
}

// Point d'entrée de la zone /district : dérive le district d'un membre de
// l'équipe district à partir du district de SA paroisse d'ancrage (paroisseId).
// Paroisse.districtId est obligatoire (contrainte NOT NULL + clé étrangère) :
// la seule façon d'échouer ici est que la paroisse elle-même n'existe plus.
export async function getParoissesDuDistrict(
  paroisseId: string,
): Promise<{ districtId: string; nomDistrict: string; paroisses: ParoisseDuDistrict[] }> {
  const paroisse = await prisma.paroisse.findUnique({
    where: { id: paroisseId },
    select: { districtId: true, district: { select: { nom: true } } },
  })
  if (!paroisse) throw new DistrictInvalideError('Paroisse introuvable')

  return {
    districtId: paroisse.districtId,
    nomDistrict: paroisse.district.nom,
    paroisses: await paroissesParDistrict(paroisse.districtId),
  }
}
