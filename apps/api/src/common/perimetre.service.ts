import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

// Périmètre d'un compte de la maîtrise : branche gérée par l'encadrement de
// branche. Centralisé ici pour que chaque module applique la même règle.
@Injectable()
export class PerimetreService {
  constructor(private readonly prisma: PrismaService) {}

  // Branche gérée par un compte RESPONSABLE/ADJOINT/ASSISTANT_BRANCHE.
  async brancheUtilisateur(utilisateurId: string): Promise<string | null> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { brancheType: true },
    })
    return utilisateur?.brancheType ?? null
  }
}
