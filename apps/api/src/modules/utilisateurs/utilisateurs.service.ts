import { genererMotDePasseTemporaire } from '../../auth/secret-temporaire'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { hash } from 'bcryptjs'
import { LABELS_ROLES, ROLES_ASSIGNABLES_PAROISSE, ROLES_BRANCHE, ROLES_DISTRICT_ETENDU } from '@scout/shared'
import { Prisma, type BrancheType, type RoleUtilisateur } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { AuthService } from '../../auth/auth.service'
import { paroisseIdRequise } from '../../common/paroisse'
import { envoyerEmailBienvenue } from '../../common/lib/notifications'
import { logger } from '../../common/lib/logger'
import { env } from '../../config/env'
import type { UtilisateurSession } from '../../common/types'
import type {
  CorpsCreationUtilisateur,
  CorpsModificationUtilisateur,
  CorpsReinitialisationMotDePasse,
} from './utilisateurs.schemas'

const SELECTION_LISTE = {
  id: true,
  nom: true,
  prenom: true,
  matricule: true,
  telephone: true,
  email: true,
  role: true,
  brancheType: true,
  actif: true,
  createdAt: true,
} as const

const SELECTION_DETAIL = {
  id: true,
  nom: true,
  prenom: true,
  matricule: true,
  telephone: true,
  email: true,
  role: true,
  brancheType: true,
  actif: true,
  paroisseId: true,
  createdAt: true,
  updatedAt: true,
} as const

const SELECTION_ENFANT = {
  id: true,
  nom: true,
  prenom: true,
  brancheType: true,
  matricule: true,
  actif: true,
} as const

const MESSAGE_CONFLIT_CREATION =
  'Conflit avec un compte existant : matricule, téléphone, adresse e-mail ou poste unique déjà attribué.'
const MESSAGE_CONFLIT_MODIFICATION = 'Conflit avec un compte existant : adresse e-mail ou poste unique déjà attribué.'

export interface FiltresListe {
  page?: string
  limite?: string
  role?: string
  recherche?: string
}

function estErreurUnicite(erreur: unknown): boolean {
  return erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002'
}

