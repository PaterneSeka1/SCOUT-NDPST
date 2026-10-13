import { Body, Controller, Get, HttpCode, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { FichierTeleverseInterceptor } from './fichier-televerse.interceptor'
import { FichiersService, type FichierLu } from './fichiers.service'

function envoyerFichier(reponse: Response, fichier: FichierLu, cacheControl: string) {
  reponse.set({
    'Content-Type': fichier.typeMime,
    'Cache-Control': cacheControl,
    // Le type servi est fixé par l'extension (liste blanche) : le navigateur ne
    // doit jamais le deviner à partir du contenu.
    'X-Content-Type-Options': 'nosniff',
  })
  reponse.status(200).send(fichier.contenu)
}

@ApiTags('Fichiers')
@Controller()
export class FichiersController {
  constructor(private readonly fichiers: FichiersService) {}

  // Téléversement multipart : champs « fichier » et « visibilite »
  // (« publique » ou, par défaut, « privee »).
  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(FichierTeleverseInterceptor)
  televerser(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @UploadedFile() fichier: Express.Multer.File | undefined,
    @Body('visibilite') visibilite: unknown,
  ) {
    return this.fichiers.televerser(utilisateur, fichier, visibilite)
  }

  // Sert les fichiers privés (photos de scouts, documents, autorisations de
  // camp…) téléversés via /api/upload. Ce stockage n'est jamais exposé
  // directement : chaque requête exige une session valide et vérifie que
  // l'utilisateur appartient à la paroisse propriétaire du fichier.
  @Get('fichiers/:paroisseId/:fichier')
  async lirePrive(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('paroisseId') paroisseId: string,
    @Param('fichier') fichier: string,
    @Res() reponse: Response,
  ) {
    const lu = await this.fichiers.lirePrive(utilisateur, paroisseId, fichier)
    envoyerFichier(reponse, lu, 'private, max-age=3600')
  }

  // Public : fichiers de branding (logo, image d'accueil…) téléversés via
  // /api/upload en mode disque local, affichés sans authentification (page de
  // connexion). Ne sert que le dossier où sauvegarderFichierPublic écrit —
  // jamais utilisé quand un stockage S3 est configuré, auquel cas l'URL
  // renvoyée pointe directement vers le bucket/CDN.
  @Public()
  @Get('fichiers-publics/:fichier')
  async lirePublic(@Param('fichier') fichier: string, @Res() reponse: Response) {
    const lu = await this.fichiers.lirePublic(fichier)
    // Immuable : le nom de fichier inclut un horodatage + suffixe aléatoire
    // (voir FichiersService.televerser), jamais réutilisé pour un autre contenu.
    envoyerFichier(reponse, lu, 'public, max-age=31536000, immutable')
  }
}
