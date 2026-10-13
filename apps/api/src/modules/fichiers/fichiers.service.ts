import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import path from 'path'
import { ROLES_GROUPE, ROLES_PLATEFORME } from '@scout/shared'
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

// Fichiers publics (branding) : logo de paroisse (Chef de Groupe) ou logo et
// image d'accueil de la plateforme (administrateur plateforme).
const ROLES_PUBLICATION: string[] = [...ROLES_GROUPE, ...ROLES_PLATEFORME]

export type Visibilite = 'publique' | 'privee'

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
  async televerser(
    utilisateur: UtilisateurSession,
    fichier: FichierRecu | undefined,
    visibiliteDemandee: unknown,
  ): Promise<{ url: string }> {
    const visibilite: Visibilite = visibiliteDemandee === 'publique' ? 'publique' : 'privee'

    if (!fichier) throw new BadRequestException('Aucun fichier reçu')
    if (fichier.size > TAILLE_MAX_FICHIER) throw new BadRequestException(MESSAGE_TROP_VOLUMINEUX)

    if (visibilite === 'publique' && !ROLES_PUBLICATION.includes(utilisateur.role)) {
      throw new ForbiddenException('Accès refusé')
    }

    // Un fichier privé est cloisonné par paroisse : un compte sans paroisse
    // (administrateur plateforme) ne peut pas en déposer.
    const paroisseId = utilisateur.paroisseId
    if (visibilite === 'privee' && !paroisseId) throw new ForbiddenException('Accès refusé')

    // Le Content-Type déclaré par le client (mimetype multipart) est falsifiable
    // dans une requête forgée : on détecte le type réel à partir des octets, et
    // on en dérive l'extension de stockage — jamais du nom de fichier fourni
    // par l'utilisateur. Empêche l'upload d'un SVG/HTML malveillant déguisé en
    // image, qui serait ensuite servi tel quel et interprété par le navigateur.
    const detecte = detecterTypeFichier(fichier.buffer)
    if (!detecte) throw new BadRequestException('Type de fichier non autorisé (JPEG, PNG, WebP, GIF, PDF)')

    if (visibilite === 'publique' && !detecte.mime.startsWith('image/')) {
      throw new BadRequestException('Les fichiers publics doivent être des images (JPEG, PNG, WebP ou GIF)')
    }

    const nomFichier = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${detecte.ext}`

    if (visibilite === 'publique') {
      // Fichiers de branding (logo, image d'accueil) : visibles sans
      // authentification, affichés notamment sur la page de connexion.
      return { url: await sauvegarderFichierPublic(nomFichier, fichier.buffer, detecte.mime) }
    }

    // Fichier privé (photo de scout, document, autorisation de camp…) : jamais
    // servi directement, cloisonné par paroisse, accessible uniquement via
    // /api/fichiers, qui vérifie la session. paroisseId est non nul ici
    // (vérifié plus haut pour les fichiers privés).
    return { url: await sauvegarderFichierPrive(paroisseId as string, nomFichier, fichier.buffer, detecte.mime) }
  }

  // Fichier privé : réservé aux membres de la paroisse propriétaire.
  async lirePrive(utilisateur: UtilisateurSession, paroisseId: string, fichier: string): Promise<FichierLu> {
    if (utilisateur.paroisseId !== paroisseId) throw new ForbiddenException('Accès refusé')
    const nomFichier = nomFichierSur(fichier)

    let contenu: Buffer
    try {
      contenu = await lireFichierPrive(paroisseId, nomFichier)
    } catch {
      throw new NotFoundException('Fichier introuvable')
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
