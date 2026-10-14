import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_PLATEFORME } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import type { z } from 'zod'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import { SchemaDesignationCommissaire, SchemaDistrict } from './districts.schemas'
import { DistrictsService } from './districts.service'

@ApiTags('Administration plateforme')
@Roles(...ROLES_PLATEFORME)
@Controller('admin/districts')
export class AdminDistrictsController {
  constructor(private readonly districts: DistrictsService) {}

  @Get()
  lister() {
    return this.districts.lister()
  }

  @Post()
  @HttpCode(201)
  creer(
    @Body(new ZodPipe(SchemaDistrict)) corps: z.infer<typeof SchemaDistrict>,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.districts.creer(corps, utilisateur.id)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.districts.detail(id)
  }

  @Patch(':id')
  modifier(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaDistrict)) corps: z.infer<typeof SchemaDistrict>,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.districts.modifier(id, corps, utilisateur.id)
  }

  @Delete(':id')
  supprimer(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.districts.supprimer(id, utilisateur.id)
  }

  @Post(':id/commissaire')
  @HttpCode(200)
  designerCommissaire(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaDesignationCommissaire)) corps: z.infer<typeof SchemaDesignationCommissaire>,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.districts.designerCommissaire(id, corps, utilisateur.id)
  }

  @Delete(':id/commissaire')
  retirerCommissaire(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.districts.retirerCommissaire(id, utilisateur.id)
  }
}
