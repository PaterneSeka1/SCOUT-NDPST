import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { EditeurContenu } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaAjoutMedia,
  SchemaAlbum,
  SchemaModificationAlbum,
  SchemaModificationMedia,
  type CorpsAjoutMedia,
  type CorpsAlbum,
  type CorpsModificationAlbum,
  type CorpsModificationMedia,
} from './galerie.schemas'
import { GalerieService } from './galerie.service'

@ApiTags('Administration — contenus')
@EditeurContenu()
@Controller('admin')
export class AdminGalerieController {
  constructor(private readonly galerie: GalerieService) {}

  @Get('albums')
  lister(@Query() requete: Record<string, unknown>) {
    return this.galerie.listerAlbums(requete)
  }

  @Get('albums/:id')
  detail(@Param('id') id: string) {
    return this.galerie.album(id)
  }

  @Post('albums')
  @HttpCode(201)
  creer(@Body(new ZodPipe(SchemaAlbum)) corps: CorpsAlbum, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.galerie.creerAlbum(corps, utilisateur.id)
  }

  @Patch('albums/:id')
  modifier(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationAlbum)) corps: CorpsModificationAlbum,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.galerie.modifierAlbum(id, corps, utilisateur.id)
  }

  @Delete('albums/:id')
  supprimer(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.galerie.supprimerAlbum(id, utilisateur.id)
  }

  @Post('albums/:id/medias')
  @HttpCode(201)
  ajouterMedia(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaAjoutMedia)) corps: CorpsAjoutMedia,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.galerie.ajouterMedia(id, corps, utilisateur.id)
  }

  @Patch('medias/:id')
  modifierMedia(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationMedia)) corps: CorpsModificationMedia,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.galerie.modifierMedia(id, corps, utilisateur.id)
  }

  @Delete('medias/:id')
  supprimerMedia(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.galerie.supprimerMedia(id, utilisateur.id)
  }
}

// Public : uniquement les photos publiées d'albums publiés, et pour les
// photos de mineurs, après vérification explicite des consentements.
@ApiTags('Site public')
@Public()
@Controller('public/galerie')
export class PublicGalerieController {
  constructor(private readonly galerie: GalerieService) {}

  @Get()
  albums(@Query() requete: Record<string, unknown>) {
    return this.galerie.albumsPublics(requete)
  }

  @Get('medias/:id')
  async fichier(@Param('id') id: string, @Res() reponse: Response) {
    const fichier = await this.galerie.fichierPublic(id)
    reponse.set({
      'Content-Type': fichier.typeMime,
      // Cache court : un retrait de publication ou de consentement doit
      // prendre effet rapidement.
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    })
    reponse.status(200).send(fichier.contenu)
  }

  @Get(':slug')
  album(@Param('slug') slug: string) {
    return this.galerie.albumPublic(slug)
  }
}
