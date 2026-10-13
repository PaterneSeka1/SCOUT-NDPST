import { BadRequestException, Injectable } from '@nestjs/common'
import type { BrancheType } from '../../generated/prisma/client'
import { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'

function debutDuMois(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

const SELECTION_ACTIVITE_RECENTE = {
  id: true,
  titre: true,
  dateDebut: true,
  type: true,
  brancheType: true,
  lieu: true,
  _count: { select: { presences: true } },
} as const

// Indicateurs du tableau de bord et rapport d'activité de la paroisse.
@Injectable()
export class IndicateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  // KPI du tableau de bord, adaptés au rôle (rôles autorisés contrôlés par le
  // contrôleur : staff paroissial, parents et scouts).
  async kpis(utilisateur: UtilisateurSession) {
    const { id: userId, role, paroisseId } = utilisateur
    const debut = debutDuMois()

    // Compte paroissial sans paroisse (ne devrait pas exister, contrainte CHECK
    // en base) : KPI vides plutôt qu'une erreur.
    if (!paroisseId) return { kpis: {}, activitesRecentes: [] }

    let kpis: Record<string, number | string> = {}

    // Activités récentes communes (5 dernières de la paroisse)
    let activitesRecentes: unknown[] = await this.prisma.activite.findMany({
      where: { paroisseId },
      orderBy: { dateDebut: 'desc' },
      take: 5,
      select: SELECTION_ACTIVITE_RECENTE,
    })

    if (role === 'CHEF_GROUPE') {
      const [scoutsActifs, activitesMois, branches, totalPresences, presencesPositives, comptesActifs] =
        await Promise.all([
          this.prisma.scout.count({ where: { paroisseId, actif: true } }),
          this.prisma.activite.count({
            where: { paroisseId, dateDebut: { gte: debut } },
          }),
          this.prisma.scout.groupBy({
            by: ['brancheType'],
            where: { paroisseId, actif: true },
          }),
          this.prisma.presence.count({
            where: { activite: { paroisseId, dateDebut: { gte: debut } } },
          }),
          this.prisma.presence.count({
            where: {
              present: true,
              activite: { paroisseId, dateDebut: { gte: debut } },
            },
          }),
          this.prisma.utilisateur.count({ where: { paroisseId, actif: true } }),
        ])
      const taux = totalPresences > 0 ? Math.round((presencesPositives / totalPresences) * 100) : 0

      kpis = {
        'Scouts actifs': scoutsActifs,
        'Activités ce mois': activitesMois,
        'Taux de présence': `${taux} %`,
        'Branches actives': branches.length,
        'Comptes actifs': comptesActifs,
      }
    } else if (['ADJOINT_GROUPE', 'ASSISTANT_GROUPE'].includes(role)) {
      const [scoutsActifs, activitesMois, branches] = await Promise.all([
        this.prisma.scout.count({ where: { paroisseId, actif: true } }),
        this.prisma.activite.count({
          where: { paroisseId, dateDebut: { gte: debut } },
        }),
        this.prisma.scout.groupBy({
          by: ['brancheType'],
          where: { paroisseId, actif: true },
        }),
      ])

      kpis = {
        'Scouts actifs': scoutsActifs,
        'Activités ce mois': activitesMois,
        Branches: branches.length,
      }
    } else if (['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE'].includes(role)) {
      const brancheType = (await this.perimetre.brancheUtilisateur(userId)) as BrancheType | null

      if (brancheType) {
        const [scoutsBranche, activitesMois, presencesPositives, totalPresences] = await Promise.all([
          this.prisma.scout.count({
            where: { paroisseId, brancheType, actif: true },
          }),
          this.prisma.activite.count({
            where: {
              paroisseId,
              dateDebut: { gte: debut },
              OR: [{ brancheType }, { brancheType: null }],
            },
          }),
          this.prisma.presence.count({
            where: {
              present: true,
              scout: { brancheType },
              activite: { paroisseId, dateDebut: { gte: debut } },
            },
          }),
          this.prisma.presence.count({
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
        activitesRecentes = await this.prisma.activite.findMany({
          where: { paroisseId, OR: [{ brancheType }, { brancheType: null }] },
          orderBy: { dateDebut: 'desc' },
          take: 5,
          select: SELECTION_ACTIVITE_RECENTE,
        })
      }
    } else if (role === 'PARENT') {
      const [nbEnfants, prochaines] = await Promise.all([
        this.prisma.lienParentScout.count({ where: { parentId: userId } }),
        this.prisma.activite.count({
          where: { paroisseId, dateDebut: { gte: new Date() } },
        }),
      ])

      kpis = {
        'Mes enfants': nbEnfants,
        'Prochaines activités': prochaines,
      }

      activitesRecentes = await this.prisma.activite.findMany({
        where: { paroisseId, dateDebut: { gte: new Date() } },
        orderBy: { dateDebut: 'asc' },
        take: 5,
        select: SELECTION_ACTIVITE_RECENTE,
      })
    } else if (role === 'SCOUT') {
      const ficheScout = await this.prisma.scout.findFirst({
        where: { utilisateurId: userId },
        select: { id: true },
      })

      if (ficheScout) {
        const [badges, activitesParticipees] = await Promise.all([
          this.prisma.progressionScout.count({
            where: { scoutId: ficheScout.id },
          }),
          this.prisma.presence.count({
            where: { scoutId: ficheScout.id, present: true },
          }),
        ])

        kpis = {
          'Badges obtenus': badges,
          'Activités participées': activitesParticipees,
        }
      }
    }

    return { kpis, activitesRecentes }
  }

  // Rapport d'activité de la paroisse (direction du groupe, contrôlé par le contrôleur).
  async rapport(utilisateur: UtilisateurSession) {
    const paroisseId = utilisateur.paroisseId
    if (!paroisseId) throw new BadRequestException('Aucune paroisse')

    const debutMois = debutDuMois()
    const il6mois = new Date(Date.now() - 180 * 86400000)
    // Un rapport est par nature rétrospectif : une activité ou réunion pas
    // encore passée ne doit jamais compter dans les statistiques (elle
    // n'a encore aucune présence à comptabiliser et fausserait les taux).
    const maintenant = new Date()
    const periode6mois = { gte: il6mois, lte: maintenant }

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
      this.prisma.scout.groupBy({
        by: ['brancheType'],
        where: { paroisseId },
        _count: { id: true },
      }),
      this.prisma.scout.count({ where: { paroisseId, actif: true } }),
      this.prisma.scout.count({ where: { paroisseId, actif: false } }),
      this.prisma.activite.count({
        where: { paroisseId, dateDebut: { gte: debutMois, lte: maintenant } },
      }),
      this.prisma.activite.findMany({
        where: { paroisseId, dateDebut: periode6mois },
        select: {
          id: true,
          titre: true,
          dateDebut: true,
          type: true,
          brancheType: true,
          _count: { select: { presences: true } },
        },
        orderBy: { dateDebut: 'desc' },
        take: 10,
      }),
      // Nombre réel d'activités sur 6 mois (non plafonné) : sert de dénominateur
      // au taux de présence, contrairement à `activites6mois` limité à 10 lignes
      // pour l'affichage.
      this.prisma.activite.count({
        where: { paroisseId, dateDebut: periode6mois },
      }),
      this.prisma.presence.count({
        where: {
          present: true,
          activite: { paroisseId, dateDebut: periode6mois },
        },
      }),
      this.prisma.scout.count({ where: { paroisseId, actif: true } }),
      this.prisma.jourReunion.count({
        where: { paroisseId, dateHeure: { gte: debutMois, lte: maintenant } },
      }),
      this.prisma.jourReunion.findMany({
        where: { paroisseId, statut: 'TERMINEE', dateHeure: periode6mois },
        include: {
          _count: { select: { presences: true } },
          presences: { where: { statut: 'PRESENT' }, select: { id: true } },
        },
        orderBy: { dateHeure: 'desc' },
        take: 10,
      }),
    ])

    const tauxPresence =
      scouts6moisTotal > 0 && activitesCount6mois > 0
        ? Math.round((presences6mois / (scouts6moisTotal * activitesCount6mois)) * 100)
        : 0

    // Taux de présence moyen aux réunions terminées
    const tauxPresenceReunions =
      dernieresReunions.length > 0
        ? Math.round(
            (dernieresReunions.reduce((acc, r) => {
              const total = r._count.presences
              const presents = r.presences.length
              return acc + (total > 0 ? presents / total : 0)
            }, 0) /
              dernieresReunions.length) *
              100,
          )
        : 0

    return {
      scoutsParBranche,
      scoutsActifs,
      scoutsInactifs,
      activitesMois,
      tauxPresence,
      dernieresActivites: activites6mois,
      reunionsMois,
      tauxPresenceReunions,
      dernieresReunions: dernieresReunions.map((r) => ({
        id: r.id,
        titre: r.titre,
        brancheType: r.brancheType,
        dateHeure: r.dateHeure,
        dateReportee: r.dateReportee,
        totalScouts: r._count.presences,
        presents: r.presences.length,
        tauxPresence: r._count.presences > 0 ? Math.round((r.presences.length / r._count.presences) * 100) : 0,
      })),
    }
  }
}
