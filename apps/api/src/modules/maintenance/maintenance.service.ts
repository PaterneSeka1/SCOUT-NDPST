import { Injectable } from '@nestjs/common'
import { AccesFichiersService } from '../../common/acces-fichiers.service'
import { AuditService } from '../../common/audit.service'
import { logger } from '../../common/lib/logger'
import { env } from '../../config/env'
import { PrismaService } from '../../prisma/prisma.service'

const JOUR_MS = 24 * 60 * 60 * 1000

// Délai de grâce avant suppression : une session ou un lien expiré reste
// quelques jours en base pour l'investigation d'un incident récent.
const GRACE_JOURS = 7

// Nombre maximal de scouts anonymisés par passage : la tâche quotidienne
// reste courte, le reliquat est traité les jours suivants.
const LOT_ANONYMISATION = 200

export interface ResultatPurge {
  sessions: number
  jetonsReinitialisation: number
  journalAudit: number | null
  scoutsAnonymises: number | null
}

// Minimisation des données (loi n° 2013-450), tâche quotidienne :
//   - toujours : sessions et liens de réinitialisation expirés ;
//   - si RETENTION_AUDIT_JOURS est défini : entrées du journal d'audit plus
//     anciennes que cette durée ;
//   - si ANONYMISATION_SCOUTS_INACTIFS_JOURS est défini : scouts inactifs
//     depuis plus longtemps, anonymisés (voir anonymiserScout).
// Les deux durées relèvent d'une décision de l'association : sans elles,
// aucune donnée métier n'est supprimée (null dans le résultat).
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fichiers: AccesFichiersService,
    private readonly audit: AuditService,
  ) {}

  async purger(maintenant = new Date()): Promise<ResultatPurge> {
    const limite = new Date(maintenant.getTime() - GRACE_JOURS * JOUR_MS)
    const { RETENTION_AUDIT_JOURS, ANONYMISATION_SCOUTS_INACTIFS_JOURS } = env()

    const sessions = await this.prisma.sessionUtilisateur.deleteMany({ where: { expireLe: { lt: limite } } })
    const jetons = await this.prisma.tokenReinitialisation.deleteMany({ where: { expiresAt: { lt: limite } } })

    let journalAudit: number | null = null
    if (RETENTION_AUDIT_JOURS) {
      const avant = new Date(maintenant.getTime() - RETENTION_AUDIT_JOURS * JOUR_MS)
      journalAudit = (
        await this.prisma.journalAudit.deleteMany({
          where: { createdAt: { lt: avant }, entite: { not: 'AdhesionNationale' } },
        })
      ).count
    }

    let scoutsAnonymises: number | null = null
    if (ANONYMISATION_SCOUTS_INACTIFS_JOURS) {
      const avant = new Date(maintenant.getTime() - ANONYMISATION_SCOUTS_INACTIFS_JOURS * JOUR_MS)
      const scouts = await this.prisma.scout.findMany({
        where: { actif: false, anonymiseLe: null, desactiveLe: { lt: avant } },
        select: { id: true },
        take: LOT_ANONYMISATION,
      })
      for (const { id } of scouts) await this.anonymiserScout(id, maintenant)
      scoutsAnonymises = scouts.length
    }

    const resultat = { sessions: sessions.count, jetonsReinitialisation: jetons.count, journalAudit, scoutsAnonymises }
    logger.info('cron.purge', { ...resultat })
    return resultat
  }

  // Anonymisation d'un scout inactif : tout ce qui identifie l'enfant ou
  // concerne sa santé disparaît (identité, matricule, photo, données
  // médicales, contacts, liens parents, documents et leurs fichiers). Restent
  // les données nécessaires aux statistiques du groupe : branche, sexe,
  // année de naissance, présences, progressions et cotisations, sans
  // commentaire libre.
  private async anonymiserScout(scoutId: string, maintenant: Date): Promise<void> {
    const scout = await this.prisma.scout.findUnique({
      where: { id: scoutId },
      select: {
        dateNaissance: true,
        photo: true,
        documents: { select: { url: true } },
        autorisationsCamp: { where: { documentUrl: { not: null } }, select: { documentUrl: true } },
      },
    })
    if (!scout) return

    await this.prisma.$transaction([
      this.prisma.document.deleteMany({ where: { scoutId } }),
      this.prisma.contactUrgence.deleteMany({ where: { scoutId } }),
      this.prisma.lienParentScout.deleteMany({ where: { scoutId } }),
      this.prisma.autorisationCamp.updateMany({
        where: { scoutId },
        data: { documentUrl: null, documentNomFichier: null },
      }),
      this.prisma.presence.updateMany({ where: { scoutId }, data: { commentaire: null } }),
      this.prisma.progressionScout.updateMany({ where: { scoutId }, data: { commentaire: null } }),
      this.prisma.cotisation.updateMany({ where: { scoutId }, data: { notes: null } }),
      this.prisma.scout.update({
        where: { id: scoutId },
        data: {
          nom: 'Anonyme',
          prenom: 'Anonyme',
          dateNaissance: new Date(Date.UTC(scout.dateNaissance.getUTCFullYear(), 0, 1)),
          matricule: null,
          photo: null,
          allergies: null,
          traitementsMedicaux: null,
          consentementImage: false,
          consentementImageDate: null,
          consentementImageParId: null,
          consentementImageOrigine: 'RETIRE',
          consentementSante: false,
          consentementSanteDate: null,
          consentementSanteParId: null,
          consentementSanteOrigine: 'RETIRE',
          utilisateurId: null,
          anonymiseLe: maintenant,
        },
      }),
    ])

    const urls = [
      scout.photo,
      ...scout.documents.map((d) => d.url),
      ...scout.autorisationsCamp.map((a) => a.documentUrl),
    ]
    for (const url of urls) await this.fichiers.supprimerSiOrphelin(url)

    await this.audit.enregistrer({
      acteurId: null,
      action: 'SCOUT_ANONYMISE',
      entite: 'Scout',
      entiteId: scoutId,
    })
  }
}
