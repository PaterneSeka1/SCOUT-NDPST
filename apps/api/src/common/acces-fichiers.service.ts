import { BadRequestException, Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { ROLES_BRANCHE, ROLES_TOUT_STAFF, peutGererContenus } from '@scout/shared'
import { PrismaService } from '../prisma/prisma.service'
import { logger } from './lib/logger'
import { supprimerFichierPrive } from './lib/storage'
import { PerimetreService } from './perimetre.service'
import type { UtilisateurSession } from './types'

const URL_FICHIER_PRIVE = /^\/api\/fichiers\/([A-Za-z0-9_-]+)\/([^/]+)$/

// Dossier des nouveaux fichiers privés des scouts. Les fichiers antérieurs à
// la simplification mono-paroissiale restent dans le dossier portant
// l'ancien identifiant de paroisse : leurs URL enregistrées restent valides.
export const DOSSIER_PRIVE = 'groupe'
// Photos de la galerie : privées tant qu'elles ne sont pas publiées avec les
// consentements vérifiés (servies au public par /api/public/galerie).
export const DOSSIER_GALERIE = 'galerie'

// Préfixe d'auteur porté par le nom d'un fichier privé : identifie celui qui
// l'a téléversé, sans révéler son identifiant. Il ne donne aucun droit à lui
// seul — la lecture exige toujours une session — mais permet de n'accepter
// que ses propres téléversements lorsqu'on rattache un fichier à un scout.
function prefixeAuteur(utilisateurId: string): string {
  return createHash('sha256').update(`fichier-prive:${utilisateurId}`).digest('hex').slice(0, 16)
}

// Nom de stockage d'un fichier privé : préfixe d'auteur + 128 bits aléatoires,
// impossible à deviner (contrairement à Math.random).
export function nomFichierPriveGenere(utilisateurId: string, extension: string): string {
  return `${prefixeAuteur(utilisateurId)}-${randomBytes(16).toString('hex')}.${extension}`
}

export function estTeleversePar(nomFichier: string, utilisateurId: string): boolean {
  return nomFichier.startsWith(`${prefixeAuteur(utilisateurId)}-`)
}

export function urlFichierPrive(dossier: string, nomFichier: string): string {
  return `/api/fichiers/${dossier}/${nomFichier}`
}

export function analyserUrlFichierPrive(url: string): { dossier: string; nomFichier: string } | null {
  const correspondance = URL_FICHIER_PRIVE.exec(url)
  return correspondance ? { dossier: correspondance[1], nomFichier: correspondance[2] } : null
}

// Accès aux fichiers privés (photos de scouts, fiches médicales, autorisations
// de camp) : données de mineurs. Être connecté ne suffit pas ; il faut
// pouvoir agir sur le scout auquel le fichier est rattaché, avec le même
// cloisonnement que les routes métier :
//   - staff de groupe : tous les scouts du groupe ;
//   - staff de branche : les scouts de sa branche ;
//   - parent lié au scout (quel que soit son rôle) ;
//   - le scout lui-même, s'il a un compte.
// Un fichier encore rattaché à aucun scout (téléversé, formulaire pas encore
// enregistré) n'est lisible que par celui qui l'a téléversé. Les photos de la
// galerie sont lisibles par les gestionnaires de contenus.
@Injectable()
export class AccesFichiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  // null : lecture refusée. Sinon, le scout concerné (null pour un fichier pas
  // encore rattaché) et si le fichier est un document sensible (fiche
  // médicale, autorisation) plutôt qu'une photo — la lecture d'un document
  // sensible est journalisée par l'appelant.
  async autorisationLecture(
    utilisateur: UtilisateurSession,
    dossier: string,
    nomFichier: string,
  ): Promise<{ scoutId: string | null; sensible: boolean } | null> {
    const url = urlFichierPrive(dossier, nomFichier)
    if (dossier === DOSSIER_GALERIE) {
      if (!peutGererContenus(utilisateur)) return null
      return (await this.prisma.media.count({ where: { url } })) > 0 || estTeleversePar(nomFichier, utilisateur.id)
        ? { scoutId: null, sensible: false }
        : null
    }

    const scouts = await this.prisma.scout.findMany({
      where: {
        OR: [{ photo: url }, { documents: { some: { url } } }, { autorisationsCamp: { some: { documentUrl: url } } }],
      },
      select: {
        id: true,
        brancheType: true,
        utilisateurId: true,
        documents: { where: { url }, select: { id: true }, take: 1 },
        autorisationsCamp: { where: { documentUrl: url }, select: { id: true }, take: 1 },
      },
    })
    if (scouts.length === 0) {
      return estTeleversePar(nomFichier, utilisateur.id) ? { scoutId: null, sensible: false } : null
    }

    for (const scout of scouts) {
      if (await this.peutAgirSurScout(utilisateur, scout)) {
        return { scoutId: scout.id, sensible: scout.documents.length > 0 || scout.autorisationsCamp.length > 0 }
      }
    }
    return null
  }

  // Avant de rattacher un fichier privé à un scout (photo, document,
  // autorisation de camp) : seul un fichier que l'utilisateur a lui-même
  // téléversé, ou déjà rattaché à ce scout, est accepté.
  // Sans ce contrôle, rattacher le fichier d'un autre scout au sien suffirait
  // pour obtenir le droit de le lire.
  async verifierRattachable(utilisateur: UtilisateurSession, url: string, scoutId?: string): Promise<void> {
    const analyse = analyserUrlFichierPrive(url)
    if (!analyse || analyse.dossier === DOSSIER_GALERIE) throw new BadRequestException('Fichier invalide')
    if (estTeleversePar(analyse.nomFichier, utilisateur.id)) return

    if (scoutId) {
      const dejaRattache = await this.prisma.scout.count({
        where: {
          id: scoutId,
          OR: [{ photo: url }, { documents: { some: { url } } }, { autorisationsCamp: { some: { documentUrl: url } } }],
        },
      })
      if (dejaRattache > 0) return
    }
    throw new BadRequestException('Fichier invalide')
  }

  // À appeler APRÈS avoir détaché un fichier (document supprimé, photo ou
  // autorisation remplacée) : le supprime du stockage s'il n'est plus
  // rattaché à rien. Ne fait jamais échouer l'opération métier : un échec du
  // stockage est journalisé et laisse au pire un fichier orphelin.
  async supprimerSiOrphelin(url: string | null | undefined): Promise<void> {
    const analyse = url ? analyserUrlFichierPrive(url) : null
    if (!analyse || !url) return
    const references =
      analyse.dossier === DOSSIER_GALERIE
        ? await this.prisma.media.count({ where: { url } })
        : await this.prisma.scout.count({
            where: {
              OR: [{ photo: url }, { documents: { some: { url } } }, { autorisationsCamp: { some: { documentUrl: url } } }],
            },
          })
    if (references > 0) return
    try {
      await supprimerFichierPrive(analyse.dossier, analyse.nomFichier)
    } catch (erreur) {
      logger.error('fichier.suppression_echec', erreur, { fichier: analyse.nomFichier })
    }
  }

  private async peutAgirSurScout(
    utilisateur: UtilisateurSession,
    scout: { id: string; brancheType: string; utilisateurId: string | null },
  ): Promise<boolean> {
    if (scout.utilisateurId === utilisateur.id) return true
    if (ROLES_TOUT_STAFF.includes(utilisateur.role)) {
      if (!ROLES_BRANCHE.includes(utilisateur.role)) return true
      if ((await this.perimetre.brancheUtilisateur(utilisateur.id)) === scout.brancheType) return true
    }
    const lien = await this.prisma.lienParentScout.count({ where: { parentId: utilisateur.id, scoutId: scout.id } })
    return lien > 0
  }
}
