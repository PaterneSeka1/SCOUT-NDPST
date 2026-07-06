import { prisma } from './prisma'
import { logger } from './logger'
import type { Prisma } from '@/app/generated/prisma/client'

export { LABELS_ACTIONS_AUDIT } from './audit-labels'

interface EntreeAudit {
  paroisseId: string
  acteurId?: string | null
  action: string
  entite: string
  entiteId?: string | null
  details?: Record<string, unknown>
}

// Enregistre une action sensible dans le journal d'audit. N'échoue jamais
// bruyamment : une erreur d'écriture du journal ne doit pas faire échouer
// l'opération métier qui l'a déclenchée.
export async function enregistrerAudit(entree: EntreeAudit): Promise<void> {
  try {
    await prisma.journalAudit.create({
      data: {
        paroisseId: entree.paroisseId,
        acteurId: entree.acteurId ?? null,
        action: entree.action,
        entite: entree.entite,
        entiteId: entree.entiteId ?? null,
        details: (entree.details as Prisma.InputJsonValue) ?? undefined,
      },
    })
  } catch (error) {
    logger.error('audit.enregistrement_echoue', error)
  }
}
