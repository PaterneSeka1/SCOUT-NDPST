import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { logger } from '@/lib/logger'

// GET — journal d'audit de la plateforme : toutes les paroisses confondues,
// plus les actions de portée plateforme (paroisseId = null, ex. création
// d'un district). Réservé à l'administrateur plateforme (voir
// app/admin/layout.tsx pour le garde-fou de toute la zone /admin) — ce
// journal n'est plus accessible depuis l'espace paroisse (ex-/dashboard/audit).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limite = Math.min(100, Math.max(1, parseInt(searchParams.get('limite') ?? '30', 10)))
    const action = searchParams.get('action') ?? undefined
    const entite = searchParams.get('entite') ?? undefined
    const paroisseId = searchParams.get('paroisseId') ?? undefined

    const where = {
      ...(paroisseId ? { paroisseId } : {}),
      ...(action ? { action } : {}),
      ...(entite ? { entite } : {}),
    }

    const [entrees, total] = await Promise.all([
      prisma.journalAudit.findMany({
        where,
        include: {
          acteur: { select: { id: true, nom: true, prenom: true, role: true } },
          paroisse: { select: { id: true, nom: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limite,
        take: limite,
      }),
      prisma.journalAudit.count({ where }),
    ])

    return NextResponse.json({
      entrees,
      pagination: { page, limite, total, totalPages: Math.ceil(total / limite) },
    })
  } catch (error) {
    logger.error('GET /api/admin/audit', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
