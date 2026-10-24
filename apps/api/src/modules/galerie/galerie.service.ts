import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { mediaVisiblePublic } from '@scout/shared'
import type { Prisma } from '../../generated/prisma/client'
import {
  AccesFichiersService,
  DOSSIER_GALERIE,
  analyserUrlFichierPrive,
  estTeleversePar,
} from '../../common/acces-fichiers.service'
import { AuditService } from '../../common/audit.service'
import { lirePagination, metaPagination, texteRequete } from '../../common/lib/pagination'
import { slugUnique } from '../../common/lib/slug'
import { PrismaService } from '../../prisma/prisma.service'
import { lireFichierPriveParUrl, type FichierLu } from '../fichiers/fichiers.service'
import type { CorpsAjoutMedia, CorpsAlbum, CorpsModificationAlbum, CorpsModificationMedia } from './galerie.schemas'

// Filtre Prisma équivalent à mediaVisiblePublic (règle partagée).
const MEDIA_VISIBLE: Prisma.MediaWhereInput = {
  publie: true,
  album: { publie: true },
  OR: [{ contientMineurs: false }, { consentementVerifie: true }],
}

const MESSAGE_CONSENTEMENT =
  "Cette photo montre des mineurs : vérifiez les consentements à l'image avant de la publier."

export function urlPubliqueMedia(id: string): string {
  return `/api/public/galerie/medias/${id}`
}

