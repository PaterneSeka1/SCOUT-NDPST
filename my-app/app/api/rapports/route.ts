import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_GROUPE } from '@/lib/roles'

// Fenêtre glissante utilisée pour les statistiques rétrospectives du rapport
// (taux de présence, dernières activités/réunions). Par défaut 6 mois, pour
// ne pas changer le comportement des appels existants sans le paramètre.
const PERIODES_VALIDES = ['3', '6', '12'] as const

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  if (!ROLES_GROUPE.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const paroisseId = session.user.paroisseId
  if (!paroisseId) return NextResponse.json({ erreur: 'Aucune paroisse' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const periodeParam = searchParams.get('periode')
  const nbMois = (PERIODES_VALIDES as readonly string[]).includes(periodeParam ?? '')
    ? Number(periodeParam)
    : 6

  const debutMois = new Date()
  debutMois.setDate(1)
  debutMois.setHours(0, 0, 0, 0)

  const il6mois = new Date(Date.now() - nbMois * 30 * 86400000)
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
    prisma.scout.groupBy({ by: ['brancheType'], where: { paroisseId }, _count: { id: true } }),
    prisma.scout.count({ where: { paroisseId, actif: true } }),
    prisma.scout.count({ where: { paroisseId, actif: false } }),
    prisma.activite.count({ where: { paroisseId, dateDebut: { gte: debutMois, lte: maintenant } } }),
    prisma.activite.findMany({
      where: { paroisseId, dateDebut: { gte: il6mois, lte: maintenant } },
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
    prisma.activite.count({ where: { paroisseId, dateDebut: { gte: il6mois, lte: maintenant } } }),
    prisma.presence.count({
      where: { present: true, activite: { paroisseId, dateDebut: { gte: il6mois, lte: maintenant } } },
    }),
    prisma.scout.count({ where: { paroisseId, actif: true } }),
    prisma.jourReunion.count({
      where: { paroisseId, dateHeure: { gte: debutMois, lte: maintenant } },
    }),
    prisma.jourReunion.findMany({
      where: { paroisseId, statut: 'TERMINEE', dateHeure: { gte: il6mois, lte: maintenant } },
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
