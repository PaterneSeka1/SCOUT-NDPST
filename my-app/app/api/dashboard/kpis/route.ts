import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

function debutDuMois(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id: userId, role, paroisseId } = session.user
  const debut = debutDuMois()

  // ADMIN_PLATEFORME (transverse, sans paroisse) n'atteint jamais ce tableau de
  // bord en pratique (redirigé vers /admin), mais on retourne des KPI vides
  // plutôt que de planter si la route était appelée directement.
  if (!paroisseId) {
    return NextResponse.json({ kpis: {}, activitesRecentes: [] })
  }

  try {
    let kpis: Record<string, number | string> = {}
    let activitesRecentes: unknown[] = []

    // Activités récentes communes (5 dernières de la paroisse)
    activitesRecentes = await prisma.activite.findMany({
      where: { paroisseId },
      orderBy: { dateDebut: 'desc' },
      take: 5,
      select: {
        id: true,
        titre: true,
        dateDebut: true,
        type: true,
        brancheType: true,
        lieu: true,
        _count: { select: { presences: true } },
      },
    })

    if (role === 'CHEF_GROUPE') {
      const [scoutsActifs, activitesMois, branches, totalPresences, presencesPositives] = await Promise.all([
        prisma.scout.count({ where: { paroisseId, actif: true } }),
        prisma.activite.count({ where: { paroisseId, dateDebut: { gte: debut } } }),
        prisma.scout.groupBy({ by: ['brancheType'], where: { paroisseId, actif: true } }),
        prisma.presence.count({
          where: { activite: { paroisseId, dateDebut: { gte: debut } } },
        }),
        prisma.presence.count({
          where: { present: true, activite: { paroisseId, dateDebut: { gte: debut } } },
        }),
      ])
      const taux = totalPresences > 0 ? Math.round((presencesPositives / totalPresences) * 100) : 0

      kpis = {
        'Scouts actifs': scoutsActifs,
        'Activités ce mois': activitesMois,
        'Taux de présence': `${taux} %`,
        'Branches actives': branches.length,
      }
    } else if (['ADJOINT_GROUPE', 'ASSISTANT_GROUPE'].includes(role)) {
      const [scoutsActifs, activitesMois, branches] = await Promise.all([
        prisma.scout.count({ where: { paroisseId, actif: true } }),
        prisma.activite.count({ where: { paroisseId, dateDebut: { gte: debut } } }),
        prisma.scout.groupBy({ by: ['brancheType'], where: { paroisseId, actif: true } }),
      ])

      kpis = {
        'Scouts actifs': scoutsActifs,
        'Activités ce mois': activitesMois,
        'Branches': branches.length,
      }
    } else if (['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE'].includes(role)) {
      const poste = await prisma.posteBranche.findFirst({
        where: { utilisateurId: userId },
        select: { brancheType: true },
        orderBy: { createdAt: 'asc' },
      })

      if (poste) {
        const { brancheType } = poste
        const [scoutsBranche, activitesMois, presencesPositives, totalPresences] = await Promise.all([
          prisma.scout.count({ where: { paroisseId, brancheType, actif: true } }),
          prisma.activite.count({
            where: {
              paroisseId,
              dateDebut: { gte: debut },
              OR: [{ brancheType }, { brancheType: null }],
            },
          }),
          prisma.presence.count({
            where: {
              present: true,
              scout: { brancheType },
              activite: { paroisseId, dateDebut: { gte: debut } },
            },
          }),
          prisma.presence.count({
            where: {
              scout: { brancheType },
              activite: { paroisseId, dateDebut: { gte: debut } },
            },
          }),
        ])

        kpis = {
          'Scouts dans la branche': scoutsBranche,
          'Activités ce mois': activitesMois,
          'Présences ce mois': `${presencesPositives} / ${totalPresences}`,
        }

        // Restreindre les activités récentes à la branche
        activitesRecentes = await prisma.activite.findMany({
          where: {
            paroisseId,
            OR: [{ brancheType }, { brancheType: null }],
          },
          orderBy: { dateDebut: 'desc' },
          take: 5,
          select: {
            id: true,
            titre: true,
            dateDebut: true,
            type: true,
            brancheType: true,
            lieu: true,
            _count: { select: { presences: true } },
          },
        })
      }
    } else if (role === 'PARENT') {
      const [nbEnfants, prochaines] = await Promise.all([
        prisma.lienParentScout.count({ where: { parentId: userId } }),
        prisma.activite.count({
          where: { paroisseId, dateDebut: { gte: new Date() } },
        }),
      ])

      kpis = {
        'Mes enfants': nbEnfants,
        'Prochaines activités': prochaines,
      }

      activitesRecentes = await prisma.activite.findMany({
        where: { paroisseId, dateDebut: { gte: new Date() } },
        orderBy: { dateDebut: 'asc' },
        take: 5,
        select: {
          id: true,
          titre: true,
          dateDebut: true,
          type: true,
          brancheType: true,
          lieu: true,
          _count: { select: { presences: true } },
        },
      })
    } else if (role === 'SCOUT') {
      const ficheScout = await prisma.scout.findFirst({
        where: { utilisateurId: userId },
        select: { id: true },
      })

      if (ficheScout) {
        const [badges, activitesParticipees] = await Promise.all([
          prisma.progressionScout.count({ where: { scoutId: ficheScout.id } }),
          prisma.presence.count({ where: { scoutId: ficheScout.id, present: true } }),
        ])

        kpis = {
          'Badges obtenus': badges,
          'Activités participées': activitesParticipees,
        }
      }
    }

    return NextResponse.json({ kpis, activitesRecentes })
  } catch (error) {
    logger.error('GET /api/dashboard/kpis', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
