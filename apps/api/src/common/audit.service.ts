import { Injectable } from '@nestjs/common'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { logger } from './lib/logger'

export interface EntreeAudit {
  acteurId?: string | null
  action: string
  entite: string
  entiteId?: string | null
  details?: Record<string, unknown>
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Enregistre une action sensible dans le journal d'audit. N'échoue jamais
  // bruyamment : une erreur d'écriture du journal ne doit pas faire échouer
  // l'opération métier qui l'a déclenchée.
  async enregistrer(entree: EntreeAudit): Promise<void> {
    try {
      // Acteur absent de la base (compte supprimé entre-temps, script) :
      // son identifiant est conservé dans les détails pour que l'action
      // reste attribuée.
      const acteurLocal =
        entree.acteurId && (await this.prisma.utilisateur.count({ where: { id: entree.acteurId } })) > 0
      const details =
        entree.acteurId && !acteurLocal ? { ...entree.details, acteurInconnuId: entree.acteurId } : entree.details

      await this.prisma.journalAudit.create({
        data: {
          acteurId: acteurLocal ? entree.acteurId : null,
          action: entree.action,
          entite: entree.entite,
          entiteId: entree.entiteId ?? null,
          details: (details as Prisma.InputJsonValue) ?? undefined,
        },
      })
    } catch (error) {
      logger.error('audit.enregistrement_echoue', error)
    }
  }
}
