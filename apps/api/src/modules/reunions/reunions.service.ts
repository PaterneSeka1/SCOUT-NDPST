import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  BrancheTypeSchema,
  LABELS_BRANCHES,
  ROLES_BRANCHE,
  StatutPresenceReunionSchema,
  StatutReunionSchema,
} from '@scout/shared'
import type { BrancheType, Prisma, StatutPresenceReunion } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { PerimetreService } from '../../common/perimetre.service'
import { paroisseIdRequise } from '../../common/paroisse'
import { champCsv as champ, contentDispositionTelechargement } from '../../common/lib/csv'
import type { UtilisateurSession } from '../../common/types'

const MAX_REUNIONS_SERIE = 60

const LABELS_STATUT: Record<string, string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  EXCUSE: 'Excusé',
}

const SELECTION_SCOUT = { id: true, prenom: true, nom: true, photo: true, brancheType: true } as const

export interface ExportCsv {
  contenu: string
  contentDisposition: string
}

// Corps JSON attendu sous forme d'objet : toute autre forme est rejetée.
function objetCorps(corps: unknown): Record<string, unknown> {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw new BadRequestException('Données invalides')
  }
  return corps as Record<string, unknown>
}

// Champs texte libres optionnels (titre, lieu, notes) : chaîne, null ou absent.
// Toute autre valeur aurait atteint Prisma et provoqué une erreur 500.
function texteOptionnel(valeur: unknown, message: string): string | null | undefined {
  if (valeur === undefined || valeur === null) return valeur
  if (typeof valeur !== 'string') throw new BadRequestException(message)
  return valeur
}

