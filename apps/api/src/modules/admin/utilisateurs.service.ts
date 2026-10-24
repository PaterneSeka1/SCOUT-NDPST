import { genererMotDePasseTemporaire } from '../../auth/secret-temporaire'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { hash } from 'bcryptjs'
import { libelleRoleAvecFonction, ROLES_ASSIGNABLES_ADMIN, ROLES_BRANCHE } from '@scout/shared'
import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { AuthService } from '../../auth/auth.service'
import { logger } from '../../common/lib/logger'
import { envoyerEmailBienvenue } from '../../common/lib/notifications'
import { historiserMandat, listerMandats, verrouillerPoste } from '../utilisateurs/mandats'
import { conflitPosteUnique, estErreurUnicite } from '../utilisateurs/postes'
import {
  champsProfilModifies,
  donneesProfilPublic,
  profilPublicFinal,
  SELECTION_PROFIL_PUBLIC,
} from '../utilisateurs/profil-public'
import { urlConnexion } from './admin.utils'
import type {
  DonneesCreationUtilisateur,
  DonneesModificationUtilisateur,
  DonneesMotDePasseAdmin,
  FiltresUtilisateurs,
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
  editeurContenu: true,
  profilPublic: true,
  doitChangerMotDePasse: true,
  createdAt: true,
} as const

const SELECTION_DETAIL = {
  ...SELECTION_LISTE,
  ...SELECTION_PROFIL_PUBLIC,
  updatedAt: true,
} as const

export const MESSAGE_DERNIER_ADMINISTRATEUR =
  "Ce compte est le dernier administrateur actif : désignez d'abord un autre administrateur."

// Le compte quitte-t-il l'administration (rôle retiré ou désactivation) ?
function retireAdministrateur(
  avant: { role: string; actif: boolean },
  apres: { role: string; actif: boolean },
): boolean {
  return avant.role === 'ADMINISTRATEUR' && avant.actif && (apres.role !== 'ADMINISTRATEUR' || !apres.actif)
}

