import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType } from '@/app/generated/prisma/client'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { getParoissesDuDistrict, DistrictInvalideError } from '@/lib/district'
import { paroisseIdRequise } from '@/lib/session'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (session.user.role !== 'ASSISTANT_DISTRICT') {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const brancheUtilisateur = await getBrancheUtilisateur(session.user.id)
    if (!brancheUtilisateur) return NextResponse.json({ erreur: 'Aucune branche assignée' }, { status: 403 })
    const bt = brancheUtilisateur as BrancheType

    const paroisseId = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseId)
    const paroisseIds = paroisses.map((p) => p.id)

    const [scouts, totalBadges, activitesRecentes, programmesRecents] = await Promise.all([
      prisma.scout.findMany({
        where: { paroisseId: { in: paroisseIds }, brancheType: bt, actif: true },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          paroisse: { select: { nom: true } },
          _count: { select: { progressions: true } },
        },
        orderBy: [{ paroisse: { nom: 'asc' } }, { nom: 'asc' }],
      }),
      prisma.badge.count({ where: { brancheType: bt } }),
      prisma.activite.findMany({
        where: { paroisseId: { in: paroisseIds }, brancheType: bt, creePar: session.user.id },
        orderBy: { dateDebut: 'desc' },
        take: 10,
        select: { id: true, titre: true, dateDebut: true, lieu: true, paroisse: { select: { nom: true } } },
      }),
      prisma.programme.findMany({
        where: { paroisseId: { in: paroisseIds }, brancheType: bt, creePar: session.user.id },
        orderBy: { periodeDebut: 'desc' },
        take: 10,
        select: { id: true, titre: true, periodeDebut: true, periodeFin: true, paroisse: { select: { nom: true } } },
      }),
    ])

    return NextResponse.json({
      branche: bt,
      totalBadges,
      scouts: scouts.map((scout) => ({
        id: scout.id,
        nom: scout.nom,
        prenom: scout.prenom,
        matricule: scout.matricule,
        paroisseNom: scout.paroisse.nom,
        badgesValides: scout._count.progressions,
      })),
      activitesRecentes,
      programmesRecents,
    })
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('GET /api/district/ma-branche', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
