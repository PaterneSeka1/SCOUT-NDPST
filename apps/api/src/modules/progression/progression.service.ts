import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ORDRE_BRANCHES, ROLES_BRANCHE, ROLES_GROUPE } from '@scout/shared'
import { Prisma, type BrancheType } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import type { CorpsEtape, CorpsModificationEtape } from './progression.schemas'

@Injectable()
export class ProgressionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly perimetre: PerimetreService,
  ) {}

  // Branches visibles : toutes pour l'équipe de groupe, la sienne pour
  // l'encadrement de branche.
  private async branchesVisibles(utilisateur: UtilisateurSession): Promise<BrancheType[]> {
    if (!ROLES_BRANCHE.includes(utilisateur.role)) return ORDRE_BRANCHES as BrancheType[]
    const branche = await this.perimetre.brancheUtilisateur(utilisateur.id)
    return branche ? [branche as BrancheType] : []
  }

  // Modification du référentiel : Chef de Groupe, ou responsable/adjoint de LA branche.
  private async verifierEcriture(utilisateur: UtilisateurSession, brancheType: string) {
    if (ROLES_GROUPE.includes(utilisateur.role)) return
    if (['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE'].includes(utilisateur.role)) {
      if ((await this.perimetre.brancheUtilisateur(utilisateur.id)) === brancheType) return
    }
    throw new ForbiddenException('Accès refusé')
  }

  async referentiel(utilisateur: UtilisateurSession) {
    const branches = await this.branchesVisibles(utilisateur)
    return this.prisma.badge.findMany({
      where: { brancheType: { in: branches } },
      orderBy: [{ brancheType: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
      include: { _count: { select: { progressions: true } } },
    })
  }

  // Synthèse par branche : effectif actif, étapes du référentiel, validations
  // (totales et sur 90 jours). Aucune donnée nominative.
  async synthese(utilisateur: UtilisateurSession) {
    const branches = await this.branchesVisibles(utilisateur)
    const il90jours = new Date(Date.now() - 90 * 86400000)
    return Promise.all(
      branches.map(async (brancheType) => {
        const [scouts, etapes, validations, recentes] = await Promise.all([
          this.prisma.scout.count({ where: { actif: true, brancheType } }),
          this.prisma.badge.count({ where: { brancheType } }),
          this.prisma.progressionScout.count({ where: { scout: { actif: true, brancheType } } }),
          this.prisma.progressionScout.count({ where: { scout: { actif: true, brancheType }, dateValidation: { gte: il90jours } } }),
        ])
        return { brancheType, scouts, etapes, validations, validations90j: recentes }
      }),
    )
  }

  async creer(utilisateur: UtilisateurSession, corps: CorpsEtape) {
    await this.verifierEcriture(utilisateur, corps.brancheType)
    try {
      const etape = await this.prisma.badge.create({
        data: { brancheType: corps.brancheType, nom: corps.nom, description: corps.description ?? null, ordre: corps.ordre ?? 0 },
      })
      await this.audit.enregistrer({ acteurId: utilisateur.id, action: 'REFERENTIEL_MODIFIE', entite: 'Badge', entiteId: etape.id, details: { operation: 'creation' } })
      return etape
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException('Cette étape existe déjà pour cette branche')
      }
      throw erreur
    }
  }

  async modifier(utilisateur: UtilisateurSession, id: string, corps: CorpsModificationEtape) {
    const etape = await this.prisma.badge.findUnique({ where: { id } })
    if (!etape) throw new NotFoundException('Étape introuvable')
    await this.verifierEcriture(utilisateur, etape.brancheType)
    try {
      const modifiee = await this.prisma.badge.update({
        where: { id },
        data: Object.fromEntries(Object.entries(corps).filter(([, v]) => v !== undefined)),
      })
      await this.audit.enregistrer({ acteurId: utilisateur.id, action: 'REFERENTIEL_MODIFIE', entite: 'Badge', entiteId: id, details: { operation: 'modification' } })
      return modifiee
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException('Cette étape existe déjà pour cette branche')
      }
      throw erreur
    }
  }

  // Une étape déjà validée pour au moins un scout est conservée (historique).
  async supprimer(utilisateur: UtilisateurSession, id: string) {
    const etape = await this.prisma.badge.findUnique({ where: { id }, include: { _count: { select: { progressions: true } } } })
    if (!etape) throw new NotFoundException('Étape introuvable')
    await this.verifierEcriture(utilisateur, etape.brancheType)
    if (etape._count.progressions > 0) {
      throw new ConflictException('Cette étape a déjà été validée pour des scouts : elle ne peut pas être supprimée')
    }
    await this.prisma.badge.delete({ where: { id } })
    await this.audit.enregistrer({ acteurId: utilisateur.id, action: 'REFERENTIEL_MODIFIE', entite: 'Badge', entiteId: id, details: { operation: 'suppression' } })
    return { ok: true }
  }
}
