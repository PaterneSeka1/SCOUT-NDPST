import { Injectable, NotFoundException } from '@nestjs/common'
import { BrancheTypeSchema, LABELS_BRANCHES, LABELS_ROLES, TRANCHES_AGE_BRANCHES, formatTrancheAge } from '@scout/shared'
import type { BrancheType, Prisma } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import { lirePagination, metaPagination } from '../../common/lib/pagination'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigurationService } from '../configuration/configuration.service'
import { GalerieService } from '../galerie/galerie.service'
import { PublicationsService } from '../publications/publications.service'
import type { CorpsBranche } from './site-public.schemas'

// Ordre d'affichage de la maîtrise sur la page publique.
const ORDRE_ROLES = ['CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE', 'RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']

// Seuls les champs destinés au public : jamais la description interne, les
// participants ou les présences.
const SELECTION_ACTIVITE_PUBLIQUE = {
  id: true,
  titre: true,
  descriptionPublique: true,
  dateDebut: true,
  dateFin: true,
  lieu: true,
  type: true,
  brancheType: true,
  statut: true,
} as const

const SELECTION_MEMBRE_PUBLIC = {
  id: true,
  prenom: true,
  nom: true,
  role: true,
  brancheType: true,
  fonctionPublique: true,
  photoPublique: true,
  biographie: true,
  ordrePublic: true,
} as const

type MembrePublic = Prisma.UtilisateurGetPayload<{ select: typeof SELECTION_MEMBRE_PUBLIC }>

function versMembre(m: MembrePublic) {
  return {
    id: m.id,
    prenom: m.prenom,
    nom: m.nom,
    fonction: m.fonctionPublique || LABELS_ROLES[m.role] || m.role,
    branche: m.brancheType ? LABELS_BRANCHES[m.brancheType] : null,
    // Code de branche (accent visuel et filtres du site) ; null = direction du groupe.
    brancheType: m.brancheType,
    photo: m.photoPublique,
    biographie: m.biographie,
  }
}

function trierMembres(membres: MembrePublic[]) {
  return [...membres].sort(
    (a, b) => ORDRE_ROLES.indexOf(a.role) - ORDRE_ROLES.indexOf(b.role) || a.ordrePublic - b.ordrePublic || a.nom.localeCompare(b.nom),
  )
}

function versBranche(b: {
  type: string
  slug: string
  presentation: string | null
  imageUrl: string | null
  imageAlt: string | null
}) {
  return {
    type: b.type,
    slug: b.slug,
    nom: LABELS_BRANCHES[b.type] ?? b.type,
    trancheAge: TRANCHES_AGE_BRANCHES[b.type] ? formatTrancheAge(TRANCHES_AGE_BRANCHES[b.type]) : null,
    presentation: b.presentation,
    imageUrl: b.imageUrl,
    imageAlt: b.imageAlt,
  }
}

@Injectable()
export class SitePublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly configuration: ConfigurationService,
    private readonly publications: PublicationsService,
    private readonly galerie: GalerieService,
  ) {}

  // Page d'accueil : un seul appel, uniquement des données publiées.
  async accueil() {
    const maintenant = new Date()
    const [identite, branches, actualites, activites, photos, equipe, histoire] = await Promise.all([
      this.configuration.identitePublique(),
      this.branches(),
      this.publications.listerPubliques({ limite: '3' }),
      this.prisma.activite.findMany({
        where: { publique: true, statut: { not: 'ANNULEE' }, dateDebut: { gte: maintenant } },
        orderBy: { dateDebut: 'asc' },
        take: 4,
        select: SELECTION_ACTIVITE_PUBLIQUE,
      }),
      this.galerie.apercuPublic(8),
      this.prisma.utilisateur.findMany({
        where: { actif: true, profilPublic: true, role: { in: ['CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE'] } },
        select: SELECTION_MEMBRE_PUBLIC,
      }),
      this.prisma.evenementHistorique.findMany({
        where: { publie: true },
        orderBy: [{ annee: 'asc' }, { ordre: 'asc' }],
        take: 4,
        select: { annee: true, titre: true, statutValidation: true },
      }),
    ])
    return {
      identite,
      branches,
      actualites: actualites.publications,
      activites,
      photos,
      equipe: trierMembres(equipe).map(versMembre),
      histoire,
    }
  }

  async branches() {
    const branches = await this.prisma.branche.findMany({
      where: { active: true, publiee: true },
      orderBy: { ordre: 'asc' },
    })
    return branches.map(versBranche)
  }

  async branche(slug: string) {
    const b = await this.prisma.branche.findFirst({ where: { slug, active: true, publiee: true } })
    if (!b) throw new NotFoundException('Branche introuvable')
    const [responsables, activites] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where: { actif: true, profilPublic: true, brancheType: b.type, role: { in: ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE'] } },
        select: SELECTION_MEMBRE_PUBLIC,
      }),
      this.prisma.activite.findMany({
        where: {
          publique: true,
          statut: { not: 'ANNULEE' },
          dateDebut: { gte: new Date() },
          OR: [{ brancheType: b.type }, { brancheType: null }],
        },
        orderBy: { dateDebut: 'asc' },
        take: 6,
        select: SELECTION_ACTIVITE_PUBLIQUE,
      }),
    ])
    return {
      ...versBranche(b),
      identite: b.identite,
      objectifs: b.objectifs,
      pedagogie: b.pedagogie,
      activitesTypes: b.activitesTypes,
      responsables: trierMembres(responsables).map(versMembre),
      activites,
    }
  }

  async equipe() {
    const membres = await this.prisma.utilisateur.findMany({
      where: { actif: true, profilPublic: true, role: { in: ORDRE_ROLES as never } },
      select: SELECTION_MEMBRE_PUBLIC,
    })
    return trierMembres(membres).map(versMembre)
  }

  async activites(requete: Record<string, unknown>) {
    const pagination = lirePagination(requete, 12, 48)
    const passees = requete.periode === 'passees'
    const maintenant = new Date()
    const where: Prisma.ActiviteWhereInput = {
      publique: true,
      statut: { not: 'ANNULEE' },
      dateDebut: passees ? { lt: maintenant } : { gte: maintenant },
    }
    const [activites, total] = await Promise.all([
      this.prisma.activite.findMany({
        where,
        orderBy: { dateDebut: passees ? 'desc' : 'asc' },
        skip: pagination.skip,
        take: pagination.limite,
        select: SELECTION_ACTIVITE_PUBLIQUE,
      }),
      this.prisma.activite.count({ where }),
    ])
    return { activites, pagination: metaPagination(pagination, total) }
  }

  // --- Administration des présentations de branches -------------------------

  listerBranchesAdmin() {
    return this.prisma.branche.findMany({ orderBy: { ordre: 'asc' } })
  }

  async modifierBranche(type: string, corps: CorpsBranche, acteurId: string) {
    const brancheType = BrancheTypeSchema.safeParse(type)
    if (!brancheType.success) throw new NotFoundException('Branche introuvable')
    const branche = await this.prisma.branche.update({
      where: { type: brancheType.data as BrancheType },
      data: Object.fromEntries(Object.entries(corps).filter(([, v]) => v !== undefined)),
    })
    await this.audit.enregistrer({ acteurId, action: 'BRANCHE_MODIFIEE', entite: 'Branche', entiteId: branche.id, details: { type } })
    return branche
  }
}
