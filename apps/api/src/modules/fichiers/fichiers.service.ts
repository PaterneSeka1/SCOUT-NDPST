import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import path from 'path'
import { ROLES_ADMIN, ROLES_GROUPE, peutGererContenus } from '@scout/shared'
import { AccesFichiersService, DOSSIER_GALERIE, DOSSIER_PRIVE, nomFichierPriveGenere } from '../../common/acces-fichiers.service'
import { AuditService } from '../../common/audit.service'
import { detecterTypeFichier } from '../../common/lib/fileSignature'
import {
  lireFichierPrive,
  lireFichierPublicLocal,
  sauvegarderFichierPrive,
  sauvegarderFichierPublic,
  TYPES_MIME_FICHIERS,
} from '../../common/lib/storage'
import type { UtilisateurSession } from '../../common/types'

export const TAILLE_MAX_FICHIER = 5 * 1024 * 1024 // 5 Mo
export const MESSAGE_TROP_VOLUMINEUX = 'Fichier trop volumineux (max 5 Mo)'

// Fichiers publics (identité, couvertures d'articles, images de branches et
// d'histoire, photos de la maîtrise) : administrateur, Chef de Groupe et
// gestionnaires de contenus désignés.
function peutPublierFichier(utilisateur: UtilisateurSession): boolean {
  return [...ROLES_ADMIN, ...ROLES_GROUPE].includes(utilisateur.role) || peutGererContenus(utilisateur)
}

// « galerie » : photo d'album, stockée en privé jusqu'à sa publication
// (consentements vérifiés), jamais exposée directement.
export type Visibilite = 'publique' | 'privee' | 'galerie'

export interface FichierLu {
  contenu: Buffer
  typeMime: string
}

export interface FichierRecu {
  buffer: Buffer
  size: number
}

// Empêche toute tentative de path traversal (ex : "..%2F..%2F.env", décodé
// en "../../.env" par Express) : seul un nom de fichier nu est accepté.
export function nomFichierSur(fichier: string): string {
  const nomFichier = path.basename(fichier)
  if (nomFichier !== fichier) throw new BadRequestException('Fichier invalide')
  return nomFichier
}

function typeMimeDe(nomFichier: string): string {
  return TYPES_MIME_FICHIERS[path.extname(nomFichier).toLowerCase()] ?? 'application/octet-stream'
}

@Injectable()
export class FichiersService {
  constructor(
    private readonly acces: AccesFichiersService,
    private readonly audit: AuditService,
  ) {}

  async televerser(
    utilisateur: UtilisateurSession,
    fichier: FichierRecu | undefined,
    visibiliteDemandee: unknown,
  ): Promise<{ url: string }> {
    const visibilite: Visibilite =
      visibiliteDemandee === 'publique' || visibiliteDemandee === 'galerie' ? visibiliteDemandee : 'privee'

    if (!fichier) throw new BadRequestException('Aucun fichier reçu')
    if (fichier.size > TAILLE_MAX_FICHIER) throw new BadRequestException(MESSAGE_TROP_VOLUMINEUX)

    if (visibilite === 'publique' && !peutPublierFichier(utilisateur)) throw new ForbiddenException('Accès refusé')
    if (visibilite === 'galerie' && !peutGererContenus(utilisateur)) throw new ForbiddenException('Accès refusé')

    // Le Content-Type déclaré par le client (mimetype multipart) est falsifiable
    // dans une requête forgée : on détecte le type réel à partir des octets, et
    // on en dérive l'extension de stockage — jamais du nom de fichier fourni
    // par l'utilisateur. Empêche l'upload d'un SVG/HTML malveillant déguisé en
    // image, qui serait ensuite servi tel quel et interprété par le navigateur.
    const detecte = detecterTypeFichier(fichier.buffer)
    if (!detecte) throw new BadRequestException('Type de fichier non autorisé (JPEG, PNG, WebP, GIF, PDF)')

    if (visibilite !== 'privee' && !detecte.mime.startsWith('image/')) {
      throw new BadRequestException('Les fichiers publics doivent être des images (JPEG, PNG, WebP ou GIF)')
    }

    if (visibilite === 'publique') {
      // Fichiers de branding (logo, image d'accueil) : visibles sans
      // authentification, affichés notamment sur la page de connexion.
      const nomPublic = `${Date.now()}-${randomBytes(8).toString('hex')}.${detecte.ext}`
      return { url: await sauvegarderFichierPublic(nomPublic, fichier.buffer, detecte.mime) }
    }

    // Nom imprévisible portant le préfixe de son auteur (voir AccesFichiersService).
    const nomFichier = nomFichierPriveGenere(utilisateur.id, detecte.ext)

    // Fichier privé (photo de scout, document, autorisation de camp, photo de
    // galerie non publiée) : jamais servi directement, accessible uniquement
    // via /api/fichiers, qui vérifie les droits.
    const dossier = visibilite === 'galerie' ? DOSSIER_GALERIE : DOSSIER_PRIVE
    return { url: await sauvegarderFichierPrive(dossier, nomFichier, fichier.buffer, detecte.mime) }
  }

  // Fichier privé : réservé à ceux qui peuvent agir sur le scout auquel il est
  // rattaché (voir AccesFichiersService). La consultation d'un document
  // sensible (fiche médicale, autorisation) est journalisée.
  async lirePrive(utilisateur: UtilisateurSession, dossier: string, fichier: string): Promise<FichierLu> {
    const nomFichier = nomFichierSur(fichier)
    if (!/^[A-Za-z0-9_-]+$/.test(dossier)) throw new BadRequestException('Fichier invalide')
    const autorisation = await this.acces.autorisationLecture(utilisateur, dossier, nomFichier)
    if (!autorisation) throw new ForbiddenException('Accès refusé')

    let contenu: Buffer
    try {
      contenu = await lireFichierPrive(dossier, nomFichier)
    } catch {
      throw new NotFoundException('Fichier introuvable')
    }

    if (autorisation.sensible) {
      await this.audit.enregistrer({
        acteurId: utilisateur.id,
        action: 'DOCUMENT_CONSULTE',
        entite: 'Scout',
        entiteId: autorisation.scoutId,
        details: { fichier: nomFichier },
      })
    }
    return { contenu, typeMime: typeMimeDe(nomFichier) }
  }

  // Fichier public (mode disque local uniquement).
  async lirePublic(fichier: string): Promise<FichierLu> {
    const nomFichier = nomFichierSur(fichier)

    let contenu: Buffer
    try {
      contenu = await lireFichierPublicLocal(nomFichier)
    } catch {
      throw new NotFoundException('Fichier introuvable')
    }
    return { contenu, typeMime: typeMimeDe(nomFichier) }
  }
}

// Lecture d'un fichier privé par son URL enregistrée, sans contrôle d'accès :
// réservé aux routes publiques qui ont déjà vérifié la visibilité (galerie).
export async function lireFichierPriveParUrl(url: string): Promise<FichierLu | null> {
  const correspondance = /^\/api\/fichiers\/([A-Za-z0-9_-]+)\/([^/]+)$/.exec(url)
  if (!correspondance || path.basename(correspondance[2]) !== correspondance[2]) return null
  try {
    return { contenu: await lireFichierPrive(correspondance[1], correspondance[2]), typeMime: typeMimeDe(correspondance[2]) }
  } catch {
    return null
  }
}
