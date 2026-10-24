import { genererMotDePasseTemporaire } from '../../auth/secret-temporaire'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { hash } from 'bcryptjs'
import {
  BrancheTypeSchema,
  LABELS_BRANCHES,
  LABELS_ROLES,
  ROLES_ASSIGNABLES_PAROISSE,
  ROLES_BRANCHE,
  ROLES_GROUPE_ETENDU,
  ROLES_TOUT_STAFF,
} from '@scout/shared'
import type { Prisma, RoleUtilisateur } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { AuthService } from '../../auth/auth.service'
import { envoyerEmailBienvenue } from '../../common/lib/notifications'
import { logger } from '../../common/lib/logger'
import { env } from '../../config/env'
import type { UtilisateurSession } from '../../common/types'
import { historiserMandat, listerMandats, verrouillerPoste } from './mandats'
import { conflitPosteUnique, estErreurUnicite } from './postes'
import { champsProfilModifies, donneesProfilPublic, profilPublicFinal, SELECTION_PROFIL_PUBLIC } from './profil-public'
import type {
  CorpsCreationUtilisateur,
  CorpsModificationUtilisateur,
  CorpsProfilPublic,
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
  fonction: true,
  brancheType: true,
  actif: true,
  createdAt: true,
} as const

const SELECTION_DETAIL = {
  ...SELECTION_LISTE,
  editeurContenu: true,
  ...SELECTION_PROFIL_PUBLIC,
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

const SELECTION_ORGANIGRAMME = {
  id: true,
  nom: true,
  prenom: true,
  role: true,
  fonction: true,
  brancheType: true,
  profilPublic: true,
} as const

// Les comptes ADMINISTRATEUR relèvent de l'administration (/admin/utilisateurs) :
// pour le Chef de Groupe, ils n'existent pas (404 plutôt que 403, pour ne pas
// révéler leur existence).
const CIBLE_MAITRISE = { role: { not: 'ADMINISTRATEUR' } } satisfies Prisma.UtilisateurWhereInput

const MESSAGE_CONFLIT_CREATION =
  'Conflit avec un compte existant : matricule, téléphone, adresse e-mail ou poste unique déjà attribué.'
const MESSAGE_CONFLIT_MODIFICATION = 'Conflit avec un compte existant : adresse e-mail ou poste unique déjà attribué.'

export interface FiltresListe {
  page?: string
  limite?: string
  role?: string
  recherche?: string
}

// Rang d'affichage dans l'organigramme (direction puis encadrement de branche).
function rangRole(role: string): number {
  const ordre = [...ROLES_GROUPE_ETENDU, ...ROLES_BRANCHE]
  const rang = ordre.indexOf(role)
  return rang === -1 ? ordre.length : rang
}

@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  private async trouverCible<S extends Prisma.UtilisateurSelect>(id: string, select: S) {
    const cible = await this.prisma.utilisateur.findFirst({ where: { id, ...CIBLE_MAITRISE }, select })
    if (!cible) throw new NotFoundException('Utilisateur introuvable')
    return cible
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
    // ROLES_ASSIGNABLES_PAROISSE exclut ADMINISTRATEUR.
    const roles = (filtres.role ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter((r) => ROLES_ASSIGNABLES_PAROISSE.includes(r))
    const recherche = filtres.recherche?.trim()

    const where: Prisma.UtilisateurWhereInput = {
      NOT: { id: session.id },
      role:
        roles.length === 1
          ? (roles[0] as RoleUtilisateur)
          : roles.length > 1
            ? { in: roles as RoleUtilisateur[] }
            : CIBLE_MAITRISE.role,
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

  // Organigramme de la maîtrise : comptes actifs, direction du groupe puis
  // encadrement par branche (toutes les branches, même sans encadrement).
  async maitrise() {
    const membres = await this.prisma.utilisateur.findMany({
      where: { actif: true, role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] } },
      select: SELECTION_ORGANIGRAMME,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })
    const tries = [...membres].sort((a, b) => rangRole(a.role) - rangRole(b.role))

    return {
      direction: tries.filter((m) => ROLES_GROUPE_ETENDU.includes(m.role)),
      branches: BrancheTypeSchema.options.map((brancheType) => ({
        brancheType,
        libelle: LABELS_BRANCHES[brancheType] ?? brancheType,
        membres: tries.filter((m) => ROLES_BRANCHE.includes(m.role) && m.brancheType === brancheType),
      })),
    }
  }

  // Forme, rôle (valeur connue), branche et enfants déjà validés par
  // SchemaCreationUtilisateur ; restent ici les règles d'attribution.
  async creer(session: UtilisateurSession, corps: CorpsCreationUtilisateur) {
    const { nom, prenom, role, email, matricule, telephone, brancheType, scoutIds: scoutIdsUniques } = corps

    // ADMINISTRATEUR n'est jamais attribuable ici (gestion par l'administration),
    // ni PARENT/SCOUT tant que les espaces familles sont fermés.
    if (!ROLES_ASSIGNABLES_PAROISSE.includes(role)) throw new BadRequestException('Rôle invalide')

    // brancheType n'a de sens que pour l'encadrement de branche : requis pour
    // ces rôles, forcé à null pour tout autre rôle même si envoyé par erreur.
    if (ROLES_BRANCHE.includes(role) && !brancheType) {
      throw new BadRequestException('La branche est requise pour ce rôle')
    }
    const brancheTypeFinal = ROLES_BRANCHE.includes(role) ? (brancheType ?? null) : null

    const estParent = role === 'PARENT'

    // Un compte staff peut tout autant être parent d'un scout qu'un compte
    // PARENT dédié : le rattachement à des enfants n'est jamais limité à un
    // rôle particulier (scoutIds, déjà dédoublonnés par le schéma).
    if (estParent && !telephone?.trim()) {
      throw new BadRequestException('Le numéro de téléphone est requis pour un parent')
    }
    if (!estParent && !matricule?.trim()) {
      throw new BadRequestException('Le matricule est requis')
    }

    // Un compte est créé actif : il ne doit pas doubler un poste unique.
    const conflitPoste = await conflitPosteUnique(this.prisma, role, brancheTypeFinal)
    if (conflitPoste) throw new ConflictException(conflitPoste)

    if (scoutIdsUniques.length > 0) {
      const scoutsTrouves = await this.prisma.scout.count({ where: { id: { in: scoutIdsUniques } } })
      if (scoutsTrouves !== scoutIdsUniques.length) {
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
          },
          select: SELECTION_LISTE,
        })

        if (scoutIdsUniques.length > 0) {
          await tx.lienParentScout.createMany({
            data: scoutIdsUniques.map((scoutId) => ({ parentId: nouveau.id, scoutId })),
            skipDuplicates: true,
          })
        }

        await historiserMandat(
          tx,
          null,
          { role, brancheType: brancheTypeFinal, actif: true },
          { utilisateurId: nouveau.id, auteurId: session.id },
        )
        return nouveau
      })
    } catch (erreur) {
      // Création concurrente : la contrainte d'unicité en base a tranché.
      if (estErreurUnicite(erreur)) throw new ConflictException(MESSAGE_CONFLIT_CREATION)
      throw erreur
    }

    await this.audit.enregistrer({
      acteurId: session.id,
      action: 'UTILISATEUR_CREE',
      entite: 'Utilisateur',
      entiteId: utilisateur.id,
      details: { role: utilisateur.role, brancheType: utilisateur.brancheType, scoutIds: scoutIdsUniques },
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

    // Le secret temporaire n'est renvoyé qu'une seule fois, ici.
    return { ...utilisateur, motDePasseTemporaire }
  }

  private async enfantsDe(parentId: string) {
    const liens = await this.prisma.lienParentScout.findMany({
      where: { parentId },
      select: { scout: { select: SELECTION_ENFANT } },
    })
    return liens.map((lien) => lien.scout)
  }

  async detail(id: string) {
    const { liensParent, ...reste } = await this.trouverCible(id, {
      ...SELECTION_DETAIL,
      liensParent: { select: { scout: { select: SELECTION_ENFANT } } },
    })
    return { ...reste, enfants: liensParent.map((lien) => lien.scout) }
  }

  async mandats(id: string) {
    await this.trouverCible(id, { id: true })
    return listerMandats(this.prisma, id)
  }

  // Forme déjà validée par SchemaModificationUtilisateur ; restent ici la
  // hiérarchie des rôles, la branche requise et les conflits de poste.
  async modifier(session: UtilisateurSession, id: string, corps: CorpsModificationUtilisateur) {
    const existant = await this.trouverCible(id, {
      id: true,
      role: true,
      actif: true,
      brancheType: true,
      profilPublic: true,
    })

    // undefined = champ non envoyé, ne touche pas aux enfants rattachés ;
    // tableau (même vide) = remplace intégralement la liste.
    const { role, nom, prenom, email, actif, brancheType, scoutIds: scoutIdsUniques } = corps

    if (scoutIdsUniques && scoutIdsUniques.length > 0) {
      const scoutsTrouves = await this.prisma.scout.count({ where: { id: { in: scoutIdsUniques } } })
      if (scoutsTrouves !== scoutIdsUniques.length) {
        throw new BadRequestException('Un ou plusieurs enfants sélectionnés sont introuvables')
      }
    }

    const changeRole = role !== undefined && role !== existant.role

    // Personne ne peut changer son propre rôle ou se désactiver soi-même —
    // sans quoi un compte connaissant son propre id pourrait s'auto-promouvoir
    // ou verrouiller son propre accès.
    if (id === session.id && (changeRole || actif === false)) {
      throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle ou vous désactiver')
    }

    // ADMINISTRATEUR, et PARENT/SCOUT tant que les espaces familles sont
    // fermés, ne sont pas attribuables ici ; un compte existant garde toutefois son rôle.
    if (changeRole && !ROLES_ASSIGNABLES_PAROISSE.includes(role)) throw new BadRequestException('Rôle invalide')

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
    // autre rôle — un compte qui quitte un rôle de branche ne conserve jamais
    // la branche héritée.
    const roleFinal: RoleUtilisateur = role ?? existant.role
    const brancheTypeFinal = !ROLES_BRANCHE.includes(roleFinal)
      ? null
      : brancheType !== undefined
        ? (brancheType ?? null)
        : existant.brancheType

    if (ROLES_BRANCHE.includes(roleFinal) && !brancheTypeFinal) {
      throw new BadRequestException('La branche est requise pour ce rôle')
    }

    const actifFinal = actif ?? existant.actif
    if (actifFinal) {
      const conflitPoste = await conflitPosteUnique(this.prisma, roleFinal, brancheTypeFinal, id)
      if (conflitPoste) throw new ConflictException(conflitPoste)
    }

    // Un rôle non éligible (PARENT/SCOUT) ne garde jamais un profil public.
    const profilPublic = profilPublicFinal(roleFinal, undefined, existant.profilPublic)
    const changePoste = changeRole || brancheTypeFinal !== existant.brancheType
    const avant = { role: existant.role, brancheType: existant.brancheType, actif: existant.actif }

    let utilisateur
    try {
      utilisateur = await this.prisma.$transaction(async (tx) => {
        await verrouillerPoste(tx, id, avant)

        const u = await tx.utilisateur.update({
          where: { id },
          data: {
            ...(nom !== undefined ? { nom } : {}),
            ...(prenom !== undefined ? { prenom } : {}),
            ...(email !== undefined ? { email: emailNettoye || null } : {}),
            ...(role !== undefined ? { role } : {}),
            ...(actif !== undefined ? { actif } : {}),
            ...(profilPublic !== existant.profilPublic ? { profilPublic } : {}),
            brancheType: brancheTypeFinal,
          },
          select: SELECTION_DETAIL,
        })

        if (scoutIdsUniques !== undefined) {
          // Remplacement intégral de l'ensemble des enfants rattachés (pas un
          // simple ajout) : un tableau vide détache tous les enfants existants.
          await tx.lienParentScout.deleteMany({ where: { parentId: id, scoutId: { notIn: scoutIdsUniques } } })
          if (scoutIdsUniques.length > 0) {
            await tx.lienParentScout.createMany({
              data: scoutIdsUniques.map((scoutId) => ({ parentId: id, scoutId })),
              skipDuplicates: true,
            })
          }
        }

        await historiserMandat(
          tx,
          avant,
          { role: roleFinal, brancheType: brancheTypeFinal, actif: actifFinal },
          { utilisateurId: id, auteurId: session.id },
        )

        // Un compte désactivé ou dont le poste change perd immédiatement ses
        // sessions : sans cela, il garderait ses droits jusqu'au prochain
        // rafraîchissement du jeton d'accès.
        if (actif === false || changePoste) await this.auth.revoquerToutes(id, tx)
        return u
      })
    } catch (erreur) {
      // Modification concurrente : la contrainte d'unicité en base a tranché.
      if (estErreurUnicite(erreur)) throw new ConflictException(MESSAGE_CONFLIT_MODIFICATION)
      throw erreur
    }

    // Renvoyé avec le même champ `enfants` que le GET : sans ça, le cache
    // React Query (qui remplace la donnée en place après un PUT réussi)
    // perdrait les enfants rattachés jusqu'au prochain rechargement complet.
    const enfants = await this.enfantsDe(id)

    if (changePoste) {
      await this.audit.enregistrer({
        acteurId: session.id,
        action: 'UTILISATEUR_ROLE_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: {
          ancienRole: existant.role,
          nouveauRole: roleFinal,
          ancienneBranche: existant.brancheType,
          nouvelleBranche: brancheTypeFinal,
        },
      })
    }
    if (actif !== undefined && actif !== existant.actif) {
      await this.audit.enregistrer({
        acteurId: session.id,
        action: actif ? 'UTILISATEUR_REACTIVE' : 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }

    return { ...utilisateur, enfants }
  }

  async desactiver(session: UtilisateurSession, id: string) {
    if (id === session.id) throw new ForbiddenException('Vous ne pouvez pas vous désactiver vous-même')

    const existant = await this.trouverCible(id, { id: true, role: true, brancheType: true, actif: true })
    const avant = { role: existant.role, brancheType: existant.brancheType, actif: existant.actif }

    const utilisateur = await this.prisma.$transaction(async (tx) => {
      await verrouillerPoste(tx, id, avant)
      const u = await tx.utilisateur.update({
        where: { id },
        data: { actif: false },
        select: SELECTION_DETAIL,
      })
      await historiserMandat(tx, avant, { ...avant, actif: false }, { utilisateurId: id, auteurId: session.id })
      await this.auth.revoquerToutes(id, tx)
      return u
    })

    if (existant.actif) {
      await this.audit.enregistrer({
        acteurId: session.id,
        action: 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }

    return utilisateur
  }

  // Règle de complexité déjà vérifiée par SchemaReinitialisationMotDePasse.
  async reinitialiserMotDePasse(session: UtilisateurSession, id: string, corps: CorpsReinitialisationMotDePasse) {
    await this.trouverCible(id, { id: true })

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
      acteurId: session.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return { message: 'Mot de passe mis à jour' }
  }

  // Profil public (page « Notre équipe ») : Chef de Groupe (comptes de la
  // maîtrise) ou administrateur (tout compte éligible).
  async modifierProfilPublic(session: UtilisateurSession, id: string, corps: CorpsProfilPublic) {
    const where = session.role === 'ADMINISTRATEUR' ? { id } : { id, ...CIBLE_MAITRISE }
    const existant = await this.prisma.utilisateur.findFirst({
      where,
      select: { id: true, role: true, ...SELECTION_PROFIL_PUBLIC },
    })
    if (!existant) throw new NotFoundException('Utilisateur introuvable')

    const profilPublic = profilPublicFinal(existant.role, corps.profilPublic, existant.profilPublic)
    const champs = champsProfilModifies(existant, { ...corps, profilPublic })

    const utilisateur = await this.prisma.utilisateur.update({
      where: { id },
      data: { ...donneesProfilPublic(corps), profilPublic },
      select: { id: true, nom: true, prenom: true, role: true, brancheType: true, ...SELECTION_PROFIL_PUBLIC },
    })

    if (champs.length > 0) {
      await this.audit.enregistrer({
        acteurId: session.id,
        action: 'PROFIL_PUBLIC_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { champs, profilPublic },
      })
    }

    return utilisateur
  }
}
