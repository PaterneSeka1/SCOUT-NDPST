import { BadRequestException, Injectable } from '@nestjs/common'
import {
  LABELS_BRANCHES,
  LABELS_ROLES,
  LABELS_STATUT_ACTIVITE,
  LABELS_STATUT_COTISATION,
  LABELS_TYPE_ACTIVITE,
  LABELS_TYPE_COTISATION,
  libelleRoleAvecFonction,
  ROLES_TOUT_STAFF,
} from '@scout/shared'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { champCsv as champ } from '../../common/lib/csv'
import { dateFichier, type FichierCsv, LABELS_SEXE } from './admin.utils'

const TYPES_EXPORT = ['scouts', 'utilisateurs', 'activites', 'cotisations'] as const
type TypeExport = (typeof TYPES_EXPORT)[number]

function estTypeExport(valeur: unknown): valeur is TypeExport {
  return typeof valeur === 'string' && (TYPES_EXPORT as readonly string[]).includes(valeur)
}

@Injectable()
export class RapportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Synthèse de l'installation (administrateur et direction du groupe).
  async synthese() {
    const maintenant = new Date()
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
    const [scouts, scoutsActifs, activitesMois, totalPresences, presencesPositives, cotisationsParStatut, utilisateursParRole] =
      await Promise.all([
        this.prisma.scout.count({ where: { anonymiseLe: null } }),
        this.prisma.scout.count({ where: { actif: true } }),
        this.prisma.activite.count({ where: { dateDebut: { gte: debutMois, lte: maintenant } } }),
        this.prisma.presence.count(),
        this.prisma.presence.count({ where: { present: true } }),
        this.prisma.cotisation.groupBy({ by: ['statut'], _sum: { montant: true, montantPaye: true } }),
        this.prisma.utilisateur.groupBy({ by: ['role'], where: { actif: true }, _count: { _all: true } }),
      ])

    const montantParStatut = (statut: string) =>
      cotisationsParStatut.find((c) => c.statut === statut)?._sum.montant ?? 0
    const staff = utilisateursParRole
      .filter((u) => ROLES_TOUT_STAFF.includes(u.role))
      .reduce((somme, u) => somme + u._count._all, 0)

    return {
      totaux: { scouts, scoutsActifs, utilisateurs: utilisateursParRole.reduce((s, u) => s + u._count._all, 0) },
      kpis: {
        activitesMois,
        tauxPresence: totalPresences > 0 ? Math.round((presencesPositives / totalPresences) * 100) : 0,
        cotisationsPayees: montantParStatut('PAYEE'),
        cotisationsEnAttente: montantParStatut('EN_ATTENTE'),
        utilisateursParCategorie: {
          staff,
          parents: utilisateursParRole.find((u) => u.role === 'PARENT')?._count._all ?? 0,
          comptesScouts: utilisateursParRole.find((u) => u.role === 'SCOUT')?._count._all ?? 0,
        },
      },
    }
  }

  async exporter(type: unknown, acteurId: string): Promise<FichierCsv> {
    if (!estTypeExport(type)) throw new BadRequestException('Type d’export invalide')

    const fichier = await (
      {
        scouts: () => this.exporterScouts(),
        utilisateurs: () => this.exporterUtilisateurs(),
        activites: () => this.exporterActivites(),
        cotisations: () => this.exporterCotisations(),
      } satisfies Record<TypeExport, () => Promise<FichierCsv>>
    )[type]()

    await this.audit.enregistrer({
      acteurId,
      action: 'RAPPORT_EXPORTE',
      entite: 'Rapport',
      entiteId: type,
      details: { type },
    })

    return fichier
  }

  private async exporterScouts(): Promise<FichierCsv> {
    const scouts = await this.prisma.scout.findMany({
      select: {
        nom: true,
        prenom: true,
        matricule: true,
        brancheType: true,
        sexe: true,
        dateNaissance: true,
        actif: true,
        equipe: { select: { nom: true } },
        utilisateur: { select: { matricule: true } },
        _count: { select: { contactsUrgence: true, documents: true, cotisations: true } },
      },
      where: { anonymiseLe: null },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    return {
      nomFichier: `rapport-scouts_${dateFichier()}.csv`,
      lignes: [
        '"Nom";"Prénom";"Matricule";"Branche";"Équipe";"Sexe";"Date de naissance";"Compte";"Contacts";"Documents";"Cotisations";"Statut"',
        ...scouts.map((s) =>
          [
            champ(s.nom.toUpperCase()),
            champ(s.prenom),
            champ(s.matricule),
            champ(LABELS_BRANCHES[s.brancheType] ?? s.brancheType),
            champ(s.equipe?.nom),
            champ(LABELS_SEXE[s.sexe] ?? s.sexe),
            champ(new Date(s.dateNaissance).toLocaleDateString('fr-FR')),
            champ(s.utilisateur ? 'Oui' : 'Non'),
            s._count.contactsUrgence,
            s._count.documents,
            s._count.cotisations,
            champ(s.actif ? 'Actif' : 'Inactif'),
          ].join(';'),
        ),
      ],
    }
  }

  private async exporterUtilisateurs(): Promise<FichierCsv> {
    const utilisateurs = await this.prisma.utilisateur.findMany({
      select: {
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        fonction: true,
        brancheType: true,
        actif: true,
      },
      orderBy: [{ role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
    })

    return {
      nomFichier: `rapport-utilisateurs_${dateFichier()}.csv`,
      lignes: [
        '"Nom";"Prénom";"Matricule";"Téléphone";"Email";"Rôle";"Statut"',
        ...utilisateurs.map((u) =>
          [
            champ(u.nom.toUpperCase()),
            champ(u.prenom),
            champ(u.matricule),
            champ(u.telephone),
            champ(u.email),
            champ(libelleRoleAvecFonction(u.role, u.fonction, u.brancheType)),
            champ(u.actif ? 'Actif' : 'Inactif'),
          ].join(';'),
        ),
      ],
    }
  }

  private async exporterActivites(): Promise<FichierCsv> {
    const activites = await this.prisma.activite.findMany({
      select: {
        titre: true,
        type: true,
        brancheType: true,
        dateDebut: true,
        dateFin: true,
        lieu: true,
        statut: true,
        publique: true,
        creeParUtilisateur: { select: { nom: true, prenom: true, role: true } },
        _count: { select: { presences: true, autorisationsCamp: true } },
      },
      orderBy: [{ dateDebut: 'desc' }],
    })

    return {
      nomFichier: `rapport-activites_${dateFichier()}.csv`,
      lignes: [
        '"Titre";"Type";"Branche";"Statut";"Publique";"Date début";"Date fin";"Lieu";"Présences";"Autorisations camp";"Créé par";"Rôle créateur"',
        ...activites.map((a) =>
          [
            champ(a.titre),
            champ(LABELS_TYPE_ACTIVITE[a.type] ?? a.type),
            champ(a.brancheType ? (LABELS_BRANCHES[a.brancheType] ?? a.brancheType) : 'Toutes les branches'),
            champ(LABELS_STATUT_ACTIVITE[a.statut] ?? a.statut),
            champ(a.publique ? 'Oui' : 'Non'),
            champ(new Date(a.dateDebut).toLocaleString('fr-FR')),
            champ(a.dateFin ? new Date(a.dateFin).toLocaleString('fr-FR') : ''),
            champ(a.lieu),
            a._count.presences,
            a._count.autorisationsCamp,
            champ(`${a.creeParUtilisateur.prenom} ${a.creeParUtilisateur.nom}`),
            champ(LABELS_ROLES[a.creeParUtilisateur.role] ?? a.creeParUtilisateur.role),
          ].join(';'),
        ),
      ],
    }
  }

  private async exporterCotisations(): Promise<FichierCsv> {
    const cotisations = await this.prisma.cotisation.findMany({
      select: {
        type: true,
        libelle: true,
        montant: true,
        montantPaye: true,
        anneeScolaire: true,
        statut: true,
        datePaiement: true,
        modePaiement: true,
        scout: { select: { nom: true, prenom: true, matricule: true, brancheType: true } },
      },
      orderBy: [{ anneeScolaire: 'desc' }, { scout: { nom: 'asc' } }],
    })

    return {
      nomFichier: `rapport-cotisations_${dateFichier()}.csv`,
      lignes: [
        '"Scout";"Matricule";"Branche";"Année scolaire";"Type";"Libellé";"Montant dû";"Montant payé";"Reste à payer";"Statut";"Date paiement";"Mode paiement"',
        ...cotisations.map((c) =>
          [
            champ(`${c.scout.prenom} ${c.scout.nom}`),
            champ(c.scout.matricule),
            champ(LABELS_BRANCHES[c.scout.brancheType] ?? c.scout.brancheType),
            champ(c.anneeScolaire),
            champ(LABELS_TYPE_COTISATION[c.type] ?? c.type),
            champ(c.libelle),
            c.montant,
            c.montantPaye,
            Math.max(0, c.montant - c.montantPaye),
            champ(LABELS_STATUT_COTISATION[c.statut] ?? c.statut),
            champ(c.datePaiement ? new Date(c.datePaiement).toLocaleDateString('fr-FR') : ''),
            champ(c.modePaiement),
          ].join(';'),
        ),
      ],
    }
  }
}
