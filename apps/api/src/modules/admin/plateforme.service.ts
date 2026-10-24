import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { lirePagination, metaPagination, texteRequete } from '../../common/lib/pagination'
import { PrismaService } from '../../prisma/prisma.service'

// Journal d'audit de l'installation, filtrable et paginé.
@Injectable()
export class PlateformeService {
  constructor(private readonly prisma: PrismaService) {}

  async journalAudit(requete: Record<string, unknown>) {
    const pagination = lirePagination(requete, 30, 100)
    const action = texteRequete(requete.action)
    const entite = texteRequete(requete.entite)
    const acteurId = texteRequete(requete.acteurId, 40)
    const depuis = texteRequete(requete.depuis, 10)
    const debut = depuis && /^\d{4}-\d{2}-\d{2}$/.test(depuis) ? new Date(`${depuis}T00:00:00`) : undefined

    const where: Prisma.JournalAuditWhereInput = {
      ...(action ? { action } : {}),
      ...(entite ? { entite } : {}),
      ...(acteurId ? { acteurId } : {}),
      ...(debut ? { createdAt: { gte: debut } } : {}),
    }

    const [entrees, total, actions] = await Promise.all([
      this.prisma.journalAudit.findMany({
        where,
        include: { acteur: { select: { id: true, nom: true, prenom: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limite,
      }),
      this.prisma.journalAudit.count({ where }),
      this.prisma.journalAudit.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    ])

    return {
      entrees,
      actions: actions.map((a) => a.action),
      pagination: metaPagination(pagination, total),
    }
  }
}
