import { Injectable } from '@nestjs/common'
import { ORDRE_CATEGORIES_SCOUTS, ROLES_BRANCHE, ROLES_TOUT_STAFF, anneeScolaireCourante } from '@scout/shared'
import type { BrancheType, Prisma, RoleUtilisateur } from '../../generated/prisma/client'
import { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import { utiliseStockageExterne } from '../../common/lib/storage'
import { PrismaService } from '../../prisma/prisma.service'

const JOUR_MS = 86400000

export type ProfilTableauDeBord = 'ADMIN' | 'DIRECTION' | 'EQUIPE_GROUPE' | 'BRANCHE' | 'FAMILLE'

export interface Indicateur {
  cle: string
  libelle: string
  valeur: number | string
  detail?: string
}

export interface Alerte {
  niveau: 'info' | 'attention' | 'critique'
  message: string
  lien?: string
}

export interface ActionRapide {
  libelle: string
  lien: string
  nombre?: number
}

const SELECTION_ACTIVITE = {
  id: true,
  titre: true,
  dateDebut: true,
  dateFin: true,
  type: true,
  brancheType: true,
  lieu: true,
  statut: true,
} as const

const SELECTION_REUNION = {
  id: true,
  titre: true,
  dateHeure: true,
  brancheType: true,
  lieu: true,
  statut: true,
} as const

function pourcentage(numerateur: number, denominateur: number): number {
  return denominateur > 0 ? Math.round((numerateur / denominateur) * 100) : 0
}

function finDeMois(annee: number, mois: number): Date {
  return new Date(annee, mois + 1, 0, 23, 59, 59, 999)
}

// Filtre « branche ou toutes branches » des activités et réunions.
function brancheOuToutes(brancheType?: BrancheType) {
  return brancheType ? { OR: [{ brancheType }, { brancheType: null }] } : {}
}

// Indicateurs des tableaux de bord, calculés exclusivement à partir de la
// base et limités au périmètre du rôle (contrôlé par le contrôleur).
@Injectable()
export class IndicateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  async tableauDeBord(utilisateur: UtilisateurSession) {
    if (utilisateur.role === 'ADMINISTRATEUR') return this.administration()
    if (utilisateur.role === 'CHEF_GROUPE') return this.direction()
    if (['ADJOINT_GROUPE', 'ASSISTANT_GROUPE'].includes(utilisateur.role)) return this.equipeGroupe()
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const branche = (await this.perimetre.brancheUtilisateur(utilisateur.id)) as BrancheType | null
      return this.branche(branche)
    }
    return this.famille(utilisateur)
  }

  // --- Administrateur ---------------------------------------------------------

  private async administration() {
    const [comptesParRole, comptesInactifs, demandesNouvelles, brouillons, publiees, photosSansConsentement, journal] =
      await Promise.all([
        this.prisma.utilisateur.groupBy({ by: ['role'], where: { actif: true }, _count: { _all: true } }),
        this.prisma.utilisateur.count({ where: { actif: false } }),
        this.prisma.demandeAdhesion.count({ where: { statut: 'NOUVELLE' } }),
        this.prisma.publication.count({ where: { statut: 'BROUILLON' } }),
        this.prisma.publication.count({ where: { statut: 'PUBLIEE' } }),
        this.prisma.media.count({ where: { contientMineurs: true, consentementVerifie: false } }),
        this.prisma.journalAudit.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            action: true,
            entite: true,
            createdAt: true,
            acteur: { select: { prenom: true, nom: true } },
          },
        }),
      ])
    const comptesActifs = comptesParRole.reduce((s, r) => s + r._count._all, 0)
    const administrateurs = comptesParRole.find((r) => r.role === 'ADMINISTRATEUR')?._count._all ?? 0

    const alertes: Alerte[] = []
    if (administrateurs < 2) {
      alertes.push({
        niveau: 'attention',
        message: 'Un seul administrateur actif : prévoyez un second compte de secours.',
        lien: '/admin/utilisateurs',
      })
    }
    if (photosSansConsentement > 0) {
      alertes.push({
        niveau: 'info',
        message: `${photosSansConsentement} photo(s) de la galerie attendent la vérification des consentements.`,
        lien: '/admin/galerie',
      })
    }

    return {
      profil: 'ADMIN' as ProfilTableauDeBord,
      indicateurs: [
        { cle: 'comptes', libelle: 'Comptes actifs', valeur: comptesActifs, detail: `${comptesInactifs} désactivé(s)` },
        { cle: 'demandes', libelle: "Demandes d'adhésion nouvelles", valeur: demandesNouvelles },
        { cle: 'publications', libelle: 'Articles publiés', valeur: publiees, detail: `${brouillons} brouillon(s)` },
        { cle: 'photos', libelle: 'Photos à vérifier', valeur: photosSansConsentement },
      ] satisfies Indicateur[],
      comptesParRole: comptesParRole.map((r) => ({ role: r.role, nombre: r._count._all })),
      journal,
      services: await this.etatServices(),
      alertes,
      actions: [
        { libelle: 'Créer un compte', lien: '/admin/utilisateurs/nouveau' },
        { libelle: 'Rédiger un article', lien: '/admin/publications/nouveau' },
        { libelle: 'Traiter les demandes', lien: '/admin/demandes', nombre: demandesNouvelles },
        { libelle: 'Identité et configuration', lien: '/admin/configuration' },
      ] satisfies ActionRapide[],
    }
  }

  private async etatServices() {
    let baseDeDonnees = true
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      baseDeDonnees = false
    }
    return {
      baseDeDonnees,
      stockage: utiliseStockageExterne() ? 'externe' : 'local',
      email: !!process.env.SMTP_HOST,
    }
  }

  // --- Chef de groupe -------------------------------------------------------

  private async direction() {
    const annee = anneeScolaireCourante(new Date())
    const [repartition, maitrise, activites, presences, cotisations, evolution, alertes, demandes] = await Promise.all([
      this.repartitionBranches(),
      this.prisma.utilisateur.count({ where: { actif: true, role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] } } }),
      this.activitesAVenir(),
      this.presencesRecentes(),
      this.syntheseCotisations(annee),
      this.evolutionEffectifs(),
      this.alertes(),
      this.prisma.demandeAdhesion.count({ where: { statut: 'NOUVELLE' } }),
    ])
    const effectif = repartition.reduce((s, b) => s + b.effectif, 0)
    const tauxPresence = pourcentage(
      presences.reduce((s, r) => s + r.presents, 0),
      presences.reduce((s, r) => s + r.total, 0),
    )
    if (demandes > 0) {
      alertes.unshift({ niveau: 'info', message: `${demandes} demande(s) d'adhésion à traiter.`, lien: '/admin/demandes' })
    }
    return {
      profil: 'DIRECTION' as ProfilTableauDeBord,
      indicateurs: [
        { cle: 'effectif', libelle: 'Scouts actifs', valeur: effectif },
        { cle: 'maitrise', libelle: 'Membres de la maîtrise', valeur: maitrise },
        { cle: 'presence', libelle: 'Présence aux réunions (30 j)', valeur: `${tauxPresence} %` },
        {
          cle: 'cotisations',
          libelle: `Cotisations ${annee}`,
          valeur: `${pourcentage(cotisations.aJour, cotisations.total)} %`,
          detail: `${cotisations.aJour} / ${cotisations.total} à jour`,
        },
      ] satisfies Indicateur[],
      repartitionBranches: repartition,
      evolutionEffectifs: evolution,
      activitesAVenir: activites,
      presencesRecentes: presences,
      cotisations,
      alertes,
      actions: [
        { libelle: 'Inscrire un scout', lien: '/dashboard/scouts/nouveau' },
        { libelle: 'Programmer une activité', lien: '/dashboard/activites/nouvelle' },
        { libelle: 'Planifier une réunion', lien: '/dashboard/reunions/nouveau' },
        { libelle: "Demandes d'adhésion", lien: '/admin/demandes', nombre: demandes },
      ] satisfies ActionRapide[],
    }
  }

  // --- Adjoints et assistants de groupe ---------------------------------------

  private async equipeGroupe() {
    const [repartition, activites, reunions, presences, alertes, feuilles, demandes, enCours] = await Promise.all([
      this.repartitionBranches(),
      this.activitesAVenir(),
      this.reunionsAVenir(),
      this.presencesRecentes(),
      this.alertes(),
      this.feuillesAPointer(),
      this.prisma.demandeAdhesion.count({ where: { statut: 'NOUVELLE' } }),
      this.prisma.activite.count({ where: { statut: 'EN_COURS' } }),
    ])
    const effectif = repartition.reduce((s, b) => s + b.effectif, 0)
    return {
      profil: 'EQUIPE_GROUPE' as ProfilTableauDeBord,
      indicateurs: [
        { cle: 'effectif', libelle: 'Scouts actifs', valeur: effectif },
        { cle: 'enCours', libelle: 'Activités en cours', valeur: enCours },
        { cle: 'reunions', libelle: 'Réunions à venir', valeur: reunions.length },
        { cle: 'feuilles', libelle: 'Feuilles de présence à compléter', valeur: feuilles },
      ] satisfies Indicateur[],
      repartitionBranches: repartition,
      activitesAVenir: activites,
      reunionsAVenir: reunions,
      presencesRecentes: presences,
      alertes,
      actions: [
        { libelle: 'Pointer les présences', lien: '/dashboard/reunions', nombre: feuilles },
        { libelle: 'Calendrier', lien: '/dashboard/calendrier' },
        { libelle: "Demandes d'adhésion", lien: '/admin/demandes', nombre: demandes },
      ] satisfies ActionRapide[],
    }
  }

  // --- Encadrement de branche -------------------------------------------------

  private async branche(brancheType: BrancheType | null) {
    if (!brancheType) {
      return {
        profil: 'BRANCHE' as ProfilTableauDeBord,
        brancheType: null,
        indicateurs: [] as Indicateur[],
        alertes: [
          { niveau: 'attention', message: "Aucune branche n'est associée à votre compte. Contactez le Chef de Groupe." },
        ] satisfies Alerte[],
        actions: [] as ActionRapide[],
      }
    }
    const il90jours = new Date(Date.now() - 90 * JOUR_MS)
    const [actifs, inactifs, activites, reunions, presences, etapes, alertes, feuilles] = await Promise.all([
      this.prisma.scout.count({ where: { actif: true, brancheType } }),
      this.prisma.scout.count({ where: { actif: false, anonymiseLe: null, brancheType } }),
      this.activitesAVenir(brancheType),
      this.reunionsAVenir(brancheType),
      this.presencesRecentes(brancheType),
      this.prisma.progressionScout.count({ where: { scout: { brancheType }, dateValidation: { gte: il90jours } } }),
      this.alertes(brancheType),
      this.feuillesAPointer(brancheType),
    ])
    const tauxPresence = pourcentage(
      presences.reduce((s, r) => s + r.presents, 0),
      presences.reduce((s, r) => s + r.total, 0),
    )
    return {
      profil: 'BRANCHE' as ProfilTableauDeBord,
      brancheType,
      indicateurs: [
        { cle: 'effectif', libelle: 'Scouts actifs de la branche', valeur: actifs, detail: `${inactifs} inactif(s)` },
        { cle: 'presence', libelle: 'Présence aux réunions (30 j)', valeur: `${tauxPresence} %` },
        { cle: 'progression', libelle: 'Étapes validées (90 j)', valeur: etapes },
        { cle: 'feuilles', libelle: 'Feuilles de présence à compléter', valeur: feuilles },
      ] satisfies Indicateur[],
      activitesAVenir: activites,
      reunionsAVenir: reunions,
      presencesRecentes: presences,
      alertes,
      actions: [
        { libelle: 'Pointer les présences', lien: '/dashboard/reunions', nombre: feuilles },
        { libelle: 'Ma branche', lien: '/dashboard/ma-branche' },
        { libelle: 'Valider une progression', lien: '/dashboard/progression' },
        { libelle: 'Inscrire un scout', lien: '/dashboard/scouts/nouveau' },
      ] satisfies ActionRapide[],
    }
  }

  // --- Parents et scouts (espaces non ouverts par défaut) --------------------

  private async famille(utilisateur: UtilisateurSession) {
    const indicateurs: Indicateur[] = []
    if (utilisateur.role === 'PARENT') {
      indicateurs.push({
        cle: 'enfants',
        libelle: 'Mes enfants',
        valeur: await this.prisma.lienParentScout.count({ where: { parentId: utilisateur.id } }),
      })
    } else if (utilisateur.role === 'SCOUT') {
      const fiche = await this.prisma.scout.findFirst({ where: { utilisateurId: utilisateur.id }, select: { id: true } })
      if (fiche) {
        indicateurs.push({
          cle: 'progression',
          libelle: 'Étapes validées',
          valeur: await this.prisma.progressionScout.count({ where: { scoutId: fiche.id } }),
        })
      }
    }
    return {
      profil: 'FAMILLE' as ProfilTableauDeBord,
      indicateurs,
      activitesAVenir: await this.prisma.activite.findMany({
        where: { publique: true, statut: { not: 'ANNULEE' }, dateDebut: { gte: new Date() } },
        orderBy: { dateDebut: 'asc' },
        take: 5,
        select: SELECTION_ACTIVITE,
      }),
      alertes: [] as Alerte[],
      actions: [] as ActionRapide[],
    }
  }

  // --- Briques ---------------------------------------------------------------

  private async repartitionBranches() {
    const groupes = await this.prisma.scout.groupBy({ by: ['brancheType'], where: { actif: true }, _count: { _all: true } })
    return ORDRE_CATEGORIES_SCOUTS.map((brancheType) => ({
      brancheType,
      effectif: groupes.find((g) => g.brancheType === brancheType)?._count._all ?? 0,
    }))
  }

  // Effectif actif à la fin de chacun des 12 derniers mois : inscrit avant la
  // date et pas encore désactivé à cette date.
  private evolutionEffectifs() {
    const maintenant = new Date()
    return Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const reference = new Date(maintenant.getFullYear(), maintenant.getMonth() - (11 - i), 1)
        const fin = i === 11 ? maintenant : finDeMois(reference.getFullYear(), reference.getMonth())
        return this.prisma.scout
          .count({
            where: {
              createdAt: { lte: fin },
              anonymiseLe: null,
              OR: [{ desactiveLe: null }, { desactiveLe: { gt: fin } }],
            },
          })
          .then((effectif) => ({
            mois: `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, '0')}`,
            effectif,
          }))
      }),
    )
  }

  private activitesAVenir(brancheType?: BrancheType) {
    const maintenant = new Date()
    return this.prisma.activite.findMany({
      where: {
        statut: { in: ['PREVUE', 'EN_COURS'] },
        AND: [{ OR: [{ dateDebut: { gte: maintenant } }, { dateFin: { gte: maintenant } }] }, brancheOuToutes(brancheType)],
      },
      orderBy: { dateDebut: 'asc' },
      take: 5,
      select: SELECTION_ACTIVITE,
    })
  }

  private reunionsAVenir(brancheType?: BrancheType) {
    return this.prisma.jourReunion.findMany({
      where: {
        statut: { in: ['PLANIFIEE', 'REPORTEE'] },
        dateHeure: { gte: new Date(Date.now() - JOUR_MS) },
        ...brancheOuToutes(brancheType),
      },
      orderBy: { dateHeure: 'asc' },
      take: 5,
      select: SELECTION_REUNION,
    })
  }

  // Réunions des 30 derniers jours ayant une feuille de présence (limitée aux
  // scouts de la branche pour l'encadrement de branche).
  private async presencesRecentes(brancheType?: BrancheType) {
    const il30jours = new Date(Date.now() - 30 * JOUR_MS)
    const filtreScout: Prisma.PresenceReunionWhereInput = brancheType ? { scout: { brancheType } } : {}
    const reunions = await this.prisma.jourReunion.findMany({
      where: {
        dateHeure: { gte: il30jours, lte: new Date() },
        statut: { not: 'ANNULEE' },
        presences: { some: filtreScout },
        ...brancheOuToutes(brancheType),
      },
      orderBy: { dateHeure: 'desc' },
      take: 6,
      select: {
        ...SELECTION_REUNION,
        _count: { select: { presences: { where: filtreScout } } },
        presences: { where: { ...filtreScout, statut: 'PRESENT' }, select: { id: true } },
      },
    })
    return reunions.map(({ presences, _count, ...r }) => ({ ...r, presents: presences.length, total: _count.presences }))
  }

  // Réunions passées encore « planifiées » : la feuille n'a pas été clôturée.
  private feuillesAPointer(brancheType?: BrancheType) {
    return this.prisma.jourReunion.count({
      where: { statut: 'PLANIFIEE', dateHeure: { lt: new Date() }, ...brancheOuToutes(brancheType) },
    })
  }

  private async syntheseCotisations(anneeScolaire: string) {
    const [parStatut, scoutsActifs] = await Promise.all([
      this.prisma.cotisation.groupBy({
        by: ['statut'],
        where: { anneeScolaire, type: 'ADHESION_ANNUELLE', scout: { actif: true } },
        _sum: { montant: true, montantPaye: true },
        _count: { _all: true },
      }),
      this.prisma.scout.count({ where: { actif: true } }),
    ])
    const somme = (cle: 'montant' | 'montantPaye') => parStatut.reduce((s, g) => s + (g._sum[cle] ?? 0), 0)
    const aJour = parStatut
      .filter((g) => g.statut === 'PAYEE' || g.statut === 'EXONEREE')
      .reduce((s, g) => s + g._count._all, 0)
    return { anneeScolaire, montantDu: somme('montant'), montantPaye: somme('montantPaye'), aJour, total: scoutsActifs }
  }

  private async alertes(brancheType?: BrancheType): Promise<Alerte[]> {
    const scout: Prisma.ScoutWhereInput = { actif: true, ...(brancheType ? { brancheType } : {}) }
    const [sansContact, sansConsentementSante, documentsExpires] = await Promise.all([
      this.prisma.scout.count({ where: { ...scout, contactsUrgence: { none: {} } } }),
      this.prisma.scout.count({
        where: { ...scout, consentementSante: false, OR: [{ allergies: { not: null } }, { traitementsMedicaux: { not: null } }] },
      }),
      this.prisma.document.count({ where: { scout, dateExpiration: { lt: new Date() } } }),
    ])
    const alertes: Alerte[] = []
    if (sansContact > 0) {
      alertes.push({ niveau: 'critique', message: `${sansContact} scout(s) sans contact d'urgence.`, lien: '/dashboard/scouts' })
    }
    if (documentsExpires > 0) {
      alertes.push({ niveau: 'attention', message: `${documentsExpires} document(s) expiré(s).`, lien: '/dashboard/documents' })
    }
    if (sansConsentementSante > 0) {
      alertes.push({
        niveau: 'attention',
        message: `${sansConsentementSante} fiche(s) santé renseignée(s) sans consentement enregistré.`,
        lien: '/dashboard/scouts',
      })
    }
    return alertes
  }

  // --- Rapport d'activité (direction du groupe) -------------------------------

  async rapport() {
    const maintenant = new Date()
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
    // Un rapport est rétrospectif : rien de futur n'y est compté.
    const periode6mois = { gte: new Date(Date.now() - 180 * JOUR_MS), lte: maintenant }

    const [scoutsParBranche, scoutsActifs, scoutsInactifs, activitesMois, activites6mois, reunionsMois, dernieresReunions] =
      await Promise.all([
        this.prisma.scout.groupBy({ by: ['brancheType'], where: { anonymiseLe: null }, _count: { id: true } }),
        this.prisma.scout.count({ where: { actif: true } }),
        this.prisma.scout.count({ where: { actif: false, anonymiseLe: null } }),
        this.prisma.activite.count({ where: { dateDebut: { gte: debutMois, lte: maintenant } } }),
        this.prisma.activite.findMany({
          where: { dateDebut: periode6mois },
          select: {
            id: true,
            titre: true,
            dateDebut: true,
            type: true,
            brancheType: true,
            statut: true,
            _count: { select: { presences: true } },
            presences: { where: { present: true }, select: { id: true } },
          },
          orderBy: { dateDebut: 'desc' },
          take: 10,
        }),
        this.prisma.jourReunion.count({ where: { dateHeure: { gte: debutMois, lte: maintenant } } }),
        this.prisma.jourReunion.findMany({
          where: { statut: 'TERMINEE', dateHeure: periode6mois },
          include: {
            _count: { select: { presences: true } },
            presences: { where: { statut: 'PRESENT' }, select: { id: true } },
          },
          orderBy: { dateHeure: 'desc' },
          take: 10,
        }),
      ])

    // Taux de présence aux activités : présents / lignes de présence saisies
    // (et non scouts × activités, qui supposait tout le groupe convoqué).
    const tauxPresence = pourcentage(
      activites6mois.reduce((s, a) => s + a.presences.length, 0),
      activites6mois.reduce((s, a) => s + a._count.presences, 0),
    )
    const tauxPresenceReunions = pourcentage(
      dernieresReunions.reduce((s, r) => s + r.presences.length, 0),
      dernieresReunions.reduce((s, r) => s + r._count.presences, 0),
    )

    return {
      scoutsParBranche,
      scoutsActifs,
      scoutsInactifs,
      activitesMois,
      tauxPresence,
      dernieresActivites: activites6mois.map(({ presences, ...a }) => ({ ...a, presents: presences.length })),
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
        tauxPresence: pourcentage(r.presences.length, r._count.presences),
      })),
    }
  }
}
