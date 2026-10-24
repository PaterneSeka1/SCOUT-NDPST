import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { resumeAutomatique } from '@scout/shared'
import { Prisma, type StatutPublication } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import { lirePagination, metaPagination, texteRequete } from '../../common/lib/pagination'
import { slugUnique } from '../../common/lib/slug'
import { PrismaService } from '../../prisma/prisma.service'
import type {
  CorpsCategorie,
  CorpsCreationPublication,
  CorpsModificationPublication,
} from './publications.schemas'

const STATUTS: StatutPublication[] = ['BROUILLON', 'PUBLIEE', 'ARCHIVEE']

const SELECTION_LISTE = {
  id: true,
  titre: true,
  slug: true,
  resume: true,
  imageCouverture: true,
  imageAlt: true,
  statut: true,
  datePublication: true,
  updatedAt: true,
  categorie: { select: { id: true, nom: true, slug: true } },
  auteur: { select: { prenom: true, nom: true } },
} as const

// Condition de visibilité publique : publiée et date de publication atteinte.
function visiblePublic(): Prisma.PublicationWhereInput {
  return { statut: 'PUBLIEE', datePublication: { lte: new Date() } }
}

@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Administration -------------------------------------------------------

  async lister(requete: Record<string, unknown>) {
    const pagination = lirePagination(requete)
    const q = texteRequete(requete.q)
    const statut = STATUTS.find((s) => s === requete.statut)
    const categorieId = texteRequete(requete.categorieId, 40)
    const where: Prisma.PublicationWhereInput = {
      ...(statut ? { statut } : {}),
      ...(categorieId ? { categorieId } : {}),
      ...(q ? { OR: [{ titre: { contains: q, mode: 'insensitive' } }, { resume: { contains: q, mode: 'insensitive' } }] } : {}),
    }
    const [publications, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        select: SELECTION_LISTE,
        orderBy: [{ updatedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limite,
      }),
      this.prisma.publication.count({ where }),
    ])
    return { publications, pagination: metaPagination(pagination, total) }
  }

  async detail(id: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
      include: { categorie: true, auteur: { select: { id: true, prenom: true, nom: true } } },
    })
    if (!publication) throw new NotFoundException('Publication introuvable')
    return publication
  }

  async creer(corps: CorpsCreationPublication, acteurId: string) {
    await this.verifierCategorie(corps.categorieId)
    const slug = await slugUnique(corps.titre, corps.slug, (s) => this.slugPris(s))
    const publication = await this.prisma.publication.create({
      data: {
        titre: corps.titre,
        slug,
        resume: corps.resume ?? null,
        contenu: corps.contenu,
        imageCouverture: corps.imageCouverture ?? null,
        imageAlt: corps.imageAlt ?? null,
        categorieId: corps.categorieId ?? null,
        seoTitre: corps.seoTitre ?? null,
        seoDescription: corps.seoDescription ?? null,
        auteurId: acteurId,
      },
    })
    await this.journaliser('PUBLICATION_CREEE', publication.id, acteurId, { titre: publication.titre })
    return publication
  }

  async modifier(id: string, corps: CorpsModificationPublication, acteurId: string) {
    const existante = await this.detail(id)
    await this.verifierCategorie(corps.categorieId)
    const slug =
      corps.slug !== undefined && corps.slug !== existante.slug
        ? await slugUnique(corps.titre ?? existante.titre, corps.slug, (s) => this.slugPris(s, id))
        : undefined
    const { slug: _ignore, ...autres } = corps
    const publication = await this.prisma.publication.update({
      where: { id },
      data: {
        ...Object.fromEntries(Object.entries(autres).filter(([, v]) => v !== undefined)),
        ...(slug ? { slug } : {}),
      },
    })
    await this.journaliser('PUBLICATION_MODIFIEE', id, acteurId, { titre: publication.titre })
    return publication
  }

  async publier(id: string, datePublication: Date | null | undefined, acteurId: string) {
    const existante = await this.detail(id)
    if (!existante.contenu.trim()) throw new BadRequestException('Une publication vide ne peut pas être publiée')
    const publication = await this.prisma.publication.update({
      where: { id },
      data: { statut: 'PUBLIEE', datePublication: datePublication ?? existante.datePublication ?? new Date() },
    })
    await this.journaliser('PUBLICATION_PUBLIEE', id, acteurId, { titre: publication.titre })
    return publication
  }

  async changerStatut(id: string, statut: 'BROUILLON' | 'ARCHIVEE', acteurId: string) {
    await this.detail(id)
    const publication = await this.prisma.publication.update({ where: { id }, data: { statut } })
    await this.journaliser(statut === 'ARCHIVEE' ? 'PUBLICATION_ARCHIVEE' : 'PUBLICATION_DEPUBLIEE', id, acteurId, {
      titre: publication.titre,
    })
    return publication
  }

  // Suppression définitive : seulement un brouillon ou une archive (une
  // publication en ligne doit d'abord être retirée).
  async supprimer(id: string, acteurId: string) {
    const existante = await this.detail(id)
    if (existante.statut === 'PUBLIEE') {
      throw new ConflictException('Retirez la publication du site avant de la supprimer')
    }
    await this.prisma.publication.delete({ where: { id } })
    await this.journaliser('PUBLICATION_SUPPRIMEE', id, acteurId, { titre: existante.titre })
    return { ok: true }
  }

  // --- Catégories -----------------------------------------------------------

  categories() {
    return this.prisma.categoriePublication.findMany({
      orderBy: { nom: 'asc' },
      include: { _count: { select: { publications: true } } },
    })
  }

  async creerCategorie(corps: CorpsCategorie) {
    const slug = await slugUnique(corps.nom, corps.slug, async (s) =>
      (await this.prisma.categoriePublication.count({ where: { slug: s } })) > 0,
    )
    try {
      return await this.prisma.categoriePublication.create({ data: { nom: corps.nom, slug } })
    } catch (erreur) {
      throw this.conflit(erreur, 'Cette catégorie existe déjà')
    }
  }

  async modifierCategorie(id: string, corps: CorpsCategorie) {
    try {
      return await this.prisma.categoriePublication.update({ where: { id }, data: { nom: corps.nom } })
    } catch (erreur) {
      throw this.conflit(erreur, 'Cette catégorie existe déjà')
    }
  }

  // Les publications de la catégorie sont conservées (catégorie retirée).
  async supprimerCategorie(id: string) {
    await this.prisma.categoriePublication.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Catégorie introuvable')
    })
    return { ok: true }
  }

  // --- Public ---------------------------------------------------------------

  async listerPubliques(requete: Record<string, unknown>) {
    const pagination = lirePagination(requete, 9, 30)
    const q = texteRequete(requete.q)
    const categorie = texteRequete(requete.categorie, 80)
    const where: Prisma.PublicationWhereInput = {
      ...visiblePublic(),
      ...(categorie ? { categorie: { slug: categorie } } : {}),
      ...(q ? { OR: [{ titre: { contains: q, mode: 'insensitive' } }, { resume: { contains: q, mode: 'insensitive' } }] } : {}),
    }
    const [publications, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        select: { ...SELECTION_LISTE, contenu: true },
        orderBy: { datePublication: 'desc' },
        skip: pagination.skip,
        take: pagination.limite,
      }),
      this.prisma.publication.count({ where }),
    ])
    return {
      publications: publications.map(({ contenu, statut: _s, updatedAt: _u, ...p }) => ({
        ...p,
        resume: p.resume || resumeAutomatique(contenu),
      })),
      pagination: metaPagination(pagination, total),
    }
  }

  async detailPublic(slug: string) {
    const publication = await this.prisma.publication.findFirst({
      where: { slug, ...visiblePublic() },
      select: {
        titre: true,
        slug: true,
        resume: true,
        contenu: true,
        imageCouverture: true,
        imageAlt: true,
        datePublication: true,
        seoTitre: true,
        seoDescription: true,
        categorie: { select: { nom: true, slug: true } },
        auteur: { select: { prenom: true, nom: true } },
      },
    })
    if (!publication) throw new NotFoundException('Article introuvable')
    return publication
  }

  categoriesPubliques() {
    return this.prisma.categoriePublication.findMany({
      where: { publications: { some: visiblePublic() } },
      select: { nom: true, slug: true },
      orderBy: { nom: 'asc' },
    })
  }

  // --- Interne --------------------------------------------------------------

  private async slugPris(slug: string, saufId?: string) {
    return (await this.prisma.publication.count({ where: { slug, ...(saufId ? { id: { not: saufId } } : {}) } })) > 0
  }

  private async verifierCategorie(categorieId: string | null | undefined) {
    if (!categorieId) return
    if ((await this.prisma.categoriePublication.count({ where: { id: categorieId } })) === 0) {
      throw new BadRequestException('Catégorie introuvable')
    }
  }

  private conflit(erreur: unknown, message: string) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError) {
      if (erreur.code === 'P2002') return new ConflictException(message)
      if (erreur.code === 'P2025') return new NotFoundException('Catégorie introuvable')
    }
    return erreur
  }

  private journaliser(action: string, entiteId: string, acteurId: string, details: Record<string, unknown>) {
    return this.audit.enregistrer({ acteurId, action, entite: 'Publication', entiteId, details })
  }
}
