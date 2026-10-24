import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  BrancheTypeSchema,
  ROLES_BRANCHE,
  ROLES_TOUT_STAFF,
  StatutActiviteSchema,
  TypeActiviteSchema,
  entierBorne,
} from '@scout/shared'
import { BrancheType, Prisma, RoleUtilisateur } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AccesFichiersService } from '../../common/acces-fichiers.service'
import { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import type {
  CorpsConfirmationAutorisation,
  CorpsCreationActivite,
  CorpsModificationActivite,
  CorpsPresencesActivite,
  CorpsRetraitAutorisation,
} from './activites.schemas'

export interface FiltresActivites {
  page: string | null
  limite: string | null
  recherche: string | null
  type: string | null
  statut: string | null
  brancheType: string | null
  aVenir: string | null
}

// Inclus dans les listes et le détail : nombre de présences et responsable
// désigné (identité minimale, jamais le compte complet).
const AVEC_NOMBRE_PRESENCES = {
  _count: { select: { presences: true } },
  responsable: { select: { id: true, nom: true, prenom: true, role: true, brancheType: true } },
} as const

const SELECTION_SCOUT_PRESENCE = {
  id: true,
  nom: true,
  prenom: true,
  matricule: true,
  brancheType: true,
} as const

@Injectable()
export class ActivitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
    private readonly fichiers: AccesFichiersService,
  ) {}

  // ---------------------------------------------------------------------------
  // Liste et création
  // ---------------------------------------------------------------------------

  async lister(utilisateur: UtilisateurSession, filtres: FiltresActivites) {
    const page = entierBorne(filtres.page, 1, 1, Number.MAX_SAFE_INTEGER)
    const limite = entierBorne(filtres.limite, 20, 1, 100)
    const decalage = (page - 1) * limite
    const recherche = filtres.recherche ?? ''
    const type = filtres.type ?? ''
    const brancheType = filtres.brancheType ?? ''
    const statut = filtres.statut ?? ''

    const typeValide = TypeActiviteSchema.safeParse(type)
    if (type && !typeValide.success) {
      throw new BadRequestException("Type d'activité invalide")
    }
    const statutValide = StatutActiviteSchema.safeParse(statut)
    if (statut && !statutValide.success) {
      throw new BadRequestException("Statut d'activité invalide")
    }

    const conditions: Prisma.ActiviteWhereInput[] = []

    // Les responsables de branche ne voient que leur branche + les activités
    // inter-branches (brancheType null) — toute valeur "brancheType" fournie
    // par le client est ignorée pour ce groupe de rôles.
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que toutes les branches par défaut.
      if (!bt) {
        return { activites: [], pagination: { page, limite, total: 0, totalPages: 0 } }
      }
      conditions.push({ OR: [{ brancheType: bt as BrancheType }, { brancheType: null }] })
    } else if (brancheType) {
      const brancheValide = BrancheTypeSchema.safeParse(brancheType)
      if (!brancheValide.success) throw new BadRequestException('Branche invalide')
      conditions.push({ brancheType: brancheValide.data })
    }

    // Le scoping de branche ci-dessus et la recherche sont combinés en AND
    // plutôt que de s'écraser l'un l'autre.
    if (recherche) {
      conditions.push({
        OR: [
          { titre: { contains: recherche, mode: 'insensitive' } },
          { lieu: { contains: recherche, mode: 'insensitive' } },
        ],
      })
    }
    if (type && typeValide.success) conditions.push({ type: typeValide.data })
    if (statut && statutValide.success) conditions.push({ statut: statutValide.data })

    // `?aVenir=1` : uniquement les activités à venir, de la plus proche à la
    // plus lointaine (par défaut : toutes, de la plus récente à la plus ancienne).
    const aVenir = filtres.aVenir === '1'
    if (aVenir) conditions.push({ dateDebut: { gte: new Date() } })

    const where: Prisma.ActiviteWhereInput = { AND: conditions }

    const [activites, total] = await Promise.all([
      this.prisma.activite.findMany({
        where,
        include: AVEC_NOMBRE_PRESENCES,
        orderBy: { dateDebut: aVenir ? 'asc' : 'desc' },
        skip: decalage,
        take: limite,
      }),
      this.prisma.activite.count({ where }),
    ])

    return {
      activites,
      pagination: { page, limite, total, totalPages: Math.ceil(total / limite) },
    }
  }

  // Le responsable désigné d'une activité doit être un compte actif de la
  // maîtrise (staff du groupe ou de branche) : jamais un parent, un scout ni
  // un compte d'administration technique. null = aucun responsable.
  private async verifierResponsable(responsableId: string | null | undefined): Promise<void> {
    if (!responsableId) return
    const responsable = await this.prisma.utilisateur.findFirst({
      where: { id: responsableId, actif: true, role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] } },
      select: { id: true },
    })
    if (!responsable) throw new BadRequestException('Responsable invalide : compte actif de la maîtrise requis')
  }

  // Corps déjà validé par SchemaCreationActivite (forme, dates, enums).
  async creer(utilisateur: UtilisateurSession, corps: CorpsCreationActivite) {
    if (!ROLES_TOUT_STAFF.includes(utilisateur.role)) throw new ForbiddenException('Accès refusé')

    const {
      titre,
      description,
      dateDebut,
      dateFin,
      lieu,
      type,
      brancheType,
      statut,
      bilan,
      publique,
      descriptionPublique,
      responsableId,
    } = corps

    let brancheEffective: BrancheType | null = brancheType ?? null
    // Un responsable de branche ne peut créer une activité que pour sa propre
    // branche — décider d'une activité inter-branches (brancheType null) reste
    // une décision du groupe.
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      brancheEffective = bt as BrancheType
    }

    await this.verifierResponsable(responsableId)

    return this.prisma.activite.create({
      data: {
        titre,
        description: description ?? null,
        dateDebut,
        dateFin,
        lieu: lieu ?? null,
        type: type ?? 'REUNION',
        brancheType: brancheEffective,
        statut: statut ?? 'PREVUE',
        bilan: bilan ?? null,
        // Jamais publique sans demande explicite (publique === true).
        publique: publique === true,
        descriptionPublique: descriptionPublique ?? null,
        responsableId: responsableId ?? null,
        creePar: utilisateur.id,
      },
      include: AVEC_NOMBRE_PRESENCES,
    })
  }

  // ---------------------------------------------------------------------------
  // Détail, modification, suppression
  // ---------------------------------------------------------------------------

  // Branche imposée à un rôle de branche (sa branche ou inter-branches), ou
  // undefined pour le groupe. Compte de branche sans branche assignée : 404.
  private async filtreBrancheLecture(utilisateur: UtilisateurSession): Promise<Prisma.ActiviteWhereInput> {
    if (!ROLES_BRANCHE.includes(utilisateur.role)) return {}
    const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
    if (!bt) throw new NotFoundException('Activité introuvable')
    return { OR: [{ brancheType: bt as BrancheType }, { brancheType: null }] }
  }

  async detail(utilisateur: UtilisateurSession, id: string) {
    const filtreBranche = await this.filtreBrancheLecture(utilisateur)

    const activite = await this.prisma.activite.findFirst({
      where: { id, ...filtreBranche },
      include: AVEC_NOMBRE_PRESENCES,
    })
    if (!activite) throw new NotFoundException('Activité introuvable')
    return activite
  }

  async modifier(utilisateur: UtilisateurSession, id: string, corps: CorpsModificationActivite) {
    // Un responsable de branche ne peut modifier que les activités de sa propre
    // branche (ou inter-branches), et ne peut pas déplacer une activité vers
    // une autre branche.
    const estBranche = ROLES_BRANCHE.includes(utilisateur.role)
    const filtreBranche = await this.filtreBrancheLecture(utilisateur)

    const existante = await this.prisma.activite.findFirst({ where: { id, ...filtreBranche } })
    if (!existante) throw new NotFoundException('Activité introuvable')

    const {
      titre,
      description,
      dateDebut,
      dateFin,
      lieu,
      type,
      brancheType,
      statut,
      bilan,
      publique,
      descriptionPublique,
      responsableId,
    } = corps
    // brancheType : undefined = inchangée, null = inter-branches.
    if (estBranche && brancheType !== undefined && brancheType !== existante.brancheType) {
      throw new ForbiddenException('Le changement de branche est réservé au groupe')
    }

    const dateDebutFinale = dateDebut ?? existante.dateDebut
    const dateFinFinale = dateFin !== undefined ? dateFin : existante.dateFin
    if (dateFinFinale && dateFinFinale <= dateDebutFinale) {
      throw new BadRequestException('La date de fin doit être après la date de début')
    }

    // Publication explicite uniquement, avec un texte destiné au public
    // (jamais la description interne).
    const publiqueFinale = publique ?? existante.publique
    const descriptionPubliqueFinale =
      descriptionPublique !== undefined ? descriptionPublique : existante.descriptionPublique
    if (publiqueFinale && !descriptionPubliqueFinale) {
      throw new BadRequestException('Une description publique est requise pour publier une activité')
    }

    await this.verifierResponsable(responsableId)

    return this.prisma.activite.update({
      where: { id },
      data: {
        ...(titre !== undefined && { titre }),
        ...(description !== undefined && { description }),
        ...(dateDebut !== undefined && { dateDebut }),
        ...(dateFin !== undefined && { dateFin }),
        ...(lieu !== undefined && { lieu }),
        ...(type !== undefined && { type }),
        ...(brancheType !== undefined && { brancheType }),
        ...(statut !== undefined && { statut }),
        ...(bilan !== undefined && { bilan }),
        ...(publique !== undefined && { publique }),
        ...(descriptionPublique !== undefined && { descriptionPublique }),
        ...(responsableId !== undefined && { responsableId }),
      },
      include: AVEC_NOMBRE_PRESENCES,
    })
  }

  async supprimer(utilisateur: UtilisateurSession, id: string) {
    const existante = await this.prisma.activite.findFirst({ where: { id } })
    if (!existante) throw new NotFoundException('Activité introuvable')

    const peutSupprimer = existante.creePar === utilisateur.id || utilisateur.role === 'CHEF_GROUPE'
    if (!peutSupprimer) throw new ForbiddenException('Non autorisé')

    // Les autorisations de camp sont supprimées en cascade : leurs documents
    // signés ne doivent pas rester dans le stockage.
    const documents = await this.prisma.autorisationCamp.findMany({
      where: { activiteId: id, documentUrl: { not: null } },
      select: { documentUrl: true },
    })
    await this.prisma.activite.delete({ where: { id } })
    for (const { documentUrl } of documents) await this.fichiers.supprimerSiOrphelin(documentUrl)
    return { message: 'Activité supprimée' }
  }

  // ---------------------------------------------------------------------------
  // Autorisations de camp (fiche médicale, autorisation parentale)
  // ---------------------------------------------------------------------------

  private async peutAgirSurScout(
    utilisateur: UtilisateurSession,
    scoutId: string,
    scoutBranche: string,
  ): Promise<boolean> {
    if (ROLES_TOUT_STAFF.includes(utilisateur.role)) {
      // Un responsable de branche ne peut agir que sur les scouts de sa propre branche.
      if (ROLES_BRANCHE.includes(utilisateur.role)) {
        const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
        return bt === scoutBranche
      }
      return true
    }
    // Le rôle n'est jamais la condition d'accès pour un lien de parenté : un
    // compte staff ou SCOUT (Ressources Adultes) par ailleurs parent d'un
    // scout du groupe (LienParentScout) peut agir sur les autorisations
    // de camp de cet enfant, au même titre qu'un compte PARENT dédié.
    const lien = await this.prisma.lienParentScout.findFirst({
      where: { parentId: utilisateur.id, scoutId },
    })
    return !!lien
  }

  async confirmerAutorisation(
    utilisateur: UtilisateurSession,
    activiteId: string,
    corps: CorpsConfirmationAutorisation,
  ) {
    const activite = await this.prisma.activite.findFirst({ where: { id: activiteId } })
    if (!activite) throw new NotFoundException('Activité introuvable')
    if (activite.type !== 'CAMP') {
      throw new BadRequestException('Cette confirmation ne concerne que les activités de type Camp')
    }

    // Présence du document et chemin local déjà vérifiés par SchemaConfirmationAutorisation.
    const { scoutId, type, parDocument, documentUrl: urlDocument, documentNomFichier: nomDocument } = corps

    const scout = await this.prisma.scout.findFirst({ where: { id: scoutId } })
    if (!scout) throw new NotFoundException('Scout introuvable')

    if (!(await this.peutAgirSurScout(utilisateur, scoutId, scout.brancheType))) {
      throw new ForbiddenException('Accès refusé')
    }
    if (parDocument) await this.fichiers.verifierRattachable(utilisateur, urlDocument, scoutId)

    const confirmation = {
      confirmeLe: new Date(),
      confirmeParId: utilisateur.id,
      documentUrl: parDocument ? urlDocument : null,
      documentNomFichier: parDocument ? nomDocument : null,
    }
    const precedente = await this.prisma.autorisationCamp.findUnique({
      where: { activiteId_scoutId_type: { activiteId, scoutId, type } },
      select: { documentUrl: true },
    })
    const autorisation = await this.prisma.autorisationCamp.upsert({
      where: { activiteId_scoutId_type: { activiteId, scoutId, type } },
      create: { activiteId, scoutId, type, ...confirmation },
      update: confirmation,
    })
    if (precedente?.documentUrl && precedente.documentUrl !== confirmation.documentUrl) {
      await this.fichiers.supprimerSiOrphelin(precedente.documentUrl)
    }
    return autorisation
  }

  async retirerAutorisation(utilisateur: UtilisateurSession, activiteId: string, corps: CorpsRetraitAutorisation) {
    const activite = await this.prisma.activite.findFirst({ where: { id: activiteId } })
    if (!activite) throw new NotFoundException('Activité introuvable')

    const { scoutId, type } = corps

    const existante = await this.prisma.autorisationCamp.findFirst({
      where: { activiteId, scoutId, type },
      include: { scout: { select: { brancheType: true } } },
    })
    if (!existante) throw new NotFoundException('Autorisation introuvable')

    // L'auteur d'origine peut toujours retirer sa propre confirmation (ex. un
    // parent qui se rend compte d'une erreur) ; sinon, même cloisonnement par
    // branche que pour la création (voir peutAgirSurScout ci-dessus).
    const estAuteur = existante.confirmeParId === utilisateur.id
    const autorise = estAuteur || (await this.peutAgirSurScout(utilisateur, scoutId, existante.scout.brancheType))
    if (!autorise) throw new ForbiddenException('Accès refusé')

    await this.prisma.autorisationCamp.delete({ where: { id: existante.id } })
    await this.fichiers.supprimerSiOrphelin(existante.documentUrl)
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Présences
  // ---------------------------------------------------------------------------

  // Charge une activité et vérifie qu'un responsable de branche
  // n'accède qu'à une activité de sa propre branche (une activité sans branche
  // = inter-branches, ouverte à tout le staff).
  private async activitePourPresences(utilisateur: UtilisateurSession, id: string) {
    const activite = await this.prisma.activite.findFirst({ where: { id } })
    if (!activite) throw new NotFoundException('Activité introuvable')

    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      if (activite.brancheType && activite.brancheType !== bt) {
        throw new ForbiddenException('Accès refusé à cette activité')
      }
    }
    return activite
  }

  async listerPresences(utilisateur: UtilisateurSession, id: string) {
    const activite = await this.activitePourPresences(utilisateur, id)

    // Pour les camps, on indique en plus si le parent a signé (fiche médicale +
    // autorisation) pour CE camp précis (information seule, non bloquant — la
    // décision de présence reste humaine).
    const estCamp = activite.type === 'CAMP'
    const autorisations = estCamp
      ? await this.prisma.autorisationCamp.findMany({
          where: { activiteId: id },
          select: { scoutId: true, type: true, confirmeLe: true },
        })
      : []

    function avecAutorisationCamp<T extends { id: string }>(scout: T) {
      if (!estCamp) return scout
      const confirmee = (type: string) =>
        autorisations.some((a) => a.scoutId === scout.id && a.type === type && a.confirmeLe !== null)
      return {
        ...scout,
        autorisationCamp: {
          ficheMedicale: confirmee('FICHE_MEDICALE'),
          autorisationParentale: confirmee('AUTORISATION_PARENTALE'),
        },
      }
    }

    const presences = await this.prisma.presence.findMany({
      where: { activiteId: id },
      include: { scout: { select: SELECTION_SCOUT_PRESENCE } },
      orderBy: { scout: { nom: 'asc' } },
    })

    // Si aucune présence n'existe encore, retourner tous les scouts de la branche concernée
    if (presences.length === 0) {
      const scouts = await this.prisma.scout.findMany({
        where: { actif: true, ...(activite.brancheType ? { brancheType: activite.brancheType } : {}) },
        select: SELECTION_SCOUT_PRESENCE,
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      })
      return scouts.map((scout) => ({
        id: null,
        present: false,
        commentaire: null,
        scout: avecAutorisationCamp(scout),
      }))
    }

    return presences.map((p) => ({ ...p, scout: avecAutorisationCamp(p.scout) }))
  }

  async enregistrerPresences(utilisateur: UtilisateurSession, id: string, corps: CorpsPresencesActivite) {
    // Cf. listerPresences : un responsable de branche ne peut enregistrer les
    // présences que d'une activité de sa propre branche (ou inter-branches).
    const activite = await this.activitePourPresences(utilisateur, id)

    const lignes = corps.presences

    // Seuls les scouts appartenant à la branche de l'activité
    // (tous pour une activité inter-branches, comme la liste du GET) peuvent
    // être pointés — plus ceux déjà pointés sur cette activité, qui ont pu
    // changer de branche depuis. Empêche d'écrire une présence pour un scout
    // inexistant ou d'une autre branche.
    const scoutIds = [...new Set(lignes.map((p) => p.scoutId))]
    const autorises = await this.prisma.scout.findMany({
      where: {
        id: { in: scoutIds },
        OR: [
          activite.brancheType ? { brancheType: activite.brancheType } : {},
          { presences: { some: { activiteId: id } } },
        ],
      },
      select: { id: true },
    })
    if (autorises.length !== scoutIds.length) {
      throw new BadRequestException('Certains scouts ne font pas partie de cette activité')
    }

    const resultats = await this.prisma.$transaction(
      lignes.map((p) =>
        this.prisma.presence.upsert({
          where: { scoutId_activiteId: { scoutId: p.scoutId, activiteId: id } },
          update: { present: p.present, commentaire: p.commentaire ?? null },
          create: { scoutId: p.scoutId, activiteId: id, present: p.present, commentaire: p.commentaire ?? null },
        }),
      ),
    )

    return { enregistrees: resultats.length }
  }
}
