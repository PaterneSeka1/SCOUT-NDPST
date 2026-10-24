import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditService } from '../../common/audit.service'
import { PrismaService } from '../../prisma/prisma.service'
import type { CorpsEvenement, CorpsModificationEvenement } from './histoire.schemas'

// Mémoire du groupe : frise chronologique éditable. Chaque fait porte une
// source et un statut de validation ; rien n'est publié automatiquement.
@Injectable()
export class HistoireService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  lister() {
    return this.prisma.evenementHistorique.findMany({ orderBy: [{ annee: 'asc' }, { ordre: 'asc' }, { date: 'asc' }] })
  }

  async creer(corps: CorpsEvenement, acteurId: string) {
    const evenement = await this.prisma.evenementHistorique.create({
      data: { ...Object.fromEntries(Object.entries(corps).filter(([, v]) => v !== undefined)), annee: corps.annee, titre: corps.titre },
    })
    await this.audit.enregistrer({ acteurId, action: 'HISTOIRE_CREEE', entite: 'EvenementHistorique', entiteId: evenement.id, details: { annee: evenement.annee } })
    return evenement
  }

  async modifier(id: string, corps: CorpsModificationEvenement, acteurId: string) {
    const existant = await this.prisma.evenementHistorique.findUnique({ where: { id } })
    if (!existant) throw new NotFoundException('Événement introuvable')
    const statut = corps.statutValidation ?? existant.statutValidation
    const source = corps.source !== undefined ? corps.source : existant.source
    if (statut === 'VALIDE' && !source) throw new BadRequestException('Indiquez la source qui confirme cet événement')
    const evenement = await this.prisma.evenementHistorique.update({
      where: { id },
      data: Object.fromEntries(Object.entries(corps).filter(([, v]) => v !== undefined)),
    })
    await this.audit.enregistrer({
      acteurId,
      action: 'HISTOIRE_MODIFIEE',
      entite: 'EvenementHistorique',
      entiteId: id,
      details: { statutValidation: evenement.statutValidation, publie: evenement.publie },
    })
    return evenement
  }

  async supprimer(id: string, acteurId: string) {
    const existant = await this.prisma.evenementHistorique.findUnique({ where: { id } })
    if (!existant) throw new NotFoundException('Événement introuvable')
    await this.prisma.evenementHistorique.delete({ where: { id } })
    await this.audit.enregistrer({ acteurId, action: 'HISTOIRE_SUPPRIMEE', entite: 'EvenementHistorique', entiteId: id, details: { titre: existant.titre } })
    return { ok: true }
  }

  // Public : événements publiés seulement. Le statut de validation est
  // exposé pour que le site signale les faits encore à confirmer.
  publics() {
    return this.prisma.evenementHistorique.findMany({
      where: { publie: true },
      orderBy: [{ annee: 'asc' }, { ordre: 'asc' }, { date: 'asc' }],
      select: {
        id: true,
        annee: true,
        date: true,
        titre: true,
        description: true,
        type: true,
        auteurTemoignage: true,
        imageUrl: true,
        imageAlt: true,
        documentUrl: true,
        source: true,
        statutValidation: true,
      },
    })
  }
}
