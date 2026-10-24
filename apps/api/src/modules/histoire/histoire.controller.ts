import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { EditeurContenu } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaEvenement,
  SchemaModificationEvenement,
  type CorpsEvenement,
  type CorpsModificationEvenement,
} from './histoire.schemas'
import { HistoireService } from './histoire.service'

@ApiTags('Administration — contenus')
@EditeurContenu()
@Controller('admin/histoire')
export class AdminHistoireController {
  constructor(private readonly histoire: HistoireService) {}

  @Get()
  lister() {
    return this.histoire.lister()
  }

  @Post()
  @HttpCode(201)
  creer(@Body(new ZodPipe(SchemaEvenement)) corps: CorpsEvenement, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.histoire.creer(corps, utilisateur.id)
  }

  @Patch(':id')
  modifier(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationEvenement)) corps: CorpsModificationEvenement,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.histoire.modifier(id, corps, utilisateur.id)
  }

  @Delete(':id')
  supprimer(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.histoire.supprimer(id, utilisateur.id)
  }
}

@ApiTags('Site public')
@Public()
@Controller('public/histoire')
export class PublicHistoireController {
  constructor(private readonly histoire: HistoireService) {}

  @Get()
  lister() {
    return this.histoire.publics()
  }
}