@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // Unicité des postes « 1 Chef de Groupe actif par paroisse » et « 1 Responsable
  // de Branche actif par (paroisse, branche) » : garantie en base par des index
  // partiels (migration 20260713150000_fixes_pre_production), vérifiée ici en
  // amont pour renvoyer un message clair plutôt qu'une violation de contrainte.
  private async conflitPosteUnique(
    paroisseId: string,
    role: string,
    brancheType: string | null,
    exclureId?: string,
  ): Promise<string | null> {
    const exclusion = exclureId ? { NOT: { id: exclureId } } : {}
    if (role === 'CHEF_GROUPE') {
      const autre = await this.prisma.utilisateur.findFirst({
        where: { paroisseId, role: 'CHEF_GROUPE', actif: true, ...exclusion },
        select: { id: true },
      })
      if (autre) {
        return "Cette paroisse a déjà un Chef de Groupe actif. Utilisez la désignation du Chef de Groupe depuis l'administration."
      }
    }
    if (role === 'RESPONSABLE_BRANCHE' && brancheType) {
      const autre = await this.prisma.utilisateur.findFirst({
        where: {
          paroisseId,
          role: 'RESPONSABLE_BRANCHE',
          brancheType: brancheType as BrancheType,
          actif: true,
          ...exclusion,
        },
        select: { id: true },
      })
      if (autre) return 'Cette branche a déjà un Responsable de Branche actif dans la paroisse.'
    }
    return null
  }

  async lister(session: UtilisateurSession, filtres: FiltresListe) {
    // Bornés : une valeur non numérique retombe sur la valeur par défaut, et
    // `limite` est plafonné pour éviter une requête non paginée en pratique.
    const pageBrute = parseInt(filtres.page ?? '1', 10)
    const limiteBrute = parseInt(filtres.limite ?? '20', 10)
    const page = Number.isNaN(pageBrute) ? 1 : Math.max(1, pageBrute)
    const limite = Number.isNaN(limiteBrute) ? 20 : Math.min(100, Math.max(1, limiteBrute))
    // Accepte un rôle unique ("PARENT") ou une liste séparée par des virgules
    // ("ADJOINT_GROUPE,ASSISTANT_GROUPE,...") — utilisé par la page "Membres"
    // pour exclure les parents sans avoir besoin d'un paramètre dédié.
    const roles = (filtres.role ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter((r) => ROLES_ASSIGNABLES_PAROISSE.includes(r))
    const recherche = filtres.recherche

    const paroisseId = paroisseIdRequise(session)

    // Un membre de l'équipe du district (roleDistrict renseigné) reste un
    // membre normal de sa paroisse (role inchangé) : il apparaît donc
    // normalement dans cette liste, comme n'importe quel autre membre du staff.
    const where: Prisma.UtilisateurWhereInput = {
      paroisseId,
      NOT: { id: session.id },
      ...(roles.length === 1 ? { role: roles[0] as RoleUtilisateur } : {}),
      ...(roles.length > 1 ? { role: { in: roles as RoleUtilisateur[] } } : {}),
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
        select: SELECTION_LISTE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limite,
        take: limite,
      }),
      this.prisma.utilisateur.count({ where }),
    ])

    return { utilisateurs, total, page, totalPages: Math.ceil(total / limite) }
  }

  // Forme, mot de passe, rôle (valeur connue), branche et enfants déjà validés
  // par SchemaCreationUtilisateur ; restent ici les règles d'attribution.
  async creer(session: UtilisateurSession, corps: CorpsCreationUtilisateur) {
    const { nom, prenom, role, email, matricule, telephone, brancheType, scoutIds: scoutIdsUniques } = corps

    // Un admin plateforme (transverse, sans paroisse) ne se crée jamais via
    // cette route — uniquement via la bascule de compte ou un accès base directe.
    // Les rôles de district non plus : gérés par ADMIN_PLATEFORME (création du
    // Commissaire de District) puis par lui-même via /district/equipe.
    // ROLES_ASSIGNABLES_PAROISSE exclut aussi PARENT et SCOUT en périmètre V1.
    if (
      role === 'ADMIN_PLATEFORME' ||
      ROLES_DISTRICT_ETENDU.includes(role) ||
      !ROLES_ASSIGNABLES_PAROISSE.includes(role)
    ) {
      throw new BadRequestException('Rôle invalide')
    }

    // brancheType n'a de sens que pour l'encadrement de branche : requis pour
    // ces rôles, forcé à null pour tout autre rôle même si envoyé par erreur.
    if (ROLES_BRANCHE.includes(role) && !brancheType) {
      throw new BadRequestException('La branche est requise pour ce rôle')
    }
    const brancheTypeFinal = ROLES_BRANCHE.includes(role) ? (brancheType ?? null) : null

    const estParent = role === 'PARENT'

    // Un compte staff (Chef de Groupe, encadrement de branche, Ressources
    // Adultes…) peut tout autant être parent d'un scout de la paroisse que
    // quelqu'un créé spécifiquement avec le rôle PARENT — le rattachement à
    // des enfants n'est donc jamais limité à un rôle particulier (scoutIds, déjà dédoublonnés par le schéma).
    if (estParent && !telephone?.trim()) {
      throw new BadRequestException('Le numéro de téléphone est requis pour un parent')
    }
    if (!estParent && !matricule?.trim()) {
      throw new BadRequestException('Le matricule est requis')
    }

    const paroisseId = paroisseIdRequise(session)

    // Un compte est créé actif : il ne doit pas doubler un poste unique.
    const conflitPoste = await this.conflitPosteUnique(paroisseId, role, brancheTypeFinal)
    if (conflitPoste) throw new ConflictException(conflitPoste)

    if (scoutIdsUniques.length > 0) {
      const scoutsAutorises = await this.prisma.scout.count({
        where: { id: { in: scoutIdsUniques }, paroisseId },
      })
      if (scoutsAutorises !== scoutIdsUniques.length) {
        throw new BadRequestException('Un ou plusieurs enfants sélectionnés sont introuvables')
      }
    }

    if (matricule?.trim()) {
      const existant = await this.prisma.utilisateur.findUnique({
        where: { matricule: matricule.trim() },
        select: { id: true },
      })
      if (existant) throw new BadRequestException('Ce matricule est déjà utilisé')
    }

    if (telephone?.trim()) {
      const existant = await this.prisma.utilisateur.findUnique({
        where: { telephone: telephone.trim() },
        select: { id: true },
      })
      if (existant) throw new BadRequestException('Ce numéro de téléphone est déjà utilisé')
    }

    if (email?.trim()) {
      // Insensible à la casse : évite qu'un doublon "Jean@x.com" / "jean@x.com"
      // passe inaperçu, ce qui rendrait ensuite la réinitialisation par email ambiguë.
      const existant = await this.prisma.utilisateur.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } },
        select: { id: true },
      })
      if (existant) throw new BadRequestException('Cette adresse e-mail est déjà utilisée')
    }

    const motDePasseTemporaire = genererMotDePasseTemporaire()
    const passwordHache = await hash(motDePasseTemporaire, 12)

    let utilisateur
    try {
      utilisateur = await this.prisma.$transaction(async (tx) => {
        const nouveau = await tx.utilisateur.create({
          data: {
            nom,
            prenom,
            email: email?.trim() || null,
            matricule: matricule?.trim() || null,
            telephone: telephone?.trim() || null,
            role,
            brancheType: brancheTypeFinal,
            password: passwordHache,
            doitChangerMotDePasse: true,
            paroisseId,
          },
          select: SELECTION_LISTE,
        })

        if (scoutIdsUniques.length > 0) {
          await tx.lienParentScout.createMany({
            data: scoutIdsUniques.map((scoutId) => ({ parentId: nouveau.id, scoutId })),
            skipDuplicates: true,
          })
        }
        return nouveau
      })
    } catch (erreur) {
      // Création concurrente : la contrainte d'unicité en base a tranché.
      if (estErreurUnicite(erreur)) throw new ConflictException(MESSAGE_CONFLIT_CREATION)
      throw erreur
    }

    await this.audit.enregistrer({
      paroisseId,
      acteurId: session.id,
      action: 'UTILISATEUR_CREE',
      entite: 'Utilisateur',
      entiteId: utilisateur.id,
      details: { role: utilisateur.role, scoutIds: scoutIdsUniques },
    })

    if (utilisateur.email) {
      // Meilleur effort : un échec d'envoi ne doit jamais faire échouer la création du compte.
      envoyerEmailBienvenue({
        email: utilisateur.email,
        prenom: utilisateur.prenom,
        identifiant: utilisateur.matricule ?? utilisateur.telephone ?? utilisateur.email,
        roleLabel: LABELS_ROLES[utilisateur.role] ?? utilisateur.role,
        nomSite: 'SCOUT ASCCI',
        urlConnexion: `${env().URL_FRONTEND_PAROISSE}/login`,
      }).catch((erreur) => logger.error('utilisateurs.email_bienvenue_echoue', erreur))
    }

    return { ...utilisateur, motDePasseTemporaire }
  }

  private async enfantsDe(parentId: string, paroisseId: string) {
    const liens = await this.prisma.lienParentScout.findMany({
      where: { parentId, scout: { paroisseId } },
      select: { scout: { select: SELECTION_ENFANT } },
    })
    return liens.map((lien) => lien.scout)
  }

  async detail(session: UtilisateurSession, id: string) {
    const paroisseId = paroisseIdRequise(session)

    // Un membre de l'équipe du district (roleDistrict renseigné) reste un
    // membre normal de sa paroisse (role inchangé) : il apparaît donc
    // normalement ici, comme n'importe quel autre membre du staff.
    const utilisateur = await this.prisma.utilisateur.findFirst({
      where: { id, paroisseId },
      select: {
        ...SELECTION_DETAIL,
        liensParent: {
          where: { scout: { paroisseId } },
          select: { scout: { select: SELECTION_ENFANT } },
        },
      },
    })
    if (!utilisateur) throw new NotFoundException('Utilisateur introuvable')

    const { liensParent, ...reste } = utilisateur
    return { ...reste, enfants: liensParent.map((lien) => lien.scout) }
  }

  // Forme déjà validée par SchemaModificationUtilisateur ; restent ici la
  // hiérarchie des rôles, la branche requise et les conflits de poste.
  async modifier(session: UtilisateurSession, id: string, corps: CorpsModificationUtilisateur) {
    const paroisseId = paroisseIdRequise(session)

    const existant = await this.prisma.utilisateur.findFirst({
      where: { id, paroisseId },
      select: { id: true, role: true, actif: true, brancheType: true, roleDistrict: true },
    })
    if (!existant) throw new NotFoundException('Utilisateur introuvable')

    // undefined = champ non envoyé, ne touche pas aux enfants rattachés ;
    // tableau (même vide) = remplace intégralement la liste. Un compte staff
    // (Chef de Groupe, encadrement de branche, Ressources Adultes…) peut être
    // rattaché à des enfants tout autant qu'un compte PARENT dédié — voir
    // creer() pour la même règle à la création.
    const { role, nom, prenom, email, actif, brancheType, scoutIds: scoutIdsUniques } = corps

    if (scoutIdsUniques && scoutIdsUniques.length > 0) {
      const scoutsAutorises = await this.prisma.scout.count({ where: { id: { in: scoutIdsUniques }, paroisseId } })
      if (scoutsAutorises !== scoutIdsUniques.length) {
        throw new BadRequestException('Un ou plusieurs enfants sélectionnés sont introuvables')
      }
    }

    // Un admin plateforme (transverse, sans paroisse) ne se promeut jamais
    // depuis cette route, quel que soit qui l'appelle. Les rôles de district
    // ne sont pas non plus assignables ici : gérés par ADMIN_PLATEFORME (création)
    // puis par le Commissaire de District lui-même via /district/equipe.
    if (role === 'ADMIN_PLATEFORME' || (role !== undefined && ROLES_DISTRICT_ETENDU.includes(role))) {
      throw new BadRequestException('Rôle invalide')
    }

    const changeRole = role !== undefined && role !== existant.role

    // Personne ne peut changer son propre rôle ou se désactiver soi-même —
    // sans quoi un compte connaissant son propre id pourrait s'auto-promouvoir
    // ou verrouiller son propre accès.
    if (id === session.id && (changeRole || actif === false)) {
      throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle ou vous désactiver')
    }

    // Périmètre V1 : on ne bascule plus personne vers PARENT ou SCOUT (exclus de
    // ROLES_ASSIGNABLES_PAROISSE) ; un compte existant garde toutefois son rôle.
    if (changeRole && role && !ROLES_ASSIGNABLES_PAROISSE.includes(role)) throw new BadRequestException('Rôle invalide')

    // Un compte de l'équipe de district (roleDistrict renseigné) est piloté par
    // l'administration plateforme / le district : le Chef de Groupe ne peut ni
    // changer son rôle ni le désactiver.
    if (existant.roleDistrict && (changeRole || actif === false)) {
      throw new ForbiddenException(
        "Ce compte fait partie de l'équipe de district : son rôle et son statut sont gérés par l'administration.",
      )
    }

    const emailNettoye = email?.trim() ?? ''
    if (email !== undefined && emailNettoye) {
      const doublon = await this.prisma.utilisateur.findFirst({
        where: { email: { equals: emailNettoye, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      })
      if (doublon) throw new BadRequestException('Cette adresse e-mail est déjà utilisée')
    }

    // brancheType n'a de sens que pour l'encadrement de branche : requis pour
    // ces rôles (même si le rôle final n'a pas changé), forcé à null pour tout
    // autre rôle même s'il n'a pas été envoyé — un utilisateur qui change de
    // rôle vers un rôle hors branche ne doit jamais conserver une branche
    // héritée d'un rôle précédent.
    const roleFinal: RoleUtilisateur = role ?? existant.role
    const brancheTypeFinal = !ROLES_BRANCHE.includes(roleFinal)
      ? null
      : brancheType !== undefined
        ? (brancheType ?? null)
        : existant.brancheType

    if (ROLES_BRANCHE.includes(roleFinal) && !brancheTypeFinal) {
      throw new BadRequestException('La branche est requise pour ce rôle')
    }

    const actifFinal = actif !== undefined ? actif : existant.actif
    if (actifFinal) {
      const conflitPoste = await this.conflitPosteUnique(paroisseId, roleFinal, brancheTypeFinal, id)
      if (conflitPoste) throw new ConflictException(conflitPoste)
    }

    let utilisateur
    try {
      utilisateur = await this.prisma.$transaction(async (tx) => {
        const u = await tx.utilisateur.update({
          where: { id },
          data: {
            ...(nom !== undefined ? { nom } : {}),
            ...(prenom !== undefined ? { prenom } : {}),
            ...(email !== undefined ? { email: emailNettoye || null } : {}),
            ...(role !== undefined ? { role } : {}),
            ...(actif !== undefined ? { actif } : {}),
            brancheType: brancheTypeFinal,
          },
          select: SELECTION_DETAIL,
        })

        if (scoutIdsUniques !== undefined) {
          // Remplacement intégral de l'ensemble des enfants rattachés (pas un
          // simple ajout) : un tableau vide détache tous les enfants existants.
          await tx.lienParentScout.deleteMany({
            where: { parentId: id, scout: { paroisseId }, scoutId: { notIn: scoutIdsUniques } },
          })
          if (scoutIdsUniques.length > 0) {
            await tx.lienParentScout.createMany({
              data: scoutIdsUniques.map((scoutId) => ({ parentId: id, scoutId })),
              skipDuplicates: true,
            })
          }
        }
        return u
      })
    } catch (erreur) {
      // Modification concurrente : la contrainte d'unicité en base a tranché.
      if (estErreurUnicite(erreur)) throw new ConflictException(MESSAGE_CONFLIT_MODIFICATION)
      throw erreur
    }

    // Un compte désactivé perd immédiatement ses sessions : sans cela, il
    // resterait connecté jusqu'au prochain rafraîchissement du jeton d'accès.
    if (actif === false || changeRole || brancheTypeFinal !== existant.brancheType) await this.auth.revoquerToutes(id)

    // Renvoyé avec le même champ `enfants` que le GET : sans ça, le cache
    // React Query (qui remplace la donnée en place après un PUT réussi)
    // perdrait les enfants rattachés jusqu'au prochain rechargement complet.
    const enfants = await this.enfantsDe(id, paroisseId)

    if (changeRole) {
      await this.audit.enregistrer({
        paroisseId,
        acteurId: session.id,
        action: 'UTILISATEUR_ROLE_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { ancienRole: existant.role, nouveauRole: role },
      })
    }
    if (actif !== undefined && actif !== existant.actif) {
      await this.audit.enregistrer({
        paroisseId,
        acteurId: session.id,
        action: actif ? 'UTILISATEUR_REACTIVE' : 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }

    return { ...utilisateur, enfants }
  }

  async desactiver(session: UtilisateurSession, id: string) {
    const paroisseId = paroisseIdRequise(session)

    if (id === session.id) throw new ForbiddenException('Vous ne pouvez pas vous désactiver vous-même')

    const existant = await this.prisma.utilisateur.findFirst({
      where: { id, paroisseId },
      select: { id: true, roleDistrict: true },
    })
    if (!existant) throw new NotFoundException('Utilisateur introuvable')

    // Cf. modifier() : un compte de l'équipe de district n'est pas désactivable ici.
    if (existant.roleDistrict) {
      throw new ForbiddenException(
        "Ce compte fait partie de l'équipe de district : son statut est géré par l'administration.",
      )
    }

    const utilisateur = await this.prisma.utilisateur.update({
      where: { id },
      data: { actif: false },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        actif: true,
        paroisseId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await this.auth.revoquerToutes(id)

    await this.audit.enregistrer({
      paroisseId,
      acteurId: session.id,
      action: 'UTILISATEUR_DESACTIVE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return utilisateur
  }

  // Règle de complexité déjà vérifiée par SchemaReinitialisationMotDePasse.
  async reinitialiserMotDePasse(session: UtilisateurSession, id: string, corps: CorpsReinitialisationMotDePasse) {
    const paroisseId = paroisseIdRequise(session)

    const existant = await this.prisma.utilisateur.findFirst({
      where: { id, paroisseId },
      select: { id: true, roleDistrict: true },
    })
    if (!existant) throw new NotFoundException('Utilisateur introuvable')

    // Un compte de l'équipe de district (roleDistrict renseigné) est géré par
    // l'administration plateforme / le district, pas par le Chef de Groupe.
    if (existant.roleDistrict && id !== session.id) {
      throw new ForbiddenException(
        "Ce compte fait partie de l'équipe de district : son mot de passe est géré par l'administration.",
      )
    }

    const passwordHache = await hash(corps.nouveauMotDePasse, 12)
    await this.prisma.utilisateur.update({
      where: { id },
      data: { password: passwordHache, doitChangerMotDePasse: true },
    })

    // L'ancien mot de passe a pu être compromis : toutes les sessions ouvertes
    // du compte sont fermées (y compris celle de l'appelant s'il agit sur
    // son propre compte).
    await this.auth.revoquerToutes(id)

    await this.audit.enregistrer({
      paroisseId,
      acteurId: session.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return { message: 'Mot de passe mis à jour' }
  }
}
