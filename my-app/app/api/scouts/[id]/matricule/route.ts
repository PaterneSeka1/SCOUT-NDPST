import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_GROUPE_ETENDU as ROLES_AUTORISES } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const existant = await prisma.scout.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true, matricule: true },
    })

    if (!existant) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { matricule } = body as { matricule?: string }

    if (!matricule?.trim()) {
      return NextResponse.json({ error: 'Le matricule est requis' }, { status: 400 })
    }

    const matriculeTrimmed = matricule.trim()

    // Vérifier l'unicité du matricule
    const doublon = await prisma.scout.findFirst({
      where: { matricule: matriculeTrimmed, NOT: { id } },
      select: { id: true },
    })

    if (doublon) {
      return NextResponse.json({ error: 'Ce matricule est déjà attribué à un autre scout' }, { status: 400 })
    }

    const scout = await prisma.scout.update({
      where: { id },
      data: { matricule: matriculeTrimmed },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        brancheType: true,
        actif: true,
      },
    })

    await enregistrerAudit({
      paroisseId: session.user.paroisseId,
      acteurId: session.user.id,
      action: 'SCOUT_MATRICULE_ATTRIBUE',
      entite: 'Scout',
      entiteId: id,
      details: { ancienMatricule: existant.matricule, nouveauMatricule: matriculeTrimmed },
    })

    return NextResponse.json(scout)
  } catch (error) {
    logger.error('PUT /api/scouts/[id]/matricule', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
