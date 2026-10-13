import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  BrancheTypeSchema,
  PERIMETRE_V1,
  ROLES_BRANCHE,
  ROLES_TOUT_STAFF,
  TypeActiviteSchema,
  entierBorne,
  estCheminLocalValide,
  estValeurEnum,
} from '@scout/shared'
import { BrancheType, Prisma, TypeAutorisationCamp } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { PerimetreService } from '../../common/perimetre.service'
import { paroisseIdRequise } from '../../common/paroisse'
import type { UtilisateurSession } from '../../common/types'

export interface FiltresActivites {
  page: string | null
  limite: string | null
  recherche: string | null
  type: string | null
  brancheType: string | null
  aVenir: string | null
}

const AVEC_NOMBRE_PRESENCES = { _count: { select: { presences: true } } } as const

const SELECTION_SCOUT_PRESENCE = {
  id: true,
  nom: true,
  prenom: true,
  matricule: true,
  brancheType: true,
} as const

// Corps JSON attendu sous forme d'objet : toute autre forme est rejetée.
function objetCorps(corps: unknown): Record<string, unknown> {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw new BadRequestException('Données invalides')
  }
  return corps as Record<string, unknown>
}

@Injectable()
export class ActivitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  // ---------------------------------------------------------------------------
  // Liste et création
  // ---------------------------------------------------------------------------

  async lister(utilisateur: UtilisateurSession, filtres: FiltresActivites) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const page = entierBorne(filtres.page, 1, 1, Number.MAX_SAFE_INTEGER)
    const limite = entierBorne(filtres.limite, 20, 1, 100)
    const decalage = (page - 1) * limite
    const recherche = filtres.recherche ?? ''
    const type = filtres.type ?? ''
    const brancheType = filtres.brancheType ?? ''

    const typeValide = TypeActiviteSchema.safeParse(type)
    if (type && !typeValide.success) {
      throw new BadRequestException("Type d'activité invalide")
    }

    const conditions: Prisma.ActiviteWhereInput[] = [{ paroisseId }]

    // Les responsables de branche ne voient que leur branche + les activités
    // inter-branches (brancheType null) — toute valeur "brancheType" fournie
    // par le client est ignorée pour ce groupe de rôles.
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
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

  async creer(utilisateur: UtilisateurSession, corpsBrut: unknown) {
    const estAssistantDistrict = utilisateur.roleDistrict === 'ASSISTANT_DISTRICT'
    const estStaff = ROLES_TOUT_STAFF.includes(utilisateur.role)
    if (!estStaff && !estAssistantDistrict) throw new ForbiddenException('Accès refusé')

    const corps = objetCorps(corpsBrut)
    const { titre, description, dateDebut, dateFin, lieu, type, brancheType, paroisseId: paroisseIdCorps } = corps

    if (typeof titre !== 'string' || !titre.trim() || typeof dateDebut !== 'string' || !dateDebut) {
      throw new BadRequestException('Le titre et la date de début sont obligatoires')
    }
    if (dateFin !== undefined && typeof dateFin !== 'string') {
      throw new BadRequestException('La date de fin est invalide')
    }
    const dateDebutObj = new Date(dateDebut)
    if (Number.isNaN(dateDebutObj.getTime())) {
      throw new BadRequestException('La date de début est invalide')
    }
    const dateFinObj = dateFin ? new Date(dateFin) : null
    if (dateFin && (!dateFinObj || Number.isNaN(dateFinObj.getTime()))) {
      throw new BadRequestException('La date de fin est invalide')
    }
    if (dateFinObj && dateFinObj <= dateDebutObj) {
      throw new BadRequestException('La date de fin doit être après la date de début')
    }

    const typeValide = TypeActiviteSchema.safeParse(type)
    if (type !== undefined && !typeValide.success) {
      throw new BadRequestException("Type d'activité invalide")
    }
    const brancheValide = BrancheTypeSchema.safeParse(brancheType)
    if (brancheType != null && !brancheValide.success) {
      throw new BadRequestException('Branche invalide')
    }

    let paroisseId: string
    let brancheEffective: BrancheType | null = brancheValide.success ? brancheValide.data : null

    // La création via le district (choix de la paroisse cible) n'est utilisée
    // que par /district/ma-branche/activites/nouvelle, seule à envoyer
    // paroisseId dans le corps — un ASSISTANT_DISTRICT qui exerce par ailleurs
    // un rôle paroissial de branche crée normalement via l'autre branche
    // ci-dessous quand ce champ est absent (formulaire du tableau de bord).
    if (estAssistantDistrict && paroisseIdCorps) {
      // Espace district masqué en V1 (voir perimetreV1 dans @scout/shared) : ce
      // chemin reste dans le code mais n'est pas accessible tant que le
      // périmètre V1 est actif.
      if (PERIMETRE_V1) throw new ForbiddenException('Fonctionnalité indisponible')
      // Assistant au Commissaire de District chargé d'une branche : choisit la
      // paroisse cible parmi celles de son district, brancheType forcé à sa
      // branche — toute valeur envoyée par le client pour brancheType est ignorée.
      const bt = await this.perimetre.brancheDistrictUtilisateur(utilisateur.id)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      const { paroisses } = await this.perimetre.paroissesDuDistrict(paroisseIdRequise(utilisateur))
      if (typeof paroisseIdCorps !== 'string' || !paroisses.some((p) => p.id === paroisseIdCorps)) {
        throw new BadRequestException('Paroisse invalide ou manquante')
      }
      paroisseId = paroisseIdCorps
      brancheEffective = bt as BrancheType
    } else {
      // Sans paroisseId dans le corps, seul le staff paroissial crée une
      // activité de sa paroisse (un ASSISTANT_DISTRICT sans rôle de staff
      // n'a rien à créer ici).
      if (!estStaff) throw new ForbiddenException('Accès refusé')
      paroisseId = paroisseIdRequise(utilisateur)
      // Un responsable de branche ne peut créer une activité que pour sa propre
      // branche — décider d'une activité inter-branches (brancheType null) reste
      // une décision du groupe.
      if (ROLES_BRANCHE.includes(utilisateur.role)) {
        const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
        if (!bt) throw new ForbiddenException('Aucune branche assignée')
        brancheEffective = bt as BrancheType
      }
    }

    return this.prisma.activite.create({
      data: {
        titre: titre.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        dateDebut: dateDebutObj,
        dateFin: dateFinObj,
        lieu: typeof lieu === 'string' ? lieu.trim() || null : null,
        type: typeValide.success ? typeValide.data : 'REUNION',
        brancheType: brancheEffective,
        paroisseId,
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
    const paroisseId = paroisseIdRequise(utilisateur)
    const filtreBranche = await this.filtreBrancheLecture(utilisateur)

    const activite = await this.prisma.activite.findFirst({
      where: { id, paroisseId, ...filtreBranche },
      include: AVEC_NOMBRE_PRESENCES,
    })
    if (!activite) throw new NotFoundException('Activité introuvable')
    return activite
  }

  async modifier(utilisateur: UtilisateurSession, id: string, corpsBrut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)

    // Un responsable de branche ne peut modifier que les activités de sa propre
    // branche (ou inter-branches), et ne peut pas déplacer une activité vers
    // une autre branche.
    const estBranche = ROLES_BRANCHE.includes(utilisateur.role)
    const filtreBranche = await this.filtreBrancheLecture(utilisateur)

    const existante = await this.prisma.activite.findFirst({ where: { id, paroisseId, ...filtreBranche } })
    if (!existante) throw new NotFoundException('Activité introuvable')

    const corps = objetCorps(corpsBrut)
    const { titre, description, dateDebut, dateFin, lieu, type, brancheType } = corps
    if (titre !== undefined && typeof titre !== 'string') {
      throw new BadRequestException('Le titre est invalide')
    }
    const titreNettoye = typeof titre === 'string' ? titre.trim() : undefined
    if (titre !== undefined && !titreNettoye) {
      throw new BadRequestException('Le titre est requis')
    }
    if (dateDebut !== undefined && typeof dateDebut !== 'string') {
      throw new BadRequestException('La date de début est invalide')
    }
    // dateFin : null ou '' efface la date de fin.
    if (dateFin !== undefined && dateFin !== null && typeof dateFin !== 'string') {
      throw new BadRequestException('La date de fin est invalide')
    }

    const typeValide = TypeActiviteSchema.safeParse(type)
    if (type !== undefined && !typeValide.success) {
      throw new BadRequestException("Type d'activité invalide")
    }
    const brancheValide = BrancheTypeSchema.safeParse(brancheType)
    if (brancheType != null && brancheType !== '' && !brancheValide.success) {
      throw new BadRequestException('Branche invalide')
    }
    const brancheFinale: BrancheType | null = brancheValide.success ? brancheValide.data : null
    if (estBranche && brancheType !== undefined && brancheFinale !== existante.brancheType) {
      throw new ForbiddenException('Le changement de branche est réservé au groupe')
    }

    const dateDebutFinale = typeof dateDebut === 'string' ? new Date(dateDebut) : existante.dateDebut
    if (dateDebut !== undefined && Number.isNaN(dateDebutFinale.getTime())) {
      throw new BadRequestException('La date de début est invalide')
    }
    const dateFinFinale =
      dateFin !== undefined ? (typeof dateFin === 'string' && dateFin ? new Date(dateFin) : null) : existante.dateFin
    if (dateFin && dateFinFinale && Number.isNaN(dateFinFinale.getTime())) {
      throw new BadRequestException('La date de fin est invalide')
    }
    if (dateFinFinale && dateFinFinale <= dateDebutFinale) {
      throw new BadRequestException('La date de fin doit être après la date de début')
    }

    return this.prisma.activite.update({
      where: { id },
      data: {
        ...(titre !== undefined && { titre: titreNettoye }),
        ...(description !== undefined && {
          description: typeof description === 'string' ? description.trim() || null : null,
        }),
        ...(dateDebut !== undefined && { dateDebut: dateDebutFinale }),
        ...(dateFin !== undefined && { dateFin: dateFinFinale }),
        ...(lieu !== undefined && { lieu: typeof lieu === 'string' ? lieu.trim() || null : null }),
        ...(type !== undefined && typeValide.success && { type: typeValide.data }),
        ...(brancheType !== undefined && { brancheType: brancheFinale }),
      },
      include: AVEC_NOMBRE_PRESENCES,
    })
  }

  async supprimer(utilisateur: UtilisateurSession, id: string) {
    const paroisseId = paroisseIdRequise(utilisateur)

    const existante = await this.prisma.activite.findFirst({ where: { id, paroisseId } })
    if (!existante) throw new NotFoundException('Activité introuvable')

    const peutSupprimer = existante.creePar === utilisateur.id || utilisateur.role === 'CHEF_GROUPE'
    if (!peutSupprimer) throw new ForbiddenException('Non autorisé')

    await this.prisma.activite.delete({ where: { id } })
    return { message: 'Activité supprimée' }
  }

  // ---------------------------------------------------------------------------
  // Autorisations de camp (fiche médicale, autorisation parentale)
  // ---------------------------------------------------------------------------

  private async peutAgirSurScout(
    utilisateur: UtilisateurSession,
    paroisseId: string,
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
    // scout de la paroisse (LienParentScout) peut agir sur les autorisations
    // de camp de cet enfant, au même titre qu'un compte PARENT dédié.
    const lien = await this.prisma.lienParentScout.findFirst({
      where: { parentId: utilisateur.id, scoutId, scout: { paroisseId } },
    })
    return !!lien
  }

  async confirmerAutorisation(utilisateur: UtilisateurSession, activiteId: string, corpsBrut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)

    const activite = await this.prisma.activite.findFirst({ where: { id: activiteId, paroisseId } })
    if (!activite) throw new NotFoundException('Activité introuvable')
    if (activite.type !== 'CAMP') {
      throw new BadRequestException('Cette confirmation ne concerne que les activités de type Camp')
    }

    const { scoutId, type, mode, documentUrl, documentNomFichier } = objetCorps(corpsBrut)

    if (typeof scoutId !== 'string' || !scoutId || !estValeurEnum(TypeAutorisationCamp, type)) {
      throw new BadRequestException('Scout et type sont requis')
    }
    const urlDocument = typeof documentUrl === 'string' ? documentUrl.trim() : ''
    const nomDocument = typeof documentNomFichier === 'string' ? documentNomFichier.trim() : ''
    const parDocument = mode === 'DOCUMENT'
    if (parDocument && (!urlDocument || !nomDocument)) {
      throw new BadRequestException('Le document est requis pour ce mode')
    }
    if (parDocument && !estCheminLocalValide(urlDocument)) {
      throw new BadRequestException('documentUrl doit être un chemin local (ex : /api/fichiers/…)')
    }

    const scout = await this.prisma.scout.findFirst({ where: { id: scoutId, paroisseId } })
    if (!scout) throw new NotFoundException('Scout introuvable')

    if (!(await this.peutAgirSurScout(utilisateur, paroisseId, scoutId, scout.brancheType))) {
      throw new ForbiddenException('Accès refusé')
    }

    const confirmation = {
      confirmeLe: new Date(),
      confirmeParId: utilisateur.id,
      documentUrl: parDocument ? urlDocument : null,
      documentNomFichier: parDocument ? nomDocument : null,
    }
    return this.prisma.autorisationCamp.upsert({
      where: { activiteId_scoutId_type: { activiteId, scoutId, type } },
      create: { activiteId, scoutId, type, ...confirmation },
      update: confirmation,
    })
  }

  async retirerAutorisation(utilisateur: UtilisateurSession, activiteId: string, corpsBrut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)

    const activite = await this.prisma.activite.findFirst({ where: { id: activiteId, paroisseId } })
    if (!activite) throw new NotFoundException('Activité introuvable')

    const { scoutId, type } = objetCorps(corpsBrut)
    if (typeof scoutId !== 'string' || !scoutId || !estValeurEnum(TypeAutorisationCamp, type)) {
      throw new BadRequestException('Scout et type sont requis')
    }

    const existante = await this.prisma.autorisationCamp.findFirst({
      where: { activiteId, scoutId, type, scout: { paroisseId } },
      include: { scout: { select: { brancheType: true } } },
    })
    if (!existante) throw new NotFoundException('Autorisation introuvable')

    // L'auteur d'origine peut toujours retirer sa propre confirmation (ex. un
    // parent qui se rend compte d'une erreur) ; sinon, même cloisonnement par
    // branche que pour la création (voir peutAgirSurScout ci-dessus).
    const estAuteur = existante.confirmeParId === utilisateur.id
    const autorise =
      estAuteur || (await this.peutAgirSurScout(utilisateur, paroisseId, scoutId, existante.scout.brancheType))
    if (!autorise) throw new ForbiddenException('Accès refusé')

    await this.prisma.autorisationCamp.delete({ where: { id: existante.id } })
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Présences
  // ---------------------------------------------------------------------------

  // Charge une activité de la paroisse et vérifie qu'un responsable de branche
  // n'accède qu'à une activité de sa propre branche (une activité sans branche
  // = inter-branches, ouverte à tout le staff).
  private async activitePourPresences(utilisateur: UtilisateurSession, paroisseId: string, id: string) {
    const activite = await this.prisma.activite.findFirst({ where: { id, paroisseId } })
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
    const paroisseId = paroisseIdRequise(utilisateur)
    const activite = await this.activitePourPresences(utilisateur, paroisseId, id)

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
        where: { paroisseId, actif: true, ...(activite.brancheType ? { brancheType: activite.brancheType } : {}) },
        select: SELECTION_SCOUT_PRESENCE,
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      })
      return scouts.map((scout) => ({ id: null, present: false, commentaire: null, scout: avecAutorisationCamp(scout) }))
    }

    return presences.map((p) => ({ ...p, scout: avecAutorisationCamp(p.scout) }))
  }

  async enregistrerPresences(utilisateur: UtilisateurSession, id: string, corpsBrut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)
    // Cf. listerPresences : un responsable de branche ne peut enregistrer les
    // présences que d'une activité de sa propre branche (ou inter-branches).
    const activite = await this.activitePourPresences(utilisateur, paroisseId, id)

    const { presences } = objetCorps(corpsBrut)
    if (
      !Array.isArray(presences) ||
      presences.some(
        (p: unknown) =>
          typeof p !== 'object' ||
          p === null ||
          typeof (p as Record<string, unknown>).scoutId !== 'string' ||
          !(p as Record<string, unknown>).scoutId ||
          typeof (p as Record<string, unknown>).present !== 'boolean' ||
          ((p as Record<string, unknown>).commentaire != null &&
            typeof (p as Record<string, unknown>).commentaire !== 'string'),
      )
    ) {
      throw new BadRequestException('Format invalide')
    }
    const lignes = presences as Array<{ scoutId: string; present: boolean; commentaire?: string | null }>

    // Seuls les scouts de la paroisse appartenant à la branche de l'activité
    // (tous pour une activité inter-branches, comme la liste du GET) peuvent
    // être pointés — plus ceux déjà pointés sur cette activité, qui ont pu
    // changer de branche depuis. Empêche d'écrire une présence pour un scout
    // d'une autre paroisse ou d'une autre branche.
    const scoutIds = [...new Set(lignes.map((p) => p.scoutId))]
    const autorises = await this.prisma.scout.findMany({
      where: {
        id: { in: scoutIds },
        paroisseId,
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