@Injectable()
export class GalerieService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly acces: AccesFichiersService,
  ) {}

  // --- Administration -------------------------------------------------------

  async listerAlbums(requete: Record<string, unknown>) {
    const pagination = lirePagination(requete, 20, 50)
    const q = texteRequete(requete.q)
    const where: Prisma.AlbumWhereInput = q ? { titre: { contains: q, mode: 'insensitive' } } : {}
    const [albums, total] = await Promise.all([
      this.prisma.album.findMany({
        where,
        orderBy: [{ dateEvenement: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limite,
        include: {
          _count: { select: { medias: true } },
          medias: { orderBy: { ordre: 'asc' }, take: 1, select: { id: true, url: true } },
        },
      }),
      this.prisma.album.count({ where }),
    ])
    const enAttente = await this.prisma.media.groupBy({
      by: ['albumId'],
      where: { albumId: { in: albums.map((a) => a.id) }, contientMineurs: true, consentementVerifie: false },
      _count: { _all: true },
    })
    return {
      albums: albums.map(({ medias, ...a }) => ({
        ...a,
        couverture: medias[0]?.url ?? null,
        photosSansConsentement: enAttente.find((e) => e.albumId === a.id)?._count._all ?? 0,
      })),
      pagination: metaPagination(pagination, total),
    }
  }

  async album(id: string) {
    const album = await this.prisma.album.findUnique({
      where: { id },
      include: {
        medias: { orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] },
        activite: { select: { id: true, titre: true, dateDebut: true } },
      },
    })
    if (!album) throw new NotFoundException('Album introuvable')
    return album
  }

  async creerAlbum(corps: CorpsAlbum, acteurId: string) {
    await this.verifierActivite(corps.activiteId)
    const slug = await slugUnique(corps.titre, corps.slug, (s) => this.slugPris(s))
    const album = await this.prisma.album.create({
      data: {
        titre: corps.titre,
        slug,
        description: corps.description ?? null,
        categorie: corps.categorie ?? null,
        dateEvenement: corps.dateEvenement ?? null,
        activiteId: corps.activiteId ?? null,
        publie: corps.publie ?? false,
      },
    })
    await this.journaliser('ALBUM_CREE', 'Album', album.id, acteurId, { titre: album.titre })
    return album
  }

  async modifierAlbum(id: string, corps: CorpsModificationAlbum, acteurId: string) {
    const existant = await this.album(id)
    await this.verifierActivite(corps.activiteId)
    const slug =
      corps.slug !== undefined && corps.slug !== existant.slug
        ? await slugUnique(corps.titre ?? existant.titre, corps.slug, (s) => this.slugPris(s, id))
        : undefined
    const { slug: _ignore, ...autres } = corps
    const album = await this.prisma.album.update({
      where: { id },
      data: { ...Object.fromEntries(Object.entries(autres).filter(([, v]) => v !== undefined)), ...(slug ? { slug } : {}) },
    })
    await this.journaliser('ALBUM_MODIFIE', 'Album', id, acteurId, { titre: album.titre, publie: album.publie })
    return album
  }

  async supprimerAlbum(id: string, acteurId: string) {
    const album = await this.album(id)
    await this.prisma.album.delete({ where: { id } })
    for (const media of album.medias) await this.acces.supprimerSiOrphelin(media.url)
    await this.journaliser('ALBUM_SUPPRIME', 'Album', id, acteurId, { titre: album.titre, photos: album.medias.length })
    return { ok: true }
  }

  // Seule une photo téléversée en mode « galerie » par l'utilisateur lui-même
  // peut être ajoutée : jamais la photo d'un dossier de scout.
  async ajouterMedia(albumId: string, corps: CorpsAjoutMedia, acteurId: string) {
    await this.album(albumId)
    const analyse = analyserUrlFichierPrive(corps.url)
    if (!analyse || analyse.dossier !== DOSSIER_GALERIE || !estTeleversePar(analyse.nomFichier, acteurId)) {
      throw new BadRequestException('Photo invalide : téléversez-la depuis la galerie')
    }
    const dernier = await this.prisma.media.findFirst({ where: { albumId }, orderBy: { ordre: 'desc' }, select: { ordre: true } })
    const media = await this.prisma.media.create({
      data: {
        albumId,
        url: corps.url,
        legende: corps.legende ?? null,
        texteAlt: corps.texteAlt ?? null,
        contientMineurs: corps.contientMineurs,
        consentementVerifie: corps.consentementVerifie,
        ordre: (dernier?.ordre ?? -1) + 1,
        publie: false,
      },
    })
    await this.journaliser('MEDIA_AJOUTE', 'Media', media.id, acteurId, { albumId })
    return media
  }

  async modifierMedia(id: string, corps: CorpsModificationMedia, acteurId: string) {
    const existant = await this.prisma.media.findUnique({ where: { id } })
    if (!existant) throw new NotFoundException('Photo introuvable')
    const futur = {
      publie: corps.publie ?? existant.publie,
      contientMineurs: corps.contientMineurs ?? existant.contientMineurs,
      consentementVerifie: corps.consentementVerifie ?? existant.consentementVerifie,
    }
    if (futur.publie && !mediaVisiblePublic({ ...futur, album: null })) {
      throw new BadRequestException(MESSAGE_CONSENTEMENT)
    }
    const media = await this.prisma.media.update({
      where: { id },
      data: Object.fromEntries(Object.entries(corps).filter(([, v]) => v !== undefined)),
    })
    await this.journaliser('MEDIA_MODIFIE', 'Media', id, acteurId, {
      publie: media.publie,
      contientMineurs: media.contientMineurs,
      consentementVerifie: media.consentementVerifie,
    })
    return media
  }

  async supprimerMedia(id: string, acteurId: string) {
    const media = await this.prisma.media.findUnique({ where: { id } })
    if (!media) throw new NotFoundException('Photo introuvable')
    await this.prisma.media.delete({ where: { id } })
    await this.acces.supprimerSiOrphelin(media.url)
    await this.journaliser('MEDIA_SUPPRIME', 'Media', id, acteurId, { albumId: media.albumId })
    return { ok: true }
  }

  // --- Public ---------------------------------------------------------------

  async albumsPublics(requete: Record<string, unknown>) {
    const pagination = lirePagination(requete, 12, 48)
    const where: Prisma.AlbumWhereInput = { publie: true, medias: { some: MEDIA_VISIBLE } }
    const [albums, total] = await Promise.all([
      this.prisma.album.findMany({
        where,
        orderBy: [{ dateEvenement: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limite,
        select: {
          titre: true,
          slug: true,
          description: true,
          categorie: true,
          dateEvenement: true,
          medias: { where: MEDIA_VISIBLE, orderBy: { ordre: 'asc' }, take: 1, select: { id: true, texteAlt: true } },
          _count: { select: { medias: { where: MEDIA_VISIBLE } } },
        },
      }),
      this.prisma.album.count({ where }),
    ])
    return {
      albums: albums.map(({ medias, _count, ...a }) => ({
        ...a,
        nombrePhotos: _count.medias,
        couverture: medias[0] ? { url: urlPubliqueMedia(medias[0].id), texteAlt: medias[0].texteAlt } : null,
      })),
      pagination: metaPagination(pagination, total),
    }
  }

  async albumPublic(slug: string) {
    const album = await this.prisma.album.findFirst({
      where: { slug, publie: true },
      select: {
        titre: true,
        slug: true,
        description: true,
        categorie: true,
        dateEvenement: true,
        medias: {
          where: MEDIA_VISIBLE,
          orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, legende: true, texteAlt: true },
        },
      },
    })
    if (!album || album.medias.length === 0) throw new NotFoundException('Album introuvable')
    return { ...album, medias: album.medias.map((m) => ({ ...m, url: urlPubliqueMedia(m.id) })) }
  }

  /** Dernières photos visibles (page d'accueil). */
  async apercuPublic(nombre = 8) {
    const medias = await this.prisma.media.findMany({
      where: MEDIA_VISIBLE,
      orderBy: [{ album: { dateEvenement: 'desc' } }, { ordre: 'asc' }],
      take: nombre,
      select: { id: true, legende: true, texteAlt: true, album: { select: { slug: true, titre: true } } },
    })
    return medias.map((m) => ({ ...m, url: urlPubliqueMedia(m.id) }))
  }

  // Fichier d'une photo, servi au public uniquement si elle est visible
  // (règle relue à chaque requête : un retrait de consentement prend effet).
  async fichierPublic(id: string): Promise<FichierLu> {
    const media = await this.prisma.media.findFirst({ where: { id, ...MEDIA_VISIBLE }, select: { url: true } })
    const fichier = media ? await lireFichierPriveParUrl(media.url) : null
    if (!fichier) throw new NotFoundException('Photo introuvable')
    return fichier
  }

  // --- Interne --------------------------------------------------------------

  private async slugPris(slug: string, saufId?: string) {
    return (await this.prisma.album.count({ where: { slug, ...(saufId ? { id: { not: saufId } } : {}) } })) > 0
  }

  private async verifierActivite(activiteId: string | null | undefined) {
    if (!activiteId) return
    if ((await this.prisma.activite.count({ where: { id: activiteId } })) === 0) {
      throw new BadRequestException('Activité introuvable')
    }
  }

  private journaliser(action: string, entite: string, entiteId: string, acteurId: string, details: Record<string, unknown>) {
    return this.audit.enregistrer({ acteurId, action, entite, entiteId, details })
  }
}
