import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { ROLES_BRANCHE, ROLES_TOUT_STAFF } from '@scout/shared'
import { PerimetreService } from '../../common/perimetre.service'
import { genererICS } from '../../common/lib/calendrier'
import { limiterTaux } from '../../common/lib/rateLimit'
import type { UtilisateurSession } from '../../common/types'
import type { BrancheType } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

const FENETRE_PASSEE_JOURS = 30
const FENETRE_FUTURE_JOURS = 180

// Filtre « branche du compte ou tout le groupe » appliqué aux activités et
// réunions (brancheType null = événement commun à toutes les branches).
function conditionBranche(filtreBranche: string | null) {
  return filtreBranche ? { OR: [{ brancheType: filtreBranche as BrancheType }, { brancheType: null }] } : {}
}

@Injectable()
export class CalendrierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  // Événements (activités + réunions) du mois demandé (« YYYY-MM »), pour la
  // vue calendrier du tableau de bord.
  async evenementsDuMois(utilisateur: UtilisateurSession, mois: string | undefined) {
    const reference = mois ? new Date(`${mois}-01T00:00:00.000Z`) : new Date()
    if (isNaN(reference.getTime())) throw new BadRequestException('Paramètre mois invalide')

    const debutMois = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1))
    const finMois = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1))

    let filtreBranche: string | null = null
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      filtreBranche = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que tout le groupe par défaut.
      if (!filtreBranche) return { evenements: [] }
    }

    const condBranche = conditionBranche(filtreBranche)

    const [activites, reunions] = await Promise.all([
      this.prisma.activite.findMany({
        where: { dateDebut: { gte: debutMois, lt: finMois }, ...condBranche },
        select: {
          id: true,
          titre: true,
          description: true,
          dateDebut: true,
          dateFin: true,
          lieu: true,
          type: true,
          brancheType: true,
        },
        orderBy: { dateDebut: 'asc' },
      }),
      this.prisma.jourReunion.findMany({
        where: {
          // Une réunion apparaît à sa date effective (dateReportee si reportée,
          // sinon dateHeure), pas à sa date d'origine — sinon une réunion
          // reportée hors du mois consulté resterait affichée à son ancienne date.
          AND: [
            {
              OR: [
                { dateReportee: null, dateHeure: { gte: debutMois, lt: finMois } },
                { dateReportee: { gte: debutMois, lt: finMois } },
              ],
            },
            condBranche,
          ],
          // Une réunion annulée n'a plus lieu : elle ne doit pas apparaître
          // comme un événement à venir/passé dans le calendrier.
          statut: { not: 'ANNULEE' },
        },
        select: {
          id: true,
          titre: true,
          dateHeure: true,
          dateReportee: true,
          dureeMinutes: true,
          lieu: true,
          statut: true,
          brancheType: true,
          notes: true,
        },
        orderBy: { dateHeure: 'asc' },
      }),
    ])

    const evenements = [
      ...activites.map((a) => ({
        id: a.id,
        source: 'activite' as const,
        titre: a.titre,
        description: a.description,
        debut: a.dateDebut,
        fin: a.dateFin,
        lieu: a.lieu,
        brancheType: a.brancheType,
        meta: a.type,
      })),
      ...reunions.map((r) => {
        const debut = r.dateReportee ?? r.dateHeure
        return {
          id: r.id,
          source: 'reunion' as const,
          titre: r.titre ?? 'Réunion',
          description: r.notes,
          debut,
          fin: r.dureeMinutes ? new Date(debut.getTime() + r.dureeMinutes * 60000) : null,
          lieu: r.lieu,
          brancheType: r.brancheType,
          meta: r.statut,
        }
      }),
    ].sort((a, b) => a.debut.getTime() - b.debut.getTime())

    return { evenements }
  }

  // Flux iCal authentifié par jeton (256 bits, crypto.randomBytes), qui tient
  // lieu de secret : les applications calendrier externes ne peuvent pas
  // s'authentifier de façon interactive.
  async fluxIcs(token: string | undefined, ip: string): Promise<string> {
    if (!token) throw new BadRequestException('Jeton manquant')

    const limite = await limiterTaux(`calendrier-ics:ip:${ip}`, 30, 15 * 60 * 1000)
    if (!limite.autorise) throw new HttpException('Trop de requêtes', HttpStatus.TOO_MANY_REQUESTS)

    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { tokenCalendrier: token },
      select: { id: true, prenom: true, nom: true, role: true, actif: true },
    })
    if (!utilisateur || !utilisateur.actif) throw new NotFoundException('Jeton invalide')
    // Jeton émis uniquement pour la maîtrise (voir genererJeton) : filet de
    // sécurité si un compte ayant perdu son rôle en détenait encore un.
    if (!ROLES_TOUT_STAFF.includes(utilisateur.role)) throw new ForbiddenException('Route réservée à la maîtrise')

    const nomCalendrier = `SCOUT ASCCI — ${utilisateur.prenom} ${utilisateur.nom}`

    let filtreBranche: string | null = null
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      filtreBranche = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // flux vide plutôt que tout le groupe par défaut.
      if (!filtreBranche) return genererICS(nomCalendrier, [])
    }

    const maintenant = new Date()
    const debut = new Date(maintenant.getTime() - FENETRE_PASSEE_JOURS * 86400000)
    const fin = new Date(maintenant.getTime() + FENETRE_FUTURE_JOURS * 86400000)
    const condBranche = conditionBranche(filtreBranche)

    const [activites, reunions] = await Promise.all([
      this.prisma.activite.findMany({
        where: { dateDebut: { gte: debut, lt: fin }, ...condBranche },
        select: { id: true, titre: true, description: true, dateDebut: true, dateFin: true, lieu: true },
      }),
      this.prisma.jourReunion.findMany({
        where: {
          // Cf. evenementsDuMois : une réunion apparaît à sa date effective
          // (dateReportee si reportée), et une réunion annulée est exclue du
          // flux — sinon elle continuerait de s'afficher comme un rendez-vous
          // à honorer dans Google/Apple/Outlook Calendar.
          AND: [
            {
              OR: [
                { dateReportee: null, dateHeure: { gte: debut, lt: fin } },
                { dateReportee: { gte: debut, lt: fin } },
              ],
            },
            condBranche,
          ],
          statut: { not: 'ANNULEE' },
        },
        select: { id: true, titre: true, dateHeure: true, dateReportee: true, dureeMinutes: true, lieu: true, notes: true },
      }),
    ])

    const evenements = [
      ...activites.map((a) => ({
        uid: `activite-${a.id}`,
        debut: a.dateDebut,
        fin: a.dateFin,
        titre: a.titre,
        lieu: a.lieu,
        description: a.description,
      })),
      ...reunions.map((r) => {
        const debutEffectif = r.dateReportee ?? r.dateHeure
        return {
          uid: `reunion-${r.id}`,
          debut: debutEffectif,
          fin: r.dureeMinutes ? new Date(debutEffectif.getTime() + r.dureeMinutes * 60000) : null,
          titre: r.titre ?? 'Réunion',
          lieu: r.lieu,
          description: r.notes,
        }
      }),
    ]

    return genererICS(nomCalendrier, evenements)
  }

  // Génère (si absent) le jeton d'abonnement iCal personnel et renvoie l'URL
  // du flux à ajouter dans une application calendrier externe.
  async genererJeton(utilisateurId: string): Promise<{ url: string }> {
    let utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { tokenCalendrier: true },
    })

    if (!utilisateur?.tokenCalendrier) {
      utilisateur = await this.prisma.utilisateur.update({
        where: { id: utilisateurId },
        data: { tokenCalendrier: randomBytes(32).toString('hex') },
        select: { tokenCalendrier: true },
      })
    }

    return { url: `/api/calendrier/ics?token=${utilisateur.tokenCalendrier}` }
  }

  // Révoque le jeton existant (invalide les abonnements en cours).
  async revoquerJeton(utilisateurId: string): Promise<{ ok: true }> {
    await this.prisma.utilisateur.update({ where: { id: utilisateurId }, data: { tokenCalendrier: null } })
    return { ok: true }
  }
}
