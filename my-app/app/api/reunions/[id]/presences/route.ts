import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF as ROLES_PRESENCES, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { StatutPresenceReunionSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

async function verifierAccesBranche(role: string, userId: string, paroisseId: string, brancheReunion: string | null): Promise<boolean> {
  if (!ROLES_BRANCHE.includes(role)) return true
  const bt = await getBrancheUtilisateur(userId, paroisseId)
  return !!bt && bt === brancheReunion
}

// GET — feuille de présences : réunion + scouts de la branche + statuts existants
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PRESENCES.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const { id } = await params

    const reunion = await prisma.jourReunion.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
    })
    if (!reunion) return NextResponse.json({ erreur: 'Réunion introuvable' }, { status: 404 })

    if (!(await verifierAccesBranche(session.user.role, session.user.id, session.user.paroisseId, reunion.brancheType))) {
      return NextResponse.json({ erreur: 'Accès refusé à cette réunion' }, { status: 403 })
    }

    // Scouts de la branche concernée (ou tous si inter-branches)
    const scouts = await prisma.scout.findMany({
      where: {
        paroisseId: session.user.paroisseId,
        actif: true,
        ...(reunion.brancheType ? { brancheType: reunion.brancheType } : {}),
      },
      select: { id: true, prenom: true, nom: true, photo: true, brancheType: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    // Presences déjà enregistrées
    const presences = await prisma.presenceReunion.findMany({
      where: { jourReunionId: id },
      select: { scoutId: true, statut: true, note: true },
    })

    const presencesMap = Object.fromEntries(presences.map((p) => [p.scoutId, p]))

    return NextResponse.json({ reunion, scouts, presencesMap })
  } catch (error) {
    logger.error('GET /api/reunions/[id]/presences', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — enregistre / met à jour les présences en masse (upsert)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PRESENCES.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const { id } = await params

    const reunion = await prisma.jourReunion.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
    })
    if (!reunion) return NextResponse.json({ erreur: 'Réunion introuvable' }, { status: 404 })

    if (!(await verifierAccesBranche(session.user.role, session.user.id, session.user.paroisseId, reunion.brancheType))) {
      return NextResponse.json({ erreur: 'Accès refusé à cette réunion' }, { status: 403 })
    }

    const body = await req.json()
    const { presences } = body as {
      presences: Array<{ scoutId: string; statut: 'PRESENT' | 'ABSENT' | 'EXCUSE'; note?: string }>
    }

    if (!Array.isArray(presences)) return NextResponse.json({ erreur: 'Format invalide' }, { status: 400 })
    if (presences.some((p) => !p.scoutId || !StatutPresenceReunionSchema.safeParse(p.statut).success)) {
      return NextResponse.json({ erreur: 'Statut de présence invalide' }, { status: 400 })
    }

    await prisma.$transaction(
      presences.map(({ scoutId, statut, note }) =>
        prisma.presenceReunion.upsert({
          where: { jourReunionId_scoutId: { jourReunionId: id, scoutId } },
          create: {
            jourReunionId: id,
            scoutId,
            statut,
            note: note ?? null,
            marqueParId: session.user.id,
          },
          update: {
            statut,
            note: note ?? null,
            marqueParId: session.user.id,
          },
        })
      )
    )

    // Passer la réunion en TERMINEE si elle ne l'est pas encore
    if (reunion.statut === 'PLANIFIEE' || reunion.statut === 'REPORTEE') {
      await prisma.jourReunion.update({
        where: { id },
        data: { statut: 'TERMINEE' },
      })
    }

    return NextResponse.json({ ok: true, count: presences.length })
  } catch (error) {
    logger.error('POST /api/reunions/[id]/presences', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