// Gestion de TOUS les comptes de l'installation par l'administrateur
// (ADMINISTRATEUR). Contrairement à /utilisateurs (maîtrise, Chef de Groupe),
// cette surface couvre aussi les comptes administrateurs.
@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // Le dernier administrateur actif ne peut jamais être rétrogradé ni
  // désactivé. Les comptes administrateurs actifs sont verrouillés (FOR
  // UPDATE, ordre stable) avant toute autre ligne : deux rétrogradations
  // croisées sont ainsi sérialisées, sans interblocage.
  private async verifierAutreAdministrateur(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const administrateurs = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Utilisateur"
      WHERE role = 'ADMINISTRATEUR' AND actif = true
      ORDER BY id
      FOR UPDATE`
    if (!administrateurs.some((admin) => admin.id !== id)) {
      throw new ConflictException(MESSAGE_DERNIER_ADMINISTRATEUR)
    }
  }

  private async trouverCible<S extends Prisma.UtilisateurSelect>(id: string, select: S) {
    const cible = await this.prisma.utilisateur.findUnique({ where: { id }, select })
    if (!cible) throw new NotFoundException('Utilisateur introuvable')
    return cible
  }

  // Filtres déjà validés et bornés par SchemaFiltresUtilisateurs.
  async lister(filtres: FiltresUtilisateurs) {
    const { page, limite, role, actif, brancheType, recherche } = filtres

    const where: Prisma.UtilisateurWhereInput = {
      ...(role ? { role } : {}),
      ...(actif !== undefined ? { actif } : {}),
      ...(brancheType ? { brancheType } : {}),
      ...(recherche
        ? {
            OR: [
              { nom: { contains: recherche, mode: 'insensitive' } },
              { prenom: { contains: recherche, mode: 'insensitive' } },
              { matricule: { contains: recherche, mode: 'insensitive' } },
              { telephone: { contains: recherche, mode: 'insensitive' } },
              { email: { contains: recherche, mode: 'insensitive' } },
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

    return { utilisateurs, total, page, totalPages: Math.max(1, Math.ceil(total / limite)) }
  }

  // Corps validé par SchemaCreationUtilisateur (champs requis, rôle
  // assignable, branche cohérente avec le rôle).
  async creer(donnees: DonneesCreationUtilisateur, acteurId: string) {
    const { nom, prenom, email, matricule, telephone, role, fonction, brancheType, editeurContenu } = donnees

    // Un compte est créé actif : il ne doit pas doubler un poste unique.
    const conflitPoste = await conflitPosteUnique(this.prisma, role, brancheType)
    if (conflitPoste) throw new ConflictException(conflitPoste)

    if (matricule) {
      const doublon = await this.prisma.utilisateur.findUnique({ where: { matricule }, select: { id: true } })
      if (doublon) throw new BadRequestException('Ce matricule est déjà utilisé')
    }
    if (telephone) {
      const doublon = await this.prisma.utilisateur.findUnique({ where: { telephone }, select: { id: true } })
      if (doublon) throw new BadRequestException('Ce numéro de téléphone est déjà utilisé')
    }
    if (email) {
      // Insensible à la casse : évite qu'un doublon "Jean@x.com" / "jean@x.com"
      // passe inaperçu, ce qui rendrait ensuite la réinitialisation par email ambiguë.
      const doublon = await this.prisma.utilisateur.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      })
      if (doublon) throw new BadRequestException('Cette adresse e-mail est déjà utilisée')
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
            email,
            matricule,
            telephone,
            role,
            fonction,
            brancheType,
            editeurContenu,
            password: passwordHache,
            doitChangerMotDePasse: true,
          },
          select: SELECTION_LISTE,
        })
        await historiserMandat(
          tx,
          null,
          { role, brancheType, actif: true },
          { utilisateurId: nouveau.id, auteurId: acteurId },
        )
        return nouveau
      })
    } catch (erreur) {
      // Création concurrente : la contrainte d'unicité en base a tranché.
      if (estErreurUnicite(erreur)) {
        throw new ConflictException(
          'Conflit avec un compte existant : matricule, téléphone, adresse e-mail ou poste unique déjà attribué.',
        )
      }
      throw erreur
    }

    await this.audit.enregistrer({
      acteurId,
      action: 'UTILISATEUR_CREE',
      entite: 'Utilisateur',
      entiteId: utilisateur.id,
      details: { role: utilisateur.role, brancheType: utilisateur.brancheType, editeurContenu },
    })

    if (utilisateur.email) {
      // Meilleur effort : un échec d'envoi ne doit jamais faire échouer la création du compte.
      envoyerEmailBienvenue({
        email: utilisateur.email,
        prenom: utilisateur.prenom,
        identifiant: utilisateur.matricule ?? utilisateur.telephone ?? utilisateur.email,
        roleLabel: libelleRoleAvecFonction(utilisateur.role, utilisateur.fonction, utilisateur.brancheType),
        nomSite: 'SCOUT ASCCI',
        urlConnexion: urlConnexion(),
      }).catch((error: unknown) => logger.error('admin.utilisateurs.email_bienvenue_echoue', error))
    }

    // Le secret temporaire n'est renvoyé qu'une seule fois, ici.
    return { ...utilisateur, motDePasseTemporaire }
  }

  async detail(id: string) {
    return this.trouverCible(id, SELECTION_DETAIL)
  }

  async mandats(id: string) {
    await this.trouverCible(id, { id: true })
    return listerMandats(this.prisma, id)
  }

  // Forme des champs validée par SchemaModificationUtilisateur ; les règles qui
  // dépendent du compte existant (rôle actuel, branche, dernier administrateur)
  // restent ici.
  async modifier(id: string, donnees: DonneesModificationUtilisateur, acteurId: string) {
    const existant = await this.trouverCible(id, {
      id: true,
      role: true,
      actif: true,
      fonction: true,
      brancheType: true,
      editeurContenu: true,
      ...SELECTION_PROFIL_PUBLIC,
    })
    const { nom, prenom, email, role, actif, fonction, brancheType, editeurContenu } = donnees

    // Un compte PARENT/SCOUT existant (espaces familles fermés) garde son rôle
    // tel quel, mais on n'y bascule personne.
    if (role !== undefined && role !== existant.role && !ROLES_ASSIGNABLES_ADMIN.includes(role)) {
      throw new BadRequestException('Rôle invalide')
    }

    const roleFinal = role ?? existant.role
    const actifFinal = actif ?? existant.actif

    // Un administrateur ne se retire jamais lui-même l'administration
    // (rôle ou désactivation) : il verrouillerait son propre accès.
    if (id === acteurId && retireAdministrateur(existant, { role: roleFinal, actif: actifFinal })) {
      throw new ForbiddenException('Vous ne pouvez pas retirer votre propre rôle administrateur ni vous désactiver')
    }

    // brancheType/fonction recalculés sur le RÔLE FINAL — un compte qui change
    // de rôle ne conserve jamais une branche héritée d'un rôle précédent.
    const estBrancheFinal = ROLES_BRANCHE.includes(roleFinal)
    const brancheTypeFinal = estBrancheFinal ? (brancheType !== undefined ? brancheType : existant.brancheType) : null
    if (estBrancheFinal && !brancheTypeFinal) throw new BadRequestException('La branche est requise pour ce rôle')

    // Profil public : refusé (400) s'il est demandé pour un rôle non éligible,
    // retiré d'office si le nouveau rôle ne l'est plus.
    const profilPublic = profilPublicFinal(roleFinal, donnees.profilPublic, existant.profilPublic)

    if (email) {
      const doublon = await this.prisma.utilisateur.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      })
      if (doublon) throw new BadRequestException('Cette adresse e-mail est déjà utilisée')
    }

    if (actifFinal) {
      const conflitPoste = await conflitPosteUnique(this.prisma, roleFinal, brancheTypeFinal, id)
      if (conflitPoste) throw new ConflictException(conflitPoste)
    }

    const avant = { role: existant.role, brancheType: existant.brancheType, actif: existant.actif }
    const apres = { role: roleFinal, brancheType: brancheTypeFinal, actif: actifFinal }
    const changeRole = roleFinal !== existant.role
    const changePoste = changeRole || brancheTypeFinal !== existant.brancheType

    let utilisateur
    try {
      utilisateur = await this.prisma.$transaction(async (tx) => {
        if (retireAdministrateur(avant, apres)) await this.verifierAutreAdministrateur(tx, id)
        await verrouillerPoste(tx, id, avant)

        const misAJour = await tx.utilisateur.update({
          where: { id },
          data: {
            ...(nom !== undefined ? { nom } : {}),
            ...(prenom !== undefined ? { prenom } : {}),
            // email et fonction arrivent déjà nettoyés (vide → null).
            ...(email !== undefined ? { email } : {}),
            ...(fonction !== undefined ? { fonction } : {}),
            ...(role !== undefined ? { role } : {}),
            ...(actif !== undefined ? { actif } : {}),
            ...(editeurContenu !== undefined ? { editeurContenu } : {}),
            ...donneesProfilPublic(donnees),
            profilPublic,
            brancheType: brancheTypeFinal,
          },
          select: SELECTION_DETAIL,
        })

        await historiserMandat(tx, avant, apres, { utilisateurId: id, auteurId: acteurId })

        // Compte désactivé ou changement de poste : ses sessions ouvertes sont
        // fermées immédiatement (editeurContenu est relu à chaque requête).
        if (actif === false || changePoste) await this.auth.revoquerToutes(id, tx)
        return misAJour
      })
    } catch (erreur) {
      // Modification concurrente : la contrainte d'unicité en base a tranché.
      if (estErreurUnicite(erreur)) {
        throw new ConflictException('Conflit avec un compte existant : adresse e-mail ou poste unique déjà attribué.')
      }
      throw erreur
    }

    if (changePoste) {
      await this.audit.enregistrer({
        acteurId,
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
    if (actifFinal !== existant.actif) {
      await this.audit.enregistrer({
        acteurId,
        action: actifFinal ? 'UTILISATEUR_REACTIVE' : 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }
    if (editeurContenu !== undefined && editeurContenu !== existant.editeurContenu) {
      await this.audit.enregistrer({
        acteurId,
        action: 'UTILISATEUR_EDITEUR_CONTENU_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { editeurContenu },
      })
    }
    const champsProfil = champsProfilModifies(existant, { ...donnees, profilPublic })
    if (champsProfil.length > 0) {
      await this.audit.enregistrer({
        acteurId,
        action: 'PROFIL_PUBLIC_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { champs: champsProfil, profilPublic },
      })
    }

    return utilisateur
  }

  // Désactivation (jamais de suppression physique d'un compte).
  async desactiver(id: string, acteurId: string) {
    if (id === acteurId) throw new ForbiddenException('Vous ne pouvez pas vous désactiver vous-même')

    const existant = await this.trouverCible(id, { id: true, role: true, brancheType: true, actif: true })
    const avant = { role: existant.role, brancheType: existant.brancheType, actif: existant.actif }
    const apres = { ...avant, actif: false }

    const utilisateur = await this.prisma.$transaction(async (tx) => {
      if (retireAdministrateur(avant, apres)) await this.verifierAutreAdministrateur(tx, id)
      await verrouillerPoste(tx, id, avant)
      const misAJour = await tx.utilisateur.update({
        where: { id },
        data: { actif: false },
        select: SELECTION_DETAIL,
      })
      await historiserMandat(tx, avant, apres, { utilisateurId: id, auteurId: acteurId })
      await this.auth.revoquerToutes(id, tx)
      return misAJour
    })

    if (existant.actif) {
      await this.audit.enregistrer({
        acteurId,
        action: 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }

    return utilisateur
  }

  async changerMotDePasse(id: string, { nouveauMotDePasse }: DonneesMotDePasseAdmin, acteurId: string) {
    await this.trouverCible(id, { id: true })

    const passwordHache = await hash(nouveauMotDePasse, 12)
    await this.prisma.utilisateur.update({
      where: { id },
      data: { password: passwordHache, doitChangerMotDePasse: true },
    })

    // L'ancien mot de passe a pu être compromis : toutes les sessions ouvertes
    // avec lui sont fermées.
    await this.auth.revoquerToutes(id)

    await this.audit.enregistrer({
      acteurId,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return { message: 'Mot de passe mis à jour' }
  }
}
