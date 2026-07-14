import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/app/generated/prisma/client'
import { ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur, getBrancheDistrictUtilisateur } from '@/lib/brancheUtilisateur'
import { getParoissesDuDistrict } from '@/lib/district'
import { paroisseIdRequise } from '@/lib/session'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

// Détermine si la session courante peut consulter/valider la progression de ce
// scout. Ne renvoie qu'un booléen : en cas de refus, l'appelant répond 404
// "Scout introuvable" (même message qu'un scout absent) pour ne jamais révéler
// à un tiers non autorisé qu'un scout existe dans une autre paroisse/branche.
async function autoriseSurScout(
  session: { user: { id: string; role: string; roleDistrict: string | null; paroisseId: string | null } },
  scout: { paroisseId: string; brancheType: string },
): Promise<boolean> {
  if (ROLES_BRANCHE.includes(session.user.role)) {
    const paroisseId = paroisseIdRequise(session)
    if (scout.paroisseId === paroisseId) {
      const brancheUtilisateur = await getBrancheUtilisateur(session.user.id)
      if (brancheUtilisateur === scout.brancheType) return true
    }
  }

  if (session.user.roleDistrict === 'ASSISTANT_DISTRICT') {
    const brancheUtilisateur = await getBrancheDistrictUtilisateur(session.user.id)
    if (brancheUtilisateur && brancheUtilisateur === scout.brancheType) {
      const { paroisses } = await getParoissesDuDistrict(paroisseIdRequise(session))
      if (paroisses.some((p) => p.id === scout.paroisseId)) return true
    }
  }

  return false
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params

    const scout = await prisma.scout.findUnique({
      where: { id },
      select: { id: true, nom: true, prenom: true, paroisseId: true, brancheType: true },
    })

    if (!scout || !(await autoriseSurScout(session, scout))) {
      return NextResponse.json({ erreur: 'Scout introuvable' }, { status: 404 })
    }

    const [badges, progressions] = await Promise.all([
      prisma.badge.findMany({
        where: { brancheType: scout.brancheType },
        orderBy: { ordre: 'asc' },
      }),
      prisma.progressionScout.findMany({
        where: { scoutId: id },
        include: { validePar: { select: { nom: true, prenom: true } } },
      }),
    ])

    const progressionsParBadge = new Map(progressions.map((p) => [p.badgeId, p]))

    const badgesReponse = badges
      .map((badge) => {
        const progression = progressionsParBadge.get(badge.id)
        return {
          id: badge.id,
          nom: badge.nom,
          description: badge.description,
          ordre: badge.ordre,
          icone: badge.icone,
          valide: Boolean(progression),
          dateValidation: progression ? progression.dateValidation.toISOString() : null,
          valideParNomComplet: progression ? `${progression.validePar.prenom} ${progression.validePar.nom}` : null,
          progressionId: progression ? progression.id : null,
        }
      })
      .sort((a, b) => a.ordre - b.ordre)

    return NextResponse.json({
      scout: { id: scout.id, nom: scout.nom, prenom: scout.prenom, brancheType: scout.brancheType },
      badges: badgesReponse,
    })
  } catch (error) {
    logger.error('GET /api/scouts/[id]/progressions', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params

    const scout = await prisma.scout.findUnique({
      where: { id },
      select: { id: true, nom: true, prenom: true, paroisseId: true, brancheType: true },
    })

    if (!scout || !(await autoriseSurScout(session, scout))) {
      return NextResponse.json({ erreur: 'Scout introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { badgeId, commentaire } = body as { badgeId?: string; commentaire?: string }

    if (!badgeId) {
      return NextResponse.json({ erreur: 'badgeId est requis' }, { status: 400 })
    }

    const badge = await prisma.badge.findUnique({ where: { id: badgeId }, select: { id: true, brancheType: true } })

    if (!badge) {
      return NextResponse.json({ erreur: 'Badge introuvable' }, { status: 400 })
    }
    if (badge.brancheType !== scout.brancheType) {
      return NextResponse.json({ erreur: "Ce badge n'appartient pas à la branche de ce scout" }, { status: 400 })
    }

    try {
      const progression = await prisma.progressionScout.create({
        data: {
          scoutId: id,
          badgeId,
          valideParId: session.user.id,
          commentaire: commentaire?.trim() || null,
        },
      })

      return NextResponse.json(progression, { status: 201 })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ erreur: 'Ce badge est déjà validé pour ce scout' }, { status: 409 })
      }
      throw error
    }
  } catch (error) {
    logger.error('POST /api/scouts/[id]/progressions', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
