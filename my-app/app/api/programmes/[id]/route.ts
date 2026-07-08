import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_BRANCHE, ROLES_GESTION, ROLES_TOUT_STAFF as ROLES_LECTURE } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { paroisseIdRequise } from '@/lib/session'

type RouteParams = { params: Promise<{ id: string }> }

async function getBrancheUtilisateur(userId: string, paroisseId: string): Promise<string | null> {
  const poste = await prisma.posteBranche.findFirst({
    where: { utilisateurId: userId, paroisseId },
    select: { brancheType: true },
    orderBy: { createdAt: 'asc' },
  })
  return poste?.brancheType ?? null
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_LECTURE.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    const paroisseId = paroisseIdRequise(session)

    const { id } = await params

    const programme = await prisma.programme.findFirst({
      where: { id, paroisseId },
      include: {
        creeParUtilisateur: { select: { prenom: true, nom: true } },
        lignes: {
          orderBy: { ordre: 'asc' },
          include: { activite: { select: { id: true, titre: true, dateDebut: true } } },
        },
      },
    })

    if (!programme) return NextResponse.json({ erreur: 'Programme introuvable' }, { status: 404 })
    return NextResponse.json(programme)
  } catch (error) {
    logger.error('GET /api/programmes/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GESTION.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    const paroisseId = paroisseIdRequise(session)

    const { id } = await params
    const body = await req.json()
    const { titre, description, periodeDebut, periodeFin } = body as {
      titre?: string
      description?: string | null
      periodeDebut?: string
      periodeFin?: string
    }

    const existant = await prisma.programme.findFirst({
      where: { id, paroisseId },
    })
    if (!existant) return NextResponse.json({ erreur: 'Programme introuvable' }, { status: 404 })

    // Un responsable de branche ne peut modifier que le programme de sa propre branche
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt || existant.brancheType !== bt) {
        return NextResponse.json({ erreur: 'Accès refusé à ce programme' }, { status: 403 })
      }
    }

    const debut = periodeDebut !== undefined ? new Date(periodeDebut) : existant.periodeDebut
    const fin = periodeFin !== undefined ? new Date(periodeFin) : existant.periodeFin
    if (fin <= debut) {
      return NextResponse.json({ erreur: 'La date de fin doit être après la date de début' }, { status: 400 })
    }

    const programme = await prisma.programme.update({
      where: { id },
      data: {
        ...(titre !== undefined ? { titre } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(periodeDebut !== undefined ? { periodeDebut: debut } : {}),
        ...(periodeFin !== undefined ? { periodeFin: fin } : {}),
      },
    })

    return NextResponse.json(programme)
  } catch (error) {
    logger.error('PATCH /api/programmes/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GESTION.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    const paroisseId = paroisseIdRequise(session)

    const { id } = await params
    const existant = await prisma.programme.findFirst({
      where: { id, paroisseId },
    })
    if (!existant) return NextResponse.json({ erreur: 'Programme introuvable' }, { status: 404 })

    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt || existant.brancheType !== bt) {
        return NextResponse.json({ erreur: 'Accès refusé à ce programme' }, { status: 403 })
      }
    }

    await prisma.programme.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('DELETE /api/programmes/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
