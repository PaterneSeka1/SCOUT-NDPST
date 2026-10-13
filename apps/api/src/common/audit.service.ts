import { Injectable } from '@nestjs/common'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { logger } from './lib/logger'

export interface EntreeAudit {
  // Null pour les actions de portée plateforme (gestion des paroisses,
  // branding commun...) qui n'ont pas de paroisse naturelle à qui être rattachées.
  paroisseId: string | null
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
      // Administrateur plateforme d'une autre installation : il n'existe pas
      // dans cette base (clé étrangère impossible). Son identifiant est
      // conservé dans les détails pour que l'action reste attribuée.
      const acteurLocal =
        entree.acteurId && (await this.prisma.utilisateur.count({ where: { id: entree.acteurId } })) > 0
      const details =
        entree.acteurId && !acteurLocal ? { ...entree.details, acteurExterneId: entree.acteurId } : entree.details

      await this.prisma.journalAudit.create({
        data: {
          paroisseId: entree.paroisseId,
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
