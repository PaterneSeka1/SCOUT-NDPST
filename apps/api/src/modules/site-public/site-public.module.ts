import { Module } from '@nestjs/common'
import { GalerieModule } from '../galerie/galerie.module'
import { PublicationsModule } from '../publications/publications.module'
import { AdminBranchesController, SitePublicController } from './site-public.controller'
import { SitePublicService } from './site-public.service'

@Module({
  imports: [PublicationsModule, GalerieModule],
  controllers: [SitePublicController, AdminBranchesController],
  providers: [SitePublicService],
})
export class SitePublicModule {}