function entierOptionnel(valeur: unknown, message: string): number | null | undefined {
  if (valeur === undefined || valeur === null) return valeur
  if (typeof valeur !== 'number' || !Number.isInteger(valeur)) throw new BadRequestException(message)
  return valeur
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
    const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
    if (!bt || bt !== brancheReunion) throw new ForbiddenException('Accès refusé à cette réunion')
  }

  // Branche imposée en lecture à un rôle de branche ; compte de branche sans
  // branche assignée : 404.
  private async brancheRequise(utilisateur: UtilisateurSession): Promise<BrancheType | undefined> {
    if (!ROLES_BRANCHE.includes(utilisateur.role)) return undefined
    const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
    if (!bt) throw new NotFoundException('Réunion introuvable')
    return bt as BrancheType
  }

  // ---------------------------------------------------------------------------
  // Liste et création en série
  // ---------------------------------------------------------------------------

  async lister(utilisateur: UtilisateurSession, branche: string | null, statut: string | null) {
    const paroisseId = paroisseIdRequise(utilisateur)

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
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!bt) return []
      filtreBranche = { brancheType: bt as BrancheType }
    } else if (branche) {
      const brancheValide = BrancheTypeSchema.safeParse(branche)
      if (!brancheValide.success) throw new BadRequestException('Branche invalide')
      filtreBranche = { brancheType: brancheValide.data }
    }

    return this.prisma.jourReunion.findMany({
      where: {
        paroisseId,
        ...filtreBranche,
        ...(statut && statutValide.success ? { statut: statutValide.data } : {}),
      },
      include: {
        _count: { select: { presences: true } },
        creeParUtilisateur: { select: { prenom: true, nom: true } },
      },
      orderBy: { dateHeure: 'asc' },
    })
  }

  async creer(utilisateur: UtilisateurSession, corpsBrut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const { dates, brancheType, titre, lieu, dureeMinutes, notes } = objetCorps(corpsBrut)

    if (!Array.isArray(dates) || !dates.length) throw new BadRequestException('Au moins une date est requise')
    if (dates.length > MAX_REUNIONS_SERIE) {
      throw new BadRequestException('Maximum 60 réunions par création en série')
    }
    const datesObj = dates.map((d: unknown) => (typeof d === 'string' ? new Date(d) : new Date(NaN)))
    if (datesObj.some((d) => Number.isNaN(d.getTime()))) {
      throw new BadRequestException('Une ou plusieurs dates sont invalides')
    }
    const brancheValide = BrancheTypeSchema.safeParse(brancheType)
    if (brancheType != null && !brancheValide.success) throw new BadRequestException('Branche invalide')

    const titreValide = texteOptionnel(titre, 'Le titre est invalide')
    const lieuValide = texteOptionnel(lieu, 'Le lieu est invalide')
    const notesValides = texteOptionnel(notes, 'Les notes sont invalides')
    const dureeValide = entierOptionnel(dureeMinutes, 'La durée est invalide')

    // Un chef de branche ne peut créer que pour sa propre branche
    let brancheEffective: BrancheType | null = brancheValide.success ? brancheValide.data : null
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      brancheEffective = bt as BrancheType
    }

    return this.prisma.$transaction(
      datesObj.map((d) =>
        this.prisma.jourReunion.create({
          data: {
            paroisseId,
            creePar: utilisateur.id,
            dateHeure: d,
            brancheType: brancheEffective,
            titre: titreValide ?? null,
            lieu: lieuValide ?? null,
            dureeMinutes: dureeValide ?? null,
            notes: notesValides ?? null,
          },
        }),
      ),
    )
  }

  // ---------------------------------------------------------------------------
  // Détail, modification, suppression
  // ---------------------------------------------------------------------------

  async detail(utilisateur: UtilisateurSession, id: string) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const branche = await this.brancheRequise(utilisateur)

    const reunion = await this.prisma.jourReunion.findFirst({
      where: { id, paroisseId, ...(branche ? { brancheType: branche } : {}) },
      include: {
        creeParUtilisateur: { select: { prenom: true, nom: true } },
        _count: { select: { presences: true } },
        presences: { include: { scout: { select: SELECTION_SCOUT } } },
      },
    })
    if (!reunion) throw new NotFoundException('Réunion introuvable')
    return reunion
  }

  async modifier(utilisateur: UtilisateurSession, id: string, corpsBrut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const { statut, dateReportee, dateHeure, brancheType, titre, lieu, dureeMinutes, notes } = objetCorps(corpsBrut)

    const existant = await this.prisma.jourReunion.findFirst({ where: { id, paroisseId } })
    if (!existant) throw new NotFoundException('Réunion introuvable')

    // Un chef de branche ne peut modifier que les réunions de sa propre branche
    await this.verifierAccesBranche(utilisateur, existant.brancheType)

    const statutValide = StatutReunionSchema.safeParse(statut)
    if (statut !== undefined && !statutValide.success) throw new BadRequestException('Statut invalide')
    const brancheValide = BrancheTypeSchema.safeParse(brancheType)
    if (brancheType != null && !brancheValide.success) throw new BadRequestException('Branche invalide')
    const brancheFinale: BrancheType | null = brancheValide.success ? brancheValide.data : null

    // Un chef de branche ne peut pas déplacer une réunion vers une autre branche
    // (ni la rendre inter-branches) : cf. PUT /activites/:id.
    if (ROLES_BRANCHE.includes(utilisateur.role) && brancheType !== undefined && brancheFinale !== existant.brancheType) {
      throw new ForbiddenException('Le changement de branche est réservé au groupe')
    }

    if (statut === 'REPORTEE' && !dateReportee) {
      throw new BadRequestException('La nouvelle date est requise pour reporter une réunion')
    }

    const dateReporteeFinale = typeof dateReportee === 'string' && dateReportee ? new Date(dateReportee) : null
    if (
      (dateReportee && typeof dateReportee !== 'string') ||
      (dateReporteeFinale && Number.isNaN(dateReporteeFinale.getTime()))
    ) {
      throw new BadRequestException('La date de report est invalide')
    }
    const dateHeureFinale = typeof dateHeure === 'string' ? new Date(dateHeure) : undefined
    if (dateHeure !== undefined && (!dateHeureFinale || Number.isNaN(dateHeureFinale.getTime()))) {
      throw new BadRequestException('La date de la réunion est invalide')
    }

    const titreValide = texteOptionnel(titre, 'Le titre est invalide')
    const lieuValide = texteOptionnel(lieu, 'Le lieu est invalide')
    const notesValides = texteOptionnel(notes, 'Les notes sont invalides')
    const dureeValide = entierOptionnel(dureeMinutes, 'La durée est invalide')

    return this.prisma.jourReunion.update({
      where: { id },
      data: {
        ...(statut !== undefined && statutValide.success ? { statut: statutValide.data } : {}),
        ...(dateReportee !== undefined ? { dateReportee: dateReporteeFinale } : {}),
        ...(dateHeureFinale ? { dateHeure: dateHeureFinale } : {}),
        ...(brancheType !== undefined ? { brancheType: brancheFinale } : {}),
        ...(titreValide !== undefined ? { titre: titreValide } : {}),
        ...(lieuValide !== undefined ? { lieu: lieuValide } : {}),
        ...(dureeValide !== undefined ? { dureeMinutes: dureeValide } : {}),
        ...(notesValides !== undefined ? { notes: notesValides } : {}),
      },
    })
  }

  async supprimer(utilisateur: UtilisateurSession, id: string) {
    const paroisseId = paroisseIdRequise(utilisateur)

    const existant = await this.prisma.jourReunion.findFirst({
      where: { id, paroisseId },
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
      paroisseId,
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

  private async reunionPourPresences(utilisateur: UtilisateurSession, paroisseId: string, id: string) {
    const reunion = await this.prisma.jourReunion.findFirst({ where: { id, paroisseId } })
    if (!reunion) throw new NotFoundException('Réunion introuvable')
    await this.verifierAccesBranche(utilisateur, reunion.brancheType)
    return reunion
  }

  // Feuille de présences : réunion + scouts de la branche + statuts existants
  async feuillePresences(utilisateur: UtilisateurSession, id: string) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const reunion = await this.reunionPourPresences(utilisateur, paroisseId, id)

    // Scouts de la branche concernée (ou tous si inter-branches)
    const scoutsBranche = await this.prisma.scout.findMany({
      where: { paroisseId, actif: true, ...(reunion.brancheType ? { brancheType: reunion.brancheType } : {}) },
      select: SELECTION_SCOUT,
    })

    const presences = await this.prisma.presenceReunion.findMany({
      // Filtre paroisse en défense en profondeur : scoutsHistoriques ne doit
      // jamais exposer un scout d'une autre paroisse.
      where: { jourReunionId: id, scout: { paroisseId } },
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
  async enregistrerPresences(utilisateur: UtilisateurSession, id: string, corpsBrut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const reunion = await this.reunionPourPresences(utilisateur, paroisseId, id)

    const { presences } = objetCorps(corpsBrut)
    if (!Array.isArray(presences)) throw new BadRequestException('Format invalide')
    if (
      presences.some((p: unknown) => {
        if (typeof p !== 'object' || p === null) return true
        const { scoutId, note } = p as Record<string, unknown>
        return typeof scoutId !== 'string' || !scoutId || (note != null && typeof note !== 'string')
      })
    ) {
      throw new BadRequestException('Format invalide')
    }
    const lignes = presences as Array<{ scoutId: string; statut: unknown; note?: string | null }>
    if (lignes.some((p) => !StatutPresenceReunionSchema.safeParse(p.statut).success)) {
      throw new BadRequestException('Statut de présence invalide')
    }

    // Seuls les scouts de la paroisse de la branche de la réunion (tous pour une
    // réunion inter-branches), ou déjà pointés sur cette réunion (cf.
    // scoutsHistoriques de la feuille), peuvent être pointés.
    const scoutIds = [...new Set(lignes.map((p) => p.scoutId))]
    const autorises = await this.prisma.scout.findMany({
      where: {
        id: { in: scoutIds },
        paroisseId,
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
      lignes.map(({ scoutId, statut, note }) => {
        const statutPresence = statut as StatutPresenceReunion
        return this.prisma.presenceReunion.upsert({
          where: { jourReunionId_scoutId: { jourReunionId: id, scoutId } },
          create: { jourReunionId: id, scoutId, statut: statutPresence, note: note ?? null, marqueParId: utilisateur.id },
          update: { statut: statutPresence, note: note ?? null, marqueParId: utilisateur.id },
        })
      }),
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
    const paroisseId = paroisseIdRequise(utilisateur)
    const branche = await this.brancheRequise(utilisateur)

    const reunion = await this.prisma.jourReunion.findFirst({
      where: { id, paroisseId, ...(branche ? { brancheType: branche } : {}) },
    })
    if (!reunion) throw new NotFoundException('Réunion introuvable')

    const scouts = await this.prisma.scout.findMany({
      where: { paroisseId, actif: true, ...(reunion.brancheType ? { brancheType: reunion.brancheType } : {}) },
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

  listerConfigs(utilisateur: UtilisateurSession) {
    const paroisseId = paroisseIdRequise(utilisateur)
    return this.prisma.configReunionBranche.findMany({ where: { paroisseId }, orderBy: { brancheType: 'asc' } })
  }

  async enregistrerConfig(utilisateur: UtilisateurSession, corpsBrut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const { brancheType, jourSemaine, heureDebut, dureeMinutes, lieu } = objetCorps(corpsBrut)

    if (!brancheType || jourSemaine === undefined || !heureDebut) {
      throw new BadRequestException('Champs requis manquants')
    }
    const brancheValide = BrancheTypeSchema.safeParse(brancheType)
    if (!brancheValide.success) throw new BadRequestException('Branche invalide')
    if (typeof jourSemaine !== 'number' || !Number.isInteger(jourSemaine) || jourSemaine < 0 || jourSemaine > 6) {
      throw new BadRequestException('jourSemaine doit être compris entre 0 (dimanche) et 6 (samedi)')
    }
    if (typeof heureDebut !== 'string') throw new BadRequestException("L'heure de début est invalide")
    const dureeValide = entierOptionnel(dureeMinutes, 'La durée est invalide')
    const lieuValide = texteOptionnel(lieu, 'Le lieu est invalide')

    const valeurs = { jourSemaine, heureDebut, dureeMinutes: dureeValide ?? 90, lieu: lieuValide ?? null }
    return this.prisma.configReunionBranche.upsert({
      where: { paroisseId_brancheType: { paroisseId, brancheType: brancheValide.data } },
      create: { paroisseId, brancheType: brancheValide.data, ...valeurs },
      update: valeurs,
    })
  }
}
