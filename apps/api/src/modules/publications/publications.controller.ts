import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { EditeurContenu } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaCategorie,
  SchemaCreationPublication,
  SchemaModificationPublication,
  SchemaPublier,
  type CorpsCategorie,
  type CorpsCreationPublication,
  type CorpsModificationPublication,
} from './publications.schemas'
import { PublicationsService } from './publications.service'

// CMS des actualités : administrateur et comptes explicitement désignés.
@ApiTags('Administration — contenus')
@EditeurContenu()
@Controller('admin/publications')
export class AdminPublicationsController {
  constructor(private readonly publications: PublicationsService) {}

  @Get()
  lister(@Query() requete: Record<string, unknown>) {
    return this.publications.lister(requete)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.publications.detail(id)
  }

  @Post()
  @HttpCode(201)
  creer(
    @Body(new ZodPipe(SchemaCreationPublication)) corps: CorpsCreationPublication,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.publications.creer(corps, utilisateur.id)
  }

  @Patch(':id')
  modifier(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationPublication)) corps: CorpsModificationPublication,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.publications.modifier(id, corps, utilisateur.id)
  }

  @Post(':id/publier')
  @HttpCode(200)
  publier(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaPublier)) corps: { datePublication?: Date | null },
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.publications.publier(id, corps.datePublication, utilisateur.id)
  }

  @Post(':id/depublier')
  @HttpCode(200)
  depublier(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.publications.changerStatut(id, 'BROUILLON', utilisateur.id)
  }

  @Post(':id/archiver')
  @HttpCode(200)
  archiver(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.publications.changerStatut(id, 'ARCHIVEE', utilisateur.id)
  }

  @Delete(':id')
  supprimer(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.publications.supprimer(id, utilisateur.id)
  }
}

@ApiTags('Administration — contenus')
@EditeurContenu()
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly publications: PublicationsService) {}

  @Get()
  lister() {
    return this.publications.categories()
  }

  @Post()
  @HttpCode(201)
  creer(@Body(new ZodPipe(SchemaCategorie)) corps: CorpsCategorie) {
    return this.publications.creerCategorie(corps)
  }

  @Patch(':id')
  modifier(@Param('id') id: string, @Body(new ZodPipe(SchemaCategorie)) corps: CorpsCategorie) {
    return this.publications.modifierCategorie(id, corps)
  }

  @Delete(':id')
  supprimer(@Param('id') id: string) {
    return this.publications.supprimerCategorie(id)
  }
}

// Public : seules les publications au statut PUBLIEE dont la date de
// publication est atteinte sont exposées.
@ApiTags('Site public')
@Public()
@Controller('public')
export class PublicPublicationsController {
  constructor(private readonly publications: PublicationsService) {}

  @Get('publications')
  lister(@Query() requete: Record<string, unknown>) {
    return this.publications.listerPubliques(requete)
  }

  @Get('publications/:slug')
  detail(@Param('slug') slug: string) {
    return this.publications.detailPublic(slug)
  }

  @Get('categories')
  categories() {
    return this.publications.categoriesPubliques()
  }
}
