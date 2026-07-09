import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_DISTRICT } from '@/lib/roles'
import { paroisseIdRequise } from '@/lib/session'
import { getParoissesDuDistrict } from '@/lib/district'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  if (!ROLES_DISTRICT.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const paroisseId = paroisseIdRequise(session)
  const { paroisses } = await getParoissesDuDistrict(paroisseId)
  const paroisseIds = paroisses.map((p) => p.id)

  const debutMois = new Date()
  debutMois.setDate(1)
  debutMois.setHours(0, 0, 0, 0)

  const il6mois = new Date(Date.now() - 180 * 86400000)
  // Un rapport est par nature rétrospectif : une activité ou réunion pas
  // encore passée ne doit jamais compter dans les statistiques (elle
  // n'a encore aucune présence à comptabiliser et fausserait les taux).
  const maintenant = new Date()

  const [
    scoutsParBranche,
    scoutsActifs,
    scoutsInactifs,
    activitesMois,
    activites6mois,
    activitesCount6mois,
    presences6mois,
    scouts6moisTotal,
    reunionsMois,
    dernieresReunions,
  ] = await Promise.all([
    prisma.scout.groupBy({ by: ['brancheType'], where: { paroisseId: { in: paroisseIds } }, _count: { id: true } }),
    prisma.scout.count({ where: { paroisseId: { in: paroisseIds }, actif: true } }),
    prisma.scout.count({ where: { paroisseId: { in: paroisseIds }, actif: false } }),
    prisma.activite.count({ where: { paroisseId: { in: paroisseIds }, dateDebut: { gte: debutMois, lte: maintenant } } }),
    prisma.activite.findMany({
      where: { paroisseId: { in: paroisseIds }, dateDebut: { gte: il6mois, lte: maintenant } },
      select: {
        id: true, titre: true, dateDebut: true, type: true, brancheType: true,
        _count: { select: { presences: true } },
      },
      orderBy: { dateDebut: 'desc' },
      take: 10,
    }),
    // Nombre réel d'activités sur 6 mois (non plafonné) : sert de dénominateur
    // au taux de présence, contrairement à `activites6mois` limité à 10 lignes
    // pour l'affichage.
    prisma.activite.count({ where: { paroisseId: { in: paroisseIds }, dateDebut: { gte: il6mois, lte: maintenant } } }),
    prisma.presence.count({
      where: { present: true, activite: { paroisseId: { in: paroisseIds }, dateDebut: { gte: il6mois, lte: maintenant } } },
    }),
    prisma.scout.count({ where: { paroisseId: { in: paroisseIds }, actif: true } }),
    prisma.jourReunion.count({
      where: { paroisseId: { in: paroisseIds }, dateHeure: { gte: debutMois, lte: maintenant } },
    }),
    prisma.jourReunion.findMany({
      where: { paroisseId: { in: paroisseIds }, statut: 'TERMINEE', dateHeure: { gte: il6mois, lte: maintenant } },
      include: {
        _count: { select: { presences: true } },
        presences: { where: { statut: 'PRESENT' }, select: { id: true } },
      },
      orderBy: { dateHeure: 'desc' },
      take: 10,
    }),
  ])

  const tauxPresence = scouts6moisTotal > 0 && activitesCount6mois > 0
    ? Math.round((presences6mois / (scouts6moisTotal * activitesCount6mois)) * 100)
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
