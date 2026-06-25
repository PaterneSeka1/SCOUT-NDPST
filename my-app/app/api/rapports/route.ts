import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const paroisseId = session.user.paroisseId
  if (!paroisseId) return NextResponse.json({ erreur: 'Aucune paroisse' }, { status: 400 })

  const debut = new Date()
  debut.setDate(1)
  debut.setHours(0, 0, 0, 0)

  const [
    scoutsParBranche,
    scoutsActifs,
    scoutsInactifs,
    activitesMois,
    activites6mois,
    presences6mois,
    scouts6moisTotal,
  ] = await Promise.all([
    prisma.scout.groupBy({ by: ['brancheType'], where: { paroisseId }, _count: { id: true } }),
    prisma.scout.count({ where: { paroisseId, actif: true } }),
    prisma.scout.count({ where: { paroisseId, actif: false } }),
    prisma.activite.count({ where: { paroisseId, dateDebut: { gte: debut } } }),
    prisma.activite.findMany({
      where: { paroisseId, dateDebut: { gte: new Date(Date.now() - 180 * 86400000) } },
      select: { id: true, titre: true, dateDebut: true, type: true, brancheType: true,
        _count: { select: { presences: true } } },
      orderBy: { dateDebut: 'desc' },
      take: 10,
    }),
    prisma.presence.count({
      where: { activite: { paroisseId, dateDebut: { gte: new Date(Date.now() - 180 * 86400000) } } },
    }),
    prisma.scout.count({ where: { paroisseId, actif: true } }),
  ])

  const tauxPresence = scouts6moisTotal > 0 && activites6mois.length > 0
    ? Math.round((presences6mois / (scouts6moisTotal * activites6mois.length)) * 100)
    : 0

  return NextResponse.json({
    scoutsParBranche,
    scoutsActifs,
    scoutsInactifs,
    activitesMois,
    tauxPresence,
    dernieresActivites: activites6mois,
  })
}
