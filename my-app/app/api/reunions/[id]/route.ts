import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_BRANCHE, ROLES_GESTION as ROLES_CREATION, ROLES_TOUT_STAFF as ROLES_LECTURE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { StatutReunionSchema, BrancheTypeSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_LECTURE.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    const paroisseId = paroisseIdRequise(session)

    const { id } = await params

    let brancheRequise: string | undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ erreur: 'Réunion introuvable' }, { status: 404 })
      brancheRequise = bt
    }

    const reunion = await prisma.jourReunion.findFirst({
      where: {
        id,
        paroisseId,
        ...(brancheRequise ? { brancheType: brancheRequise as never } : {}),
      },
      include: {
        creeParUtilisateur: { select: { prenom: true, nom: true } },
        _count: { select: { presences: true } },
        presences: {
          include: { scout: { select: { id: true, prenom: true, nom: true, photo: true, brancheType: true } } },
        },
      },
    })

    if (!reunion) return NextResponse.json({ erreur: 'Réunion introuvable' }, { status: 404 })
    return NextResponse.json(reunion)
  } catch (error) {
    logger.error('GET /api/reunions/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_CREATION.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    const paroisseId = paroisseIdRequise(session)

    const { id } = await params
    const body = await req.json()
    const { statut, dateReportee, dateHeure, brancheType, titre, lieu, dureeMinutes, notes } = body as {
      statut?: string
      dateReportee?: string | null
      dateHeure?: string
      brancheType?: string | null
      titre?: string | null
      lieu?: string | null
      dureeMinutes?: number | null
      notes?: string | null
    }

    const existant = await prisma.jourReunion.findFirst({
      where: { id, paroisseId },
    })
    if (!existant) return NextResponse.json({ erreur: 'Réunion introuvable' }, { status: 404 })

    // Un chef de branche ne peut modifier que les réunions de sa propre branche
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt || existant.brancheType !== bt) {
        return NextResponse.json({ erreur: 'Accès refusé à cette réunion' }, { status: 403 })
      }
    }

    if (statut !== undefined && !StatutReunionSchema.safeParse(statut).success) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }
    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    if (statut === 'REPORTEE' && !dateReportee) {
      return NextResponse.json({ erreur: 'La nouvelle date est requise pour reporter une réunion' }, { status: 400 })
    }

    const reunion = await prisma.jourReunion.update({
      where: { id },
      data: {
        ...(statut !== undefined ? { statut: statut as any } : {}),
        ...(dateReportee !== undefined ? { dateReportee: dateReportee ? new Date(dateReportee) : null } : {}),
        ...(dateHeure !== undefined ? { dateHeure: new Date(dateHeure) } : {}),
        ...(brancheType !== undefined ? { brancheType: brancheType as any } : {}),
        ...(titre !== undefined ? { titre } : {}),
        ...(lieu !== undefined ? { lieu } : {}),
        ...(dureeMinutes !== undefined ? { dureeMinutes } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    })

    return NextResponse.json(reunion)
  } catch (error) {
    logger.error('PATCH /api/reunions/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_CREATION.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    const paroisseId = paroisseIdRequise(session)

    const { id } = await params
    const existant = await prisma.jourReunion.findFirst({
      where: { id, paroisseId },
      include: { _count: { select: { presences: true } } },
    })
    if (!existant) return NextResponse.json({ erreur: 'Réunion introuvable' }, { status: 404 })

    await prisma.jourReunion.delete({ where: { id } })

    // Suppression cascade sur tout l'historique de présence de cette réunion
    // (PresenceReunion.onDelete: Cascade) : action sensible à journaliser.
    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'REUNION_SUPPRIMEE',
      entite: 'JourReunion',
      entiteId: id,
      details: { titre: existant.titre, dateHeure: existant.dateHeure, presencesSupprimees: existant._count.presences },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('DELETE /api/reunions/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
