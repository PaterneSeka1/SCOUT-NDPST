import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_GROUPE } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { paroisseIdRequise } from '@/lib/session'

// GET — journal d'audit de la paroisse. Réservé à la direction du groupe :
// c'est un registre des actions sensibles (comptes, scouts, documents…), pas
// un outil de suivi d'activité générale.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GROUPE.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limite = Math.min(100, Math.max(1, parseInt(searchParams.get('limite') ?? '30', 10)))
    const action = searchParams.get('action') ?? undefined
    const entite = searchParams.get('entite') ?? undefined

    const where = {
      paroisseId: paroisseIdRequise(session),
      ...(action ? { action } : {}),
      ...(entite ? { entite } : {}),
    }

    const [entrees, total] = await Promise.all([
      prisma.journalAudit.findMany({
        where,
        include: { acteur: { select: { id: true, nom: true, prenom: true, role: true } } },
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
    logger.error('GET /api/audit', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
