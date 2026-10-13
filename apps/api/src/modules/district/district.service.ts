import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { hash } from 'bcryptjs'
import {
  BrancheTypeSchema,
  entierBorne,
  motDePasseValide,
  REGLE_MOT_DE_PASSE,
  ROLES_ASSIGNABLES_DISTRICT,
  ROLES_TOUT_STAFF,
} from '@scout/shared'
import type { BrancheType, Prisma, RoleUtilisateur } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { PerimetreService, type ParoisseDuDistrict } from '../../common/perimetre.service'
import { paroisseIdRequise } from '../../common/paroisse'
import type { UtilisateurSession } from '../../common/types'
import { AuthService } from '../../auth/auth.service'

const LIMITE_MAX_PAGE = 100

// Corps des requêtes d'affectation district : lus champ par champ, jamais
// transmis bruts à Prisma.
export interface CorpsAffectation {
  utilisateurId?: unknown
  role?: unknown
  fonction?: unknown
  brancheType?: unknown
}

export interface FiltresEquipe {
  page?: unknown
  limite?: unknown
  role?: unknown
  recherche?: unknown
}

const SELECT_MEMBRE = {
  id: true,
  nom: true,
  prenom: true,
  matricule: true,
  telephone: true,
  email: true,
  role: true,
  roleDistrict: true,
  fonctionDistrict: true,
  brancheTypeDistrict: true,
  actif: true,
  paroisse: { select: { id: true, nom: true } },
  createdAt: true,
  updatedAt: true,
} as const

type MembreSelectionne = Prisma.UtilisateurGetPayload<{ select: typeof SELECT_MEMBRE }>

// Vue « équipe district » d'un compte : `role` y désigne l'affectation district,
// le rôle paroissial étant exposé séparément (roleParoisse).
function versReponse(u: MembreSelectionne, avecMiseAJour = true) {
  return {
    id: u.id,
    nom: u.nom,
    prenom: u.prenom,
    matricule: u.matricule,
    telephone: u.telephone,
    email: u.email,
    role: u.roleDistrict,
    fonction: u.fonctionDistrict,
    brancheType: u.brancheTypeDistrict,
    roleParoisse: u.role,
    paroisse: u.paroisse,
    actif: u.actif,
    createdAt: u.createdAt,
    ...(avecMiseAJour ? { updatedAt: u.updatedAt } : {}),
  }
}

function texteQuery(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null
}

// Champ optionnel du corps : absent (undefined), null, ou chaîne — tout autre
// type est rejeté plutôt que de faire échouer le traitement plus loin.
function chaineOuNull(valeur: unknown): string | null | undefined {
  if (valeur === undefined || valeur === null) return valeur
  if (typeof valeur !== 'string') throw new BadRequestException('Données invalides')
  return valeur
}

