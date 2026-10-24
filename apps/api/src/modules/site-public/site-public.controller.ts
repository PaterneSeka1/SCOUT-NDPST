import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { EditeurContenu } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import { ConfigurationService } from '../configuration/configuration.service'
import { SchemaBranche, type CorpsBranche } from './site-public.schemas'
import { SitePublicService } from './site-public.service'

// Site public : consultable sans compte. Ne renvoie que des données
// explicitement publiées (configuration, branches publiées, activités
// publiques, membres ayant accepté un profil public). Aucune fiche de scout.
@ApiTags('Site public')
@Public()
@Controller('public')
export class SitePublicController {
  constructor(
    private readonly site: SitePublicService,
    private readonly configuration: ConfigurationService,
  ) {}

  @Get('identite')
  identite() {
    return this.configuration.identitePublique()
  }

  @Get('accueil')
  accueil() {
    return this.site.accueil()
  }

  @Get('branches')
  branches() {
    return this.site.branches()
  }

  @Get('branches/:slug')
  branche(@Param('slug') slug: string) {
    return this.site.branche(slug)
  }

  @Get('equipe')
  equipe() {
    return this.site.equipe()
  }

  @Get('activites')
  activites(@Query() requete: Record<string, unknown>) {
    return this.site.activites(requete)
  }
}

@ApiTags('Administration — contenus')
@EditeurContenu()
@Controller('admin/branches')
export class AdminBranchesController {
  constructor(private readonly site: SitePublicService) {}

  @Get()
  lister() {
    return this.site.listerBranchesAdmin()
  }

  @Patch(':type')
  modifier(
    @Param('type') type: string,
    @Body(new ZodPipe(SchemaBranche)) corps: CorpsBranche,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.site.modifierBranche(type, corps, utilisateur.id)
  }
}
