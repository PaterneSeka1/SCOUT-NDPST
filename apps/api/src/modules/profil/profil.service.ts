import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { compare, hash } from 'bcryptjs'
import { motDePasseValide, REGLE_MOT_DE_PASSE, ROLES_BRANCHE } from '@scout/shared'
import type { BrancheType, RoleUtilisateur } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { AuthService } from '../../auth/auth.service'
import { paroisseIdRequise } from '../../common/paroisse'
import type { UtilisateurSession } from '../../common/types'
import type { CorpsChangementMotDePasse, CorpsConsentement, CorpsModificationProfil } from './profil.schemas'

// Profil en libre-service : accessible à tout utilisateur authentifié, quel que
// soit son rôle (y compris ADMIN_PLATEFORME, dont paroisseId est toujours nul).
// `paroisse` est incluse via la relation Prisma : elle vaut naturellement
// `null` quand paroisseId est nul, aucune requête séparée n'est nécessaire.
const SELECTION_PROFIL = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  telephone: true,
  matricule: true,
  role: true,
  fonction: true,
  brancheType: true,
  roleDistrict: true,
  fonctionDistrict: true,
  brancheTypeDistrict: true,
  paroisse: { select: { id: true, nom: true } },
} as const

@Injectable()
export class ProfilService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async profil(session: UtilisateurSession) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: session.id },
      select: SELECTION_PROFIL,
    })
    if (!utilisateur) throw new NotFoundException('Utilisateur introuvable')
    return utilisateur
  }

  async modifierProfil(session: UtilisateurSession, corps: CorpsModificationProfil) {
    // Corps validé par SchemaModificationProfil : seuls les champs
    // auto-modifiables y figurent — role, actif, matricule et paroisseId
    // éventuellement envoyés par un client malveillant sont retirés.
    const { nom, prenom, email, telephone } = corps

    if (email != null && email.trim() !== '') {
      // Insensible à la casse, comme pour la route de gestion équivalente :
      // évite qu'un doublon "Jean@x.com" / "jean@x.com" passe inaperçu.
      const doublon = await this.prisma.utilisateur.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' }, NOT: { id: session.id } },
        select: { id: true },
      })
      if (doublon) throw new BadRequestException('Cette adresse e-mail est déjà utilisée')
    }

    if (telephone != null && telephone.trim() !== '') {
      const doublon = await this.prisma.utilisateur.findFirst({
        where: { telephone: telephone.trim(), NOT: { id: session.id } },
        select: { id: true },
      })
      if (doublon) throw new BadRequestException('Ce numéro de téléphone est déjà utilisé')
    }

    return this.prisma.utilisateur.update({
      where: { id: session.id },
      data: {
        ...(nom !== undefined ? { nom } : {}),
        ...(prenom !== undefined ? { prenom } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(telephone !== undefined ? { telephone: telephone?.trim() || null } : {}),
      },
      select: SELECTION_PROFIL,
    })
  }

  async branche(session: UtilisateurSession) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: session.id },
      select: { brancheType: true },
    })
    const brancheType = utilisateur?.brancheType ?? null
    const role = brancheType && session.role.includes('_BRANCHE') ? session.role.replace('_BRANCHE', '') : null
    return { brancheType, role }
  }

  // Différent de PUT /utilisateurs/:id/password (réinitialisation par le Chef
  // de Groupe) : ici l'appelant ne peut agir que sur son propre compte
  // (session.id, jamais un id transmis) et doit prouver qu'il connaît son mot
  // de passe actuel avant de le changer.
  async changerMotDePasse(session: UtilisateurSession, corps: CorpsChangementMotDePasse) {
    const { motDePasseActuel, nouveauMotDePasse } = corps

    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: session.id },
      select: { id: true, password: true },
    })
    if (!utilisateur) throw new NotFoundException('Utilisateur introuvable')

    if (!(await compare(motDePasseActuel, utilisateur.password))) {
      throw new BadRequestException('Mot de passe actuel incorrect')
    }

    if (!motDePasseValide(nouveauMotDePasse)) throw new BadRequestException(REGLE_MOT_DE_PASSE)

    const passwordHache = await hash(nouveauMotDePasse, 12)
    await this.prisma.utilisateur.update({ where: { id: session.id }, data: { password: passwordHache } })

    // Toutes les sessions du compte sont fermées, y compris la session
    // courante : l'utilisateur doit se reconnecter avec le nouveau mot de passe.
    await this.auth.revoquerToutes(session.id)

    await this.audit.enregistrer({
      paroisseId: session.paroisseId,
      acteurId: session.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_MODIFIE',
      entite: 'Utilisateur',
      entiteId: session.id,
    })

    return { message: 'Mot de passe mis à jour' }
  }

  async mesEnfants(session: UtilisateurSession) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: session.id },
      select: { id: true },
    })
    if (!utilisateur) throw new NotFoundException('Utilisateur introuvable')
    if (!session.paroisseId) throw new ForbiddenException('Accès refusé')

    const paroisseId = session.paroisseId

    const liens = await this.prisma.lienParentScout.findMany({
      where: { parentId: utilisateur.id, scout: { paroisseId } },
      include: {
        scout: {
          include: {
            presences: {
              include: { activite: { select: { titre: true, dateDebut: true, type: true } } },
              orderBy: { activite: { dateDebut: 'desc' } },
              take: 5,
            },
            presencesReunion: {
              include: {
                jourReunion: {
                  select: { id: true, titre: true, dateHeure: true, dateReportee: true, brancheType: true },
                },
              },
              orderBy: { jourReunion: { dateHeure: 'desc' } },
              take: 8,
            },
            _count: { select: { presences: true, presencesReunion: true } },
            cotisations: {
              orderBy: [{ statut: 'asc' }, { anneeScolaire: 'desc' }],
              select: {
                id: true,
                type: true,
                libelle: true,
                montant: true,
                anneeScolaire: true,
                statut: true,
                datePaiement: true,
              },
            },
          },
        },
      },
    })

    const enfants = liens.map((l) => l.scout)

    // Branches représentées parmi les enfants (responsables, camps, réunions).
    const branches: BrancheType[] = [...new Set(enfants.map((s) => s.brancheType))]

    // Camps à venir concernant chaque enfant, avec le statut de signature
    // (fiche médicale + autorisation parentale).
    const campsAVenir = await this.prisma.activite.findMany({
      where: {
        paroisseId,
        type: 'CAMP',
        dateDebut: { gte: new Date() },
        OR: [{ brancheType: null }, { brancheType: { in: branches } }],
      },
      orderBy: { dateDebut: 'asc' },
      select: {
        id: true,
        titre: true,
        dateDebut: true,
        lieu: true,
        brancheType: true,
        autorisationsCamp: {
          where: { scoutId: { in: enfants.map((s) => s.id) } },
          select: { scoutId: true, type: true, confirmeLe: true },
        },
      },
    })

    const campsParEnfant: Record<string, unknown[]> = {}
    for (const enfant of enfants) {
      campsParEnfant[enfant.id] = campsAVenir
        .filter((c) => !c.brancheType || c.brancheType === enfant.brancheType)
        .map((c) => {
          const confirmee = (type: string) =>
            c.autorisationsCamp.some((a) => a.scoutId === enfant.id && a.type === type && a.confirmeLe !== null)
          return {
            id: c.id,
            titre: c.titre,
            dateDebut: c.dateDebut,
            lieu: c.lieu,
            ficheMedicale: confirmee('FICHE_MEDICALE'),
            autorisationParentale: confirmee('AUTORISATION_PARENTALE'),
          }
        })
    }

    const responsablesUtilisateurs = await this.prisma.utilisateur.findMany({
      where: {
        paroisseId,
        brancheType: { in: branches },
        role: { in: ROLES_BRANCHE as RoleUtilisateur[] },
      },
      select: { id: true, nom: true, prenom: true, telephone: true, email: true, role: true, brancheType: true },
      orderBy: { role: 'asc' },
    })

    const responsables = responsablesUtilisateurs.map((u) => ({
      id: u.id,
      brancheType: u.brancheType,
      role: u.role,
      utilisateur: { id: u.id, prenom: u.prenom, nom: u.nom, telephone: u.telephone, email: u.email, role: u.role },
    }))

    // Prochaines activités de la paroisse.
    const prochaines = await this.prisma.activite.findMany({
      where: { paroisseId, dateDebut: { gte: new Date() } },
      orderBy: { dateDebut: 'asc' },
      take: 5,
      select: { id: true, titre: true, dateDebut: true, lieu: true, type: true, brancheType: true },
    })

    // Prochaines réunions (nom de champ `prochinesReunions` conservé : contrat
    // attendu par le frontend).
    const prochinesReunions = await this.prisma.jourReunion.findMany({
      where: {
        paroisseId,
        statut: { in: ['PLANIFIEE', 'REPORTEE'] },
        dateHeure: { gte: new Date() },
        ...(branches.length > 0 ? { OR: [{ brancheType: null }, { brancheType: { in: branches } }] } : {}),
      },
      orderBy: { dateHeure: 'asc' },
      take: 5,
      select: { id: true, titre: true, dateHeure: true, dateReportee: true, lieu: true, brancheType: true },
    })

    return { enfants, prochaines, prochinesReunions, responsables, campsParEnfant }
  }

  // Un parent accorde ou révoque le consentement à l'utilisation de l'image de
  // SON enfant (photo affichée dans l'application, publications de la
  // paroisse…). Restreint aux scouts effectivement rattachés au parent via
  // LienParentScout — jamais à un scout quelconque.
  async consentementImage(session: UtilisateurSession, scoutId: string, corps: CorpsConsentement) {
    const { consentement } = corps
    const paroisseId = paroisseIdRequise(session)

    // Le rôle du compte n'est jamais la condition d'accès : un membre du
    // staff ou un compte SCOUT (Ressources Adultes) peut être par ailleurs
    // parent d'un scout de la paroisse (voir LienParentScout). Seul le lien
    // réel fait foi — jamais un scout quelconque.
    const lien = await this.prisma.lienParentScout.findFirst({
      where: { parentId: session.id, scoutId, scout: { paroisseId } },
    })
    if (!lien) throw new ForbiddenException("Cet enfant n'est pas rattaché à votre compte")

    const scout = await this.prisma.scout.update({
      where: { id: scoutId },
      data: {
        consentementImage: consentement,
        consentementImageDate: consentement ? new Date() : null,
        consentementImageParId: consentement ? session.id : null,
      },
      select: { id: true, consentementImage: true, consentementImageDate: true },
    })

    await this.audit.enregistrer({
      paroisseId,
      acteurId: session.id,
      action: 'SCOUT_CONSENTEMENT_IMAGE_MODIFIE',
      entite: 'Scout',
      entiteId: scoutId,
      details: { consentementImage: consentement },
    })

    return scout
  }

  // Même règle que consentementImage, pour le consentement au traitement des
  // données de santé de l'enfant (fiche médicale, informations sanitaires).
  async consentementSante(session: UtilisateurSession, scoutId: string, corps: CorpsConsentement) {
    const { consentement } = corps
    const paroisseId = paroisseIdRequise(session)

    // Seul le lien LienParentScout réel fait foi, jamais le rôle du compte.
    const lien = await this.prisma.lienParentScout.findFirst({
      where: { parentId: session.id, scoutId, scout: { paroisseId } },
    })
    if (!lien) throw new ForbiddenException("Cet enfant n'est pas rattaché à votre compte")

    const scout = await this.prisma.scout.update({
      where: { id: scoutId },
      data: {
        consentementSante: consentement,
        consentementSanteDate: consentement ? new Date() : null,
        consentementSanteParId: consentement ? session.id : null,
      },
      select: { id: true, consentementSante: true, consentementSanteDate: true },
    })

    await this.audit.enregistrer({
      paroisseId,
      acteurId: session.id,
      action: 'SCOUT_CONSENTEMENT_SANTE_MODIFIE',
      entite: 'Scout',
      entiteId: scoutId,
      details: { consentementSante: consentement },
    })

    return scout
  }

  async maProgression(session: UtilisateurSession) {
    // Le scout est lié à un compte utilisateur.
    const scout = await this.prisma.scout.findFirst({
      where: { utilisateurId: session.id },
      include: {
        progressions: {
          include: {
            badge: true,
            validePar: { select: { nom: true, prenom: true } },
          },
          orderBy: { dateValidation: 'desc' },
        },
        presences: {
          include: { activite: { select: { id: true, titre: true, dateDebut: true, type: true } } },
          orderBy: { activite: { dateDebut: 'desc' } },
          take: 10,
        },
        _count: { select: { presences: true } },
      },
    })
    if (!scout) throw new NotFoundException('Aucun profil scout associé à ce compte')

    // Tous les badges de la branche pour calculer la progression.
    const badgesBranche = await this.prisma.badge.findMany({
      where: { brancheType: scout.brancheType },
      orderBy: { ordre: 'asc' },
    })

    // Prochaines activités concernant la branche du scout ou toute la paroisse.
    const prochainesActivites = await this.prisma.activite.findMany({
      where: {
        paroisseId: scout.paroisseId,
        dateDebut: { gte: new Date() },
        OR: [{ brancheType: null }, { brancheType: scout.brancheType }],
      },
      orderBy: { dateDebut: 'asc' },
      take: 5,
      select: { id: true, titre: true, dateDebut: true, lieu: true, type: true, brancheType: true },
    })

    // Dernières réunions (présences).
    const dernieresReunions = await this.prisma.presenceReunion.findMany({
      where: { scoutId: scout.id },
      include: {
        jourReunion: {
          select: { id: true, titre: true, dateHeure: true, dateReportee: true, brancheType: true },
        },
      },
      orderBy: { jourReunion: { dateHeure: 'desc' } },
      take: 10,
    })

    return { scout, badgesBranche, prochainesActivites, dernieresReunions }
  }
}
