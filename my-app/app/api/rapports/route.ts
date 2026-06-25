import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const paroisseId = session.user.paroisseId
  if (!paroisseId) return NextResponse.json({ erreur: 'Aucune paroisse' }, { status: 400 })

  const debutMois = new Date()
  debutMois.setDate(1)
  debutMois.setHours(0, 0, 0, 0)

  const il6mois = new Date(Date.now() - 180 * 86400000)

  const [
    scoutsParBranche,
    scoutsActifs,
    scoutsInactifs,
    activitesMois,
    activites6mois,
    presences6mois,
    scouts6moisTotal,
    reunionsMois,
    reunionsTerminees,
    dernieresReunions,
  ] = await Promise.all([
    prisma.scout.groupBy({ by: ['brancheType'], where: { paroisseId }, _count: { id: true } }),
    prisma.scout.count({ where: { paroisseId, actif: true } }),
    prisma.scout.count({ where: { paroisseId, actif: false } }),
    prisma.activite.count({ where: { paroisseId, dateDebut: { gte: debutMois } } }),
    prisma.activite.findMany({
      where: { paroisseId, dateDebut: { gte: il6mois } },
      select: {
        id: true, titre: true, dateDebut: true, type: true, brancheType: true,
        _count: { select: { presences: true } },
      },
      orderBy: { dateDebut: 'desc' },
      take: 10,
    }),
    prisma.presence.count({
      where: { activite: { paroisseId, dateDebut: { gte: il6mois } } },
    }),
    prisma.scout.count({ where: { paroisseId, actif: true } }),
    prisma.jourReunion.count({
      where: { paroisseId, dateHeure: { gte: debutMois } },
    }),
    prisma.jourReunion.findMany({
      where: { paroisseId, statut: 'TERMINEE', dateHeure: { gte: il6mois } },
      include: {
        _count: { select: { presences: true } },
        presences: {
          where: { statut: 'PRESENT' },
          select: { id: true },
        },
      },
      orderBy: { dateHeure: 'desc' },
      take: 10,
    }),
    prisma.jourReunion.findMany({
      where: { paroisseId, statut: 'TERMINEE', dateHeure: { gte: il6mois } },
      include: {
        _count: { select: { presences: true } },
        presences: { where: { statut: 'PRESENT' }, select: { id: true } },
      },
      orderBy: { dateHeure: 'desc' },
      take: 10,
    }),
  ])

  const tauxPresence = scouts6moisTotal > 0 && activites6mois.length > 0
    ? Math.round((presences6mois / (scouts6moisTotal * activites6mois.length)) * 100)
    : 0

  // Taux de présence moyen aux réunions terminées
  const tauxPresenceReunions = dernieresReunions.length > 0
    ? Math.round(
        dernieresReunions.reduce((acc, r) => {
          const total = r._count.presences
          const presents = r.presences.length
          return acc + (total > 0 ? presents / total : 0)
        }, 0) / dernieresReunions.length * 100
      )
    : 0

  const dernieresReunionsFormatted = dernieresReunions.map((r) => ({
    id: r.id,
    titre: r.titre,
    brancheType: r.brancheType,
    dateHeure: r.dateHeure,
    dateReportee: r.dateReportee,
    totalScouts: r._count.presences,
    presents: r.presences.length,
    tauxPresence: r._count.presences > 0
      ? Math.round((r.presences.length / r._count.presences) * 100)
      : 0,
  }))

  return NextResponse.json({
    scoutsParBranche,
    scoutsActifs,
    scoutsInactifs,
    activitesMois,
    tauxPresence,
    dernieresActivites: activites6mois,
    reunionsMois,
    tauxPresenceReunions,
    dernieresReunions: dernieresReunionsFormatted,
  })
}
