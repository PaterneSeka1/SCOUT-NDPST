import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { BrancheTypeSchema, LABELS_BRANCHES, ROLES_BRANCHE, StatutReunionSchema, entierBorne } from '@scout/shared'
import type { BrancheType, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { PerimetreService } from '../../common/perimetre.service'
import { champCsv as champ, contentDispositionTelechargement } from '../../common/lib/csv'
import type { UtilisateurSession } from '../../common/types'
import type {
  CorpsConfigReunion,
  CorpsCreationReunions,
  CorpsModificationReunion,
  CorpsPresencesReunion,
} from './reunions.schemas'

const LABELS_STATUT: Record<string, string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  EXCUSE: 'Excusé',
}

const SELECTION_SCOUT = { id: true, prenom: true, nom: true, photo: true, brancheType: true } as const

export interface FiltresReunions {
  branche: string | null
  statut: string | null
  recherche?: string | null
  page?: string | null
  limite?: string | null
}

export interface ExportCsv {
  contenu: string
  contentDisposition: string
}

@Injectable()
export class ReunionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
    private readonly audit: AuditService,
  ) {}

  // Un rôle de branche n'accède qu'aux réunions de SA branche — les réunions
  // inter-branches (brancheType null) relèvent du groupe.
  private async verifierAccesBranche(utilisateur: UtilisateurSession, brancheReunion: string | null) {
    if (!ROLES_BRANCHE.includes(utilisateur.role)) return
    const bt = await this.perimetre.brancheUtilisateur(utilisateur.id, utilisateur)
    if (!bt || bt !== brancheReunion) throw new ForbiddenException('Accès refusé à cette réunion')
  }

  // Branche imposée en lecture à un rôle de branche ; compte de branche sans
  // branche assignée : 404.
  private async brancheRequise(utilisateur: UtilisateurSession): Promise<BrancheType | undefined> {
    if (!ROLES_BRANCHE.includes(utilisateur.role)) return undefined
    const bt = await this.perimetre.brancheUtilisateur(utilisateur.id, utilisateur)
    if (!bt) throw new NotFoundException('Réunion introuvable')
    return bt as BrancheType
  }

  // ---------------------------------------------------------------------------
  // Liste et création en série
  // ---------------------------------------------------------------------------

  // Contrat historique : tableau complet (consommé tel quel par le frontend).
  // Dès que `page` ou `limite` est fourni, la réponse devient paginée côté
  // serveur : { reunions, pagination } (limite bornée à 100).
  async lister(utilisateur: UtilisateurSession, filtres: FiltresReunions) {
    const { branche, statut } = filtres
    const recherche = filtres.recherche?.trim() ?? ''
    const pagine = filtres.page != null || filtres.limite != null
    const page = entierBorne(filtres.page ?? null, 1, 1, Number.MAX_SAFE_INTEGER)
    const limite = entierBorne(filtres.limite ?? null, 20, 1, 100)

    const statutValide = StatutReunionSchema.safeParse(statut)
    if (statut && !statutValide.success) throw new BadRequestException('Statut invalide')

    // Les responsables de branche ne voient QUE leur branche — on ignore
    // délibérément toute valeur de "branche" fournie par le client pour ce
    // groupe de rôles, sinon un simple `?branche=AUTRE` dans l'URL suffirait
    // à contourner la restriction. Strictement la branche de l'utilisateur :
    // les réunions inter-branches (brancheType null) relèvent du groupe, et
    // les routes /reunions/:id les refusent aux rôles de branche.
    let filtreBranche: Prisma.JourReunionWhereInput = {}
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id, utilisateur)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que toutes les branches par défaut.
      if (!bt) return pagine ? { reunions: [], pagination: { page, limite, total: 0, totalPages: 0 } } : []
      filtreBranche = { brancheType: bt as BrancheType }
    } else if (branche) {
      const brancheValide = BrancheTypeSchema.safeParse(branche)
      if (!brancheValide.success) throw new BadRequestException('Branche invalide')
      filtreBranche = { brancheType: brancheValide.data }
    }

    const where: Prisma.JourReunionWhereInput = {
      ...filtreBranche,
      ...(statut && statutValide.success ? { statut: statutValide.data } : {}),
      ...(recherche
        ? {
            OR: [
              { titre: { contains: recherche, mode: 'insensitive' } },
              { lieu: { contains: recherche, mode: 'insensitive' } },
              { notes: { contains: recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
    const requete = {
      where,
      include: {
        _count: { select: { presences: true } },
        creeParUtilisateur: { select: { prenom: true, nom: true } },
      },
      orderBy: { dateHeure: 'asc' },
    } satisfies Prisma.JourReunionFindManyArgs

    if (!pagine) return this.prisma.jourReunion.findMany(requete)

    const [reunions, total] = await Promise.all([
      this.prisma.jourReunion.findMany({ ...requete, skip: (page - 1) * limite, take: limite }),
      this.prisma.jourReunion.count({ where }),
    ])
    return { reunions, pagination: { page, limite, total, totalPages: Math.ceil(total / limite) } }
  }

  // Corps déjà validé par SchemaCreationReunions (dates, branche, textes).
  async creer(utilisateur: UtilisateurSession, corps: CorpsCreationReunions) {
    const { dates: datesObj, brancheType, titre, lieu, dureeMinutes, notes } = corps

    // Un chef de branche ne peut créer que pour sa propre branche
    let brancheEffective: BrancheType | null = brancheType ?? null
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id, utilisateur)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      brancheEffective = bt as BrancheType
    }

    return this.prisma.$transaction(
      datesObj.map((d) =>
        this.prisma.jourReunion.create({
          data: {
            creePar: utilisateur.id,
            dateHeure: d,
            brancheType: brancheEffective,
            titre: titre ?? null,
            lieu: lieu ?? null,
            dureeMinutes: dureeMinutes ?? null,
            notes: notes ?? null,
          },
        }),
      ),
    )
  }

  // ---------------------------------------------------------------------------
  // Détail, modification, suppression
  // ---------------------------------------------------------------------------

  async detail(utilisateur: UtilisateurSession, id: string) {
    const branche = await this.brancheRequise(utilisateur)

    const reunion = await this.prisma.jourReunion.findFirst({
      where: { id, ...(branche ? { brancheType: branche } : {}) },
      include: {
        creeParUtilisateur: { select: { prenom: true, nom: true } },
        _count: { select: { presences: true } },
        presences: { include: { scout: { select: SELECTION_SCOUT } } },
      },
    })
    if (!reunion) throw new NotFoundException('Réunion introuvable')
    return reunion
  }

  // Corps déjà validé par SchemaModificationReunion (statut, dates, report).
  async modifier(utilisateur: UtilisateurSession, id: string, corps: CorpsModificationReunion) {
    const { statut, dateReportee, dateHeure, brancheType, titre, lieu, dureeMinutes, notes } = corps

    const existant = await this.prisma.jourReunion.findFirst({ where: { id } })
    if (!existant) throw new NotFoundException('Réunion introuvable')

    // Un chef de branche ne peut modifier que les réunions de sa propre branche
    await this.verifierAccesBranche(utilisateur, existant.brancheType)

    // Un chef de branche ne peut pas déplacer une réunion vers une autre branche
    // (ni la rendre inter-branches) : cf. PUT /activites/:id.
    if (ROLES_BRANCHE.includes(utilisateur.role) && brancheType !== undefined && (brancheType ?? null) !== existant.brancheType) {
      throw new ForbiddenException('Le changement de branche est réservé au groupe')
    }

    return this.prisma.jourReunion.update({
      where: { id },
      data: {
        ...(statut !== undefined ? { statut } : {}),
        ...(dateReportee !== undefined ? { dateReportee } : {}),
        ...(dateHeure ? { dateHeure } : {}),
        ...(brancheType !== undefined ? { brancheType: brancheType ?? null } : {}),
        ...(titre !== undefined ? { titre } : {}),
        ...(lieu !== undefined ? { lieu } : {}),
        ...(dureeMinutes !== undefined ? { dureeMinutes } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    })
  }

  async supprimer(utilisateur: UtilisateurSession, id: string) {
    const existant = await this.prisma.jourReunion.findFirst({
      where: { id },
      include: { _count: { select: { presences: true } } },
    })
    if (!existant) throw new NotFoundException('Réunion introuvable')

    // Même règle que la modification : un chef de branche ne supprime que les
    // réunions de sa propre branche (ni celles des autres branches, ni les
    // inter-branches).
    await this.verifierAccesBranche(utilisateur, existant.brancheType)

    await this.prisma.jourReunion.delete({ where: { id } })

    // Suppression cascade sur tout l'historique de présence de cette réunion
    // (PresenceReunion.onDelete: Cascade) : action sensible à journaliser.
    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'REUNION_SUPPRIMEE',
      entite: 'JourReunion',
      entiteId: id,
      details: { titre: existant.titre, dateHeure: existant.dateHeure, presencesSupprimees: existant._count.presences },
    })

    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Présences
  // ---------------------------------------------------------------------------

  private async reunionPourPresences(utilisateur: UtilisateurSession, id: string) {
    const reunion = await this.prisma.jourReunion.findFirst({ where: { id } })
    if (!reunion) throw new NotFoundException('Réunion introuvable')
    await this.verifierAccesBranche(utilisateur, reunion.brancheType)
    return reunion
  }

  // Feuille de présences : réunion + scouts de la branche + statuts existants
  async feuillePresences(utilisateur: UtilisateurSession, id: string) {
    const reunion = await this.reunionPourPresences(utilisateur, id)

    // Scouts de la branche concernée (ou tous si inter-branches)
    const scoutsBranche = await this.prisma.scout.findMany({
      where: { actif: true, ...(reunion.brancheType ? { brancheType: reunion.brancheType } : {}) },
      select: SELECTION_SCOUT,
    })

    const presences = await this.prisma.presenceReunion.findMany({
      where: { jourReunionId: id },
      select: { scoutId: true, statut: true, note: true, scout: { select: SELECTION_SCOUT } },
    })

    const presencesMap = Object.fromEntries(presences.map((p) => [p.scoutId, { statut: p.statut, note: p.note }]))

    // Un scout ayant changé de branche (ou été désactivé) depuis cette réunion
    // n'apparaît plus dans scoutsBranche (filtré sur sa branche/statut actuels)
    // alors que sa présence pour CETTE réunion existe toujours : on le
    // réintègre dans la liste pour ne jamais faire disparaître une présence
    // déjà enregistrée en consultant/éditant une réunion passée.
    const idsBranche = new Set(scoutsBranche.map((s) => s.id))
    const scoutsHistoriques = presences.filter((p) => !idsBranche.has(p.scoutId)).map((p) => p.scout)

    const scouts = [...scoutsBranche, ...scoutsHistoriques].sort(
      (a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom),
    )

    return { reunion, scouts, presencesMap }
  }

  // Enregistre / met à jour les présences en masse (upsert)
  async enregistrerPresences(utilisateur: UtilisateurSession, id: string, corps: CorpsPresencesReunion) {
    const reunion = await this.reunionPourPresences(utilisateur, id)

    const lignes = corps.presences

    // Seuls les scouts de la branche de la réunion (tous pour une
    // réunion inter-branches), ou déjà pointés sur cette réunion (cf.
    // scoutsHistoriques de la feuille), peuvent être pointés.
    const scoutIds = [...new Set(lignes.map((p) => p.scoutId))]
    const autorises = await this.prisma.scout.findMany({
      where: {
        id: { in: scoutIds },
        OR: [
          reunion.brancheType ? { brancheType: reunion.brancheType } : {},
          { presencesReunion: { some: { jourReunionId: id } } },
        ],
      },
      select: { id: true },
    })
    if (autorises.length !== scoutIds.length) {
      throw new BadRequestException('Certains scouts ne font pas partie de cette réunion')
    }

    await this.prisma.$transaction(
      lignes.map(({ scoutId, statut, note }) =>
        this.prisma.presenceReunion.upsert({
          where: { jourReunionId_scoutId: { jourReunionId: id, scoutId } },
          create: { jourReunionId: id, scoutId, statut, note: note ?? null, marqueParId: utilisateur.id },
          update: { statut, note: note ?? null, marqueParId: utilisateur.id },
        }),
      ),
    )

    // Passer la réunion en TERMINEE si elle ne l'est pas encore
    if (reunion.statut === 'PLANIFIEE' || reunion.statut === 'REPORTEE') {
      await this.prisma.jourReunion.update({ where: { id }, data: { statut: 'TERMINEE' } })
    }

    return { ok: true, count: lignes.length }
  }

  // Export CSV (séparateur point-virgule, BOM UTF-8 pour Excel) de la feuille
  // de présences d'une réunion.
  async exporterPresences(utilisateur: UtilisateurSession, id: string): Promise<ExportCsv> {
    const branche = await this.brancheRequise(utilisateur)

    const reunion = await this.prisma.jourReunion.findFirst({
      where: { id, ...(branche ? { brancheType: branche } : {}) },
    })
    if (!reunion) throw new NotFoundException('Réunion introuvable')

    const scouts = await this.prisma.scout.findMany({
      where: { actif: true, ...(reunion.brancheType ? { brancheType: reunion.brancheType } : {}) },
      select: { id: true, prenom: true, nom: true, brancheType: true, matricule: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    const presences = await this.prisma.presenceReunion.findMany({
      where: { jourReunionId: id },
      select: { scoutId: true, statut: true, note: true },
    })
    const presenceMap = new Map(presences.map((p) => [p.scoutId, p]))

    const dateEffective = reunion.dateReportee ?? reunion.dateHeure
    const dateStr = new Date(dateEffective).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    const brancheLabel = reunion.brancheType
      ? (LABELS_BRANCHES[reunion.brancheType] ?? reunion.brancheType)
      : 'Toutes branches'
    const titre = reunion.titre ?? `Réunion ${brancheLabel}`

    const stats = { present: 0, absent: 0, excuse: 0 }
    const lignes: string[] = []

    for (const scout of scouts) {
      const p = presenceMap.get(scout.id)
      const statut = p?.statut ?? 'ABSENT'
      if (statut === 'PRESENT') stats.present++
      else if (statut === 'EXCUSE') stats.excuse++
      else stats.absent++

      lignes.push(
        [
          champ(scout.nom.toUpperCase()),
          champ(scout.prenom),
          champ(scout.matricule),
          champ(LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType),
          champ(LABELS_STATUT[statut] ?? statut),
          champ(p?.note),
        ].join(';'),
      )
    }

    const total = scouts.length
    const tauxPresence = total > 0 ? Math.round((stats.present / total) * 100) : 0

    const csv = [
      champ(titre),
      champ(`Date : ${dateStr}`),
      champ(`Branche : ${brancheLabel}`),
      `"Présents : ${stats.present} / ${total} (${tauxPresence}%)  |  Excusés : ${stats.excuse}  |  Absents : ${stats.absent}"`,
      '',
      '"Nom";"Prénom";"Matricule";"Branche";"Statut";"Note"',
      ...lignes,
    ].join('\r\n')

    // BOM UTF-8 pour compatibilité Excel
    const bom = '﻿'
    const nomFichier = `presence_${titre.toLowerCase().replace(/[\s/\\:*?"<>|]+/g, '-')}_${new Date(dateEffective).toISOString().slice(0, 10)}.csv`

    return { contenu: bom + csv, contentDisposition: contentDispositionTelechargement(nomFichier) }
  }

  // ---------------------------------------------------------------------------
  // Configuration des réunions hebdomadaires par branche
  // ---------------------------------------------------------------------------

  listerConfigs() {
    return this.prisma.configReunionBranche.findMany({ orderBy: { brancheType: 'asc' } })
  }

  // Corps déjà validé par SchemaConfigReunion (branche, jour, heure).
  async enregistrerConfig(corps: CorpsConfigReunion) {
    const { brancheType, jourSemaine, heureDebut, dureeMinutes, lieu } = corps

    const valeurs = { jourSemaine, heureDebut, dureeMinutes: dureeMinutes ?? 90, lieu: lieu ?? null }
    return this.prisma.configReunionBranche.upsert({
      where: { brancheType },
      create: { brancheType, ...valeurs },
      update: valeurs,
    })
  }
}