@Injectable()
export class DistrictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // Point d'entrée de l'espace district : dérive le district d'un membre de
  // l'équipe district à partir du district de SA paroisse d'ancrage. Une
  // paroisse d'ancrage disparue renvoie 400, comme la route d'origine.
  private async district(
    utilisateur: UtilisateurSession,
  ): Promise<{ nomDistrict: string; paroisses: ParoisseDuDistrict[]; paroisseIds: string[] }> {
    const paroisseId = paroisseIdRequise(utilisateur)
    try {
      const { nomDistrict, paroisses } = await this.perimetre.paroissesDuDistrict(paroisseId)
      return { nomDistrict, paroisses, paroisseIds: paroisses.map((p) => p.id) }
    } catch (erreur) {
      if (erreur instanceof NotFoundException) throw new BadRequestException('Paroisse introuvable')
      throw erreur
    }
  }

  // Un ASSISTANT_DISTRICT chargé d'une branche précise n'a besoin que des
  // données de sa branche (voir /api/district/ma-branche), jamais de la vue
  // d'ensemble multi-branches de tout le district.
  private async estAssistantDeBranche(utilisateur: UtilisateurSession): Promise<boolean> {
    if (utilisateur.roleDistrict !== 'ASSISTANT_DISTRICT') return false
    return !!(await this.perimetre.brancheDistrictUtilisateur(utilisateur.id))
  }

  // Membre de l'équipe district géré par le Commissaire : scopé sur toutes les
  // paroisses du district (pas seulement celle d'ancrage du Commissaire, un
  // Adjoint/Assistant conserve sa paroisse d'origine) ET limité aux affectations
  // assignables — jamais un autre Commissaire ni un compte hors district.
  private async membreDuDistrict<S extends Prisma.UtilisateurSelect>(
    utilisateur: UtilisateurSession,
    id: string,
    select: S,
  ): Promise<Prisma.UtilisateurGetPayload<{ select: S }>> {
    const { paroisseIds } = await this.district(utilisateur)
    const membre = await this.prisma.utilisateur.findFirst({
      where: {
        id,
        paroisseId: { in: paroisseIds },
        roleDistrict: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] },
      },
      select,
    })
    if (!membre) throw new NotFoundException('Utilisateur introuvable')
    return membre as Prisma.UtilisateurGetPayload<{ select: S }>
  }

  async apercu(utilisateur: UtilisateurSession) {
    if (await this.estAssistantDeBranche(utilisateur)) throw new ForbiddenException('Accès refusé')

    const { nomDistrict, paroisseIds } = await this.district(utilisateur)

    const maintenant = new Date()
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)

    const [paroisses, activitesMois] = await Promise.all([
      this.prisma.paroisse.findMany({
        where: { id: { in: paroisseIds } },
        select: {
          id: true,
          nom: true,
          ville: true,
          actif: true,
          _count: { select: { scouts: true, utilisateurs: true } },
          utilisateurs: {
            where: { role: 'CHEF_GROUPE' },
            select: { nom: true, prenom: true },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { nom: 'asc' },
      }),
      this.prisma.activite.count({
        where: { paroisseId: { in: paroisseIds }, dateDebut: { gte: debutMois, lte: maintenant } },
      }),
    ])

    const totaux = paroisses.reduce(
      (acc, p) => ({
        paroisses: acc.paroisses + 1,
        paroissesActives: acc.paroissesActives + (p.actif ? 1 : 0),
        scouts: acc.scouts + p._count.scouts,
        utilisateurs: acc.utilisateurs + p._count.utilisateurs,
      }),
      { paroisses: 0, paroissesActives: 0, scouts: 0, utilisateurs: 0 },
    )

    return {
      nomDistrict,
      totaux: { ...totaux, activitesMois },
      paroisses: paroisses.map((p) => ({
        id: p.id,
        nom: p.nom,
        ville: p.ville,
        actif: p.actif,
        scouts: p._count.scouts,
        utilisateurs: p._count.utilisateurs,
        chefGroupe: p.utilisateurs[0] ?? null,
      })),
    }
  }

  async maBranche(utilisateur: UtilisateurSession) {
    const branche = await this.perimetre.brancheDistrictUtilisateur(utilisateur.id)
    if (!branche) throw new ForbiddenException('Aucune branche assignée')
    const bt = branche as BrancheType

    const { paroisseIds } = await this.district(utilisateur)

    const [scouts, totalBadges, activitesRecentes, programmesRecents] = await Promise.all([
      this.prisma.scout.findMany({
        where: { paroisseId: { in: paroisseIds }, brancheType: bt, actif: true },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          paroisse: { select: { nom: true } },
          _count: { select: { progressions: true } },
        },
        orderBy: [{ paroisse: { nom: 'asc' } }, { nom: 'asc' }],
      }),
      this.prisma.badge.count({ where: { brancheType: bt } }),
      this.prisma.activite.findMany({
        where: { paroisseId: { in: paroisseIds }, brancheType: bt, creePar: utilisateur.id },
        orderBy: { dateDebut: 'desc' },
        take: 10,
        select: { id: true, titre: true, dateDebut: true, lieu: true, paroisse: { select: { nom: true } } },
      }),
      this.prisma.programme.findMany({
        where: { paroisseId: { in: paroisseIds }, brancheType: bt, creePar: utilisateur.id },
        orderBy: { periodeDebut: 'desc' },
        take: 10,
        select: { id: true, titre: true, periodeDebut: true, periodeFin: true, paroisse: { select: { nom: true } } },
      }),
    ])

    return {
      branche: bt,
      totalBadges,
      scouts: scouts.map((scout) => ({
        id: scout.id,
        nom: scout.nom,
        prenom: scout.prenom,
        matricule: scout.matricule,
        paroisseNom: scout.paroisse.nom,
        badgesValides: scout._count.progressions,
      })),
      activitesRecentes,
      programmesRecents,
    }
  }

  async paroisses(utilisateur: UtilisateurSession) {
    // Un ASSISTANT_DISTRICT chargé d'une branche n'a jamais accès au détail
    // multi-branches (contact du Chef de Groupe, effectifs de chaque branche)
    // des paroisses du district. La simple liste (id/nom/ville) lui reste
    // nécessaire pour choisir la paroisse d'une activité ou d'un programme de
    // branche : on renvoie une version allégée plutôt qu'un 403.
    const detailMultiBranchesAutorise = !(await this.estAssistantDeBranche(utilisateur))

    const { paroisses, paroisseIds } = await this.district(utilisateur)

    if (!detailMultiBranchesAutorise) {
      return {
        paroisses: paroisses.map((p) => ({
          id: p.id,
          nom: p.nom,
          ville: p.ville,
          actif: p.actif,
          chefGroupe: null,
          effectifsParBranche: [],
        })),
      }
    }

    const [chefsGroupe, effectifs] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where: { paroisseId: { in: paroisseIds }, role: 'CHEF_GROUPE' },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          telephone: true,
          email: true,
          actif: true,
          paroisseId: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.scout.groupBy({
        by: ['paroisseId', 'brancheType'],
        where: { paroisseId: { in: paroisseIds }, actif: true },
        _count: { id: true },
      }),
    ])

    // Un seul CHEF_GROUPE par paroisse en principe — le tri par createdAt asc
    // ci-dessus garantit qu'en cas d'anomalie, on retient le plus ancien.
    const chefParParoisse = new Map<string, (typeof chefsGroupe)[number]>()
    for (const chef of chefsGroupe) {
      if (chef.paroisseId && !chefParParoisse.has(chef.paroisseId)) chefParParoisse.set(chef.paroisseId, chef)
    }

    const effectifsParParoisse = new Map<string, { brancheType: string; count: number }[]>()
    for (const ligne of effectifs) {
      const liste = effectifsParParoisse.get(ligne.paroisseId) ?? []
      liste.push({ brancheType: ligne.brancheType, count: ligne._count.id })
      effectifsParParoisse.set(ligne.paroisseId, liste)
    }

    return {
      paroisses: paroisses.map((p) => {
        const chef = chefParParoisse.get(p.id)
        return {
          id: p.id,
          nom: p.nom,
          ville: p.ville,
          actif: p.actif,
          chefGroupe: chef
            ? {
                id: chef.id,
                nom: chef.nom,
                prenom: chef.prenom,
                matricule: chef.matricule,
                telephone: chef.telephone,
                email: chef.email,
                actif: chef.actif,
              }
            : null,
          effectifsParBranche: effectifsParParoisse.get(p.id) ?? [],
        }
      }),
    }
  }

  async rapports(utilisateur: UtilisateurSession) {
    const { paroisseIds } = await this.district(utilisateur)

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
      this.prisma.scout.groupBy({ by: ['brancheType'], where: { paroisseId: { in: paroisseIds } }, _count: { id: true } }),
      this.prisma.scout.count({ where: { paroisseId: { in: paroisseIds }, actif: true } }),
      this.prisma.scout.count({ where: { paroisseId: { in: paroisseIds }, actif: false } }),
      this.prisma.activite.count({
        where: { paroisseId: { in: paroisseIds }, dateDebut: { gte: debutMois, lte: maintenant } },
      }),
      this.prisma.activite.findMany({
        where: { paroisseId: { in: paroisseIds }, dateDebut: { gte: il6mois, lte: maintenant } },
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
        where: { paroisseId: { in: paroisseIds }, dateDebut: { gte: il6mois, lte: maintenant } },
      }),
      this.prisma.presence.count({
        where: {
          present: true,
          activite: { paroisseId: { in: paroisseIds }, dateDebut: { gte: il6mois, lte: maintenant } },
        },
      }),
      this.prisma.scout.count({ where: { paroisseId: { in: paroisseIds }, actif: true } }),
      this.prisma.jourReunion.count({
        where: { paroisseId: { in: paroisseIds }, dateHeure: { gte: debutMois, lte: maintenant } },
      }),
      this.prisma.jourReunion.findMany({
        where: {
          paroisseId: { in: paroisseIds },
          statut: 'TERMINEE',
          dateHeure: { gte: il6mois, lte: maintenant },
        },
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

  // Pool des personnes que le Commissaire de District peut ajouter à son équipe
  // (voir affecter) : tout le staff (ROLES_TOUT_STAFF) actif d'une des paroisses
  // du district, pas déjà affecté au district.
  async eligibles(utilisateur: UtilisateurSession) {
    const { paroisseIds } = await this.district(utilisateur)
    const personnel = await this.prisma.utilisateur.findMany({
      where: {
        role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] },
        actif: true,
        roleDistrict: null,
        paroisseId: { in: paroisseIds },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        role: true,
        paroisse: { select: { id: true, nom: true } },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })
    return { personnel }
  }

  async listerEquipe(utilisateur: UtilisateurSession, filtres: FiltresEquipe) {
    const page = entierBorne(texteQuery(filtres.page), 1, 1, Number.MAX_SAFE_INTEGER)
    const limite = entierBorne(texteQuery(filtres.limite), 20, 1, LIMITE_MAX_PAGE)
    const roles = (texteQuery(filtres.role) ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter((r) => ROLES_ASSIGNABLES_DISTRICT.includes(r))
    const recherche = texteQuery(filtres.recherche) || undefined

    const { paroisseIds } = await this.district(utilisateur)

    // Scopé par les paroisses DU DISTRICT (pas seulement celle d'ancrage du
    // Commissaire) ET roleDistrict dans ROLES_ASSIGNABLES_DISTRICT — roleDistrict
    // est une affectation ADDITIVE au rôle paroissial (role) de la personne,
    // jamais un remplacement (voir prisma/schema.prisma).
    const where: Prisma.UtilisateurWhereInput = {
      paroisseId: { in: paroisseIds },
      roleDistrict: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] },
      ...(roles.length === 1 ? { roleDistrict: roles[0] as RoleUtilisateur } : {}),
      ...(roles.length > 1 ? { roleDistrict: { in: roles as RoleUtilisateur[] } } : {}),
      ...(recherche
        ? {
            OR: [
              { nom: { contains: recherche, mode: 'insensitive' } },
              { prenom: { contains: recherche, mode: 'insensitive' } },
              { matricule: { contains: recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [utilisateurs, total] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where,
        select: SELECT_MEMBRE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limite,
        take: limite,
      }),
      this.prisma.utilisateur.count({ where }),
    ])

    return {
      utilisateurs: utilisateurs.map((u) => versReponse(u, false)),
      total,
      page,
      totalPages: Math.ceil(total / limite),
    }
  }

  // Ajoute un membre à l'équipe du district en affectant roleDistrict à un
  // membre du staff (ROLES_TOUT_STAFF) déjà en poste et actif dans l'une des
  // paroisses du district — jamais en créant un nouveau compte, et sans jamais
  // toucher à son rôle paroissial (role) : il continue de l'exercer normalement,
  // l'affectation district s'ajoute simplement à son compte existant.
  async affecter(utilisateur: UtilisateurSession, corps: CorpsAffectation) {
    const utilisateurId = typeof corps.utilisateurId === 'string' ? corps.utilisateurId.trim() : ''
    const role = typeof corps.role === 'string' ? corps.role : ''
    const fonction = chaineOuNull(corps.fonction)
    const brancheType = chaineOuNull(corps.brancheType)

    if (!utilisateurId || !role) throw new BadRequestException('Le membre à désigner et le rôle sont requis')

    // Seuls ADJOINT_DISTRICT et ASSISTANT_DISTRICT sont assignables par le
    // Commissaire de District à sa propre équipe — ni son propre rôle, ni
    // aucun rôle paroissial ou plateforme.
    if (!ROLES_ASSIGNABLES_DISTRICT.includes(role)) throw new BadRequestException('Rôle invalide')

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      throw new BadRequestException('Branche invalide')
    }

    const { paroisseIds } = await this.district(utilisateur)

    const membre = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { id: true, role: true, roleDistrict: true, actif: true, paroisseId: true },
    })
    if (!membre) throw new NotFoundException('Utilisateur introuvable')

    if (!ROLES_TOUT_STAFF.includes(membre.role) || !membre.actif) {
      throw new BadRequestException("Seul un membre actif du staff d'une paroisse peut rejoindre l'équipe du district")
    }
    if (membre.roleDistrict) {
      throw new BadRequestException("Cette personne fait déjà partie de l'équipe du district")
    }
    if (!membre.paroisseId || !paroisseIds.includes(membre.paroisseId)) {
      throw new BadRequestException("Cette personne n'appartient pas à une paroisse de ce district")
    }

    // brancheType (chargé d'une branche) et fonction (texte libre) sont
    // mutuellement exclusifs et n'ont de sens que pour ASSISTANT_DISTRICT —
    // ignorés/forcés à null pour ADJOINT_DISTRICT.
    const brancheTypeValeur = role === 'ASSISTANT_DISTRICT' && brancheType ? (brancheType as BrancheType) : null
    const fonctionValeur = role === 'ASSISTANT_DISTRICT' && !brancheTypeValeur ? fonction?.trim() || null : null

    const affecte = await this.prisma.utilisateur.update({
      where: { id: membre.id },
      data: {
        roleDistrict: role as RoleUtilisateur,
        fonctionDistrict: fonctionValeur,
        brancheTypeDistrict: brancheTypeValeur,
      },
      select: SELECT_MEMBRE,
    })

    await this.audit.enregistrer({
      paroisseId: membre.paroisseId,
      acteurId: utilisateur.id,
      action: 'UTILISATEUR_ROLE_DISTRICT_AFFECTE',
      entite: 'Utilisateur',
      entiteId: affecte.id,
      details: {
        roleParoisse: affecte.role,
        roleDistrict: affecte.roleDistrict,
        fonctionDistrict: affecte.fonctionDistrict,
      },
    })

    return versReponse(affecte, false)
  }

  async detailMembre(utilisateur: UtilisateurSession, id: string) {
    return versReponse(await this.membreDuDistrict(utilisateur, id, SELECT_MEMBRE))
  }

  // Modifie l'affectation district (rôle/fonction/branche) d'un membre déjà
  // affecté — n'a jamais d'effet sur son rôle paroissial (role), géré par le
  // Chef de Groupe de sa propre paroisse.
  async modifierMembre(utilisateur: UtilisateurSession, id: string, corps: CorpsAffectation) {
    const existant = await this.membreDuDistrict(utilisateur, id, {
      id: true,
      roleDistrict: true,
      actif: true,
      fonctionDistrict: true,
      paroisseId: true,
    })

    if (corps.role !== undefined && (typeof corps.role !== 'string' || !ROLES_ASSIGNABLES_DISTRICT.includes(corps.role))) {
      throw new BadRequestException('Rôle invalide')
    }
    const role = corps.role as string | undefined
    const fonction = chaineOuNull(corps.fonction)
    const brancheType = chaineOuNull(corps.brancheType)

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      throw new BadRequestException('Branche invalide')
    }

    // fonction n'a de sens que pour ASSISTANT_DISTRICT : si le rôle final
    // (après cette modification) n'est pas ASSISTANT_DISTRICT, on la force à
    // null même si elle n'a pas été envoyée — un ADJOINT_DISTRICT ne doit
    // jamais conserver une fonction héritée d'un rôle précédent.
    const roleFinal = role !== undefined ? role : existant.roleDistrict
    const fonctionFinale =
      roleFinal !== 'ASSISTANT_DISTRICT' ? null : fonction !== undefined ? fonction?.trim() || null : undefined

    // brancheType et fonction sont mutuellement exclusifs : si un texte de
    // fonction a été fourni à la place, la branche est effacée même si un
    // brancheType est aussi présent dans le corps de la requête.
    const fonctionTexteFourni = fonction !== undefined && !!fonction?.trim()
    const brancheFinale =
      roleFinal !== 'ASSISTANT_DISTRICT' || fonctionTexteFourni
        ? null
        : brancheType !== undefined
          ? (brancheType as BrancheType | null)
          : undefined

    const modifie = await this.prisma.utilisateur.update({
      where: { id: existant.id },
      data: {
        ...(role !== undefined ? { roleDistrict: role as RoleUtilisateur } : {}),
        ...(fonctionFinale !== undefined ? { fonctionDistrict: fonctionFinale } : {}),
        ...(brancheFinale !== undefined ? { brancheTypeDistrict: brancheFinale } : {}),
      },
      select: SELECT_MEMBRE,
    })

    if (role !== undefined && role !== existant.roleDistrict) {
      await this.audit.enregistrer({
        paroisseId: existant.paroisseId,
        acteurId: utilisateur.id,
        action: 'UTILISATEUR_ROLE_DISTRICT_MODIFIE',
        entite: 'Utilisateur',
        entiteId: existant.id,
        details: { ancienRoleDistrict: existant.roleDistrict, nouveauRoleDistrict: role },
      })
    }

    return versReponse(modifie)
  }

  // Retire un membre de l'équipe du district : efface uniquement l'affectation
  // district (roleDistrict/fonctionDistrict/brancheTypeDistrict), sans jamais
  // désactiver le compte — la personne continue de travailler normalement dans
  // sa paroisse via son rôle paroissial (role), inchangé.
  async retirerMembre(utilisateur: UtilisateurSession, id: string) {
    const existant = await this.membreDuDistrict(utilisateur, id, { id: true, paroisseId: true })

    const retire = await this.prisma.utilisateur.update({
      where: { id: existant.id },
      data: { roleDistrict: null, fonctionDistrict: null, brancheTypeDistrict: null },
      select: SELECT_MEMBRE,
    })

    await this.audit.enregistrer({
      paroisseId: existant.paroisseId,
      acteurId: utilisateur.id,
      action: 'UTILISATEUR_ROLE_DISTRICT_RETIRE',
      entite: 'Utilisateur',
      entiteId: existant.id,
    })

    return versReponse(retire)
  }

  // Réinitialisation du mot de passe d'un membre de l'équipe district par le
  // Commissaire, limitée aux membres assignables des paroisses de SON district.
  // Toutes les sessions ouvertes du compte sont ensuite révoquées.
  async modifierMotDePasse(utilisateur: UtilisateurSession, id: string, nouveauMotDePasse: unknown) {
    const existant = await this.membreDuDistrict(utilisateur, id, { id: true, paroisseId: true })

    if (typeof nouveauMotDePasse !== 'string' || !nouveauMotDePasse || !motDePasseValide(nouveauMotDePasse)) {
      throw new BadRequestException(REGLE_MOT_DE_PASSE)
    }

    const passwordHache = await hash(nouveauMotDePasse, 12)
    await this.prisma.utilisateur.update({ where: { id: existant.id }, data: { password: passwordHache } })
    await this.auth.revoquerToutes(existant.id)

    await this.audit.enregistrer({
      paroisseId: existant.paroisseId,
      acteurId: utilisateur.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: existant.id,
    })

    return { message: 'Mot de passe mis à jour' }
  }
}
