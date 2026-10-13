import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface ParoisseDuDistrict {
  id: string
  nom: string
  ville: string
  actif: boolean
}

// Périmètre d'un compte : branche gérée (paroisse ou district) et paroisses
// de son district. Centralisé ici pour que chaque module applique la même
// règle de filtrage.
@Injectable()
export class PerimetreService {
  constructor(private readonly prisma: PrismaService) {}

  // Branche gérée par un compte paroissial (RESPONSABLE/ADJOINT/ASSISTANT_BRANCHE).
  async brancheUtilisateur(utilisateurId: string): Promise<string | null> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { brancheType: true },
    })
    return utilisateur?.brancheType ?? null
  }

  // Branche gérée à l'échelle du DISTRICT (roleDistrict=ASSISTANT_DISTRICT),
  // distincte de la branche paroissiale ci-dessus.
  async brancheDistrictUtilisateur(utilisateurId: string): Promise<string | null> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { brancheTypeDistrict: true },
    })
    return utilisateur?.brancheTypeDistrict ?? null
  }

  paroissesParDistrict(districtId: string): Promise<ParoisseDuDistrict[]> {
    return this.prisma.paroisse.findMany({
      where: { districtId },
      select: { id: true, nom: true, ville: true, actif: true },
      orderBy: { nom: 'asc' },
    })
  }

  // Dérive le district d'un membre de l'équipe district à partir du district
  // de SA paroisse d'ancrage.
  async paroissesDuDistrict(
    paroisseId: string,
  ): Promise<{ districtId: string; nomDistrict: string; paroisses: ParoisseDuDistrict[] }> {
    const paroisse = await this.prisma.paroisse.findUnique({
      where: { id: paroisseId },
      select: { districtId: true, district: { select: { nom: true } } },
    })
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')

    return {
      districtId: paroisse.districtId,
      nomDistrict: paroisse.district.nom,
      paroisses: await this.paroissesParDistrict(paroisse.districtId),
    }
  }
}
