import { Module } from '@nestjs/common'
import { ActivitesController } from './activites.controller'
import { ActivitesService } from './activites.service'

// Activités paroissiales : calendrier, présences et autorisations de camp.
@Module({
  controllers: [ActivitesController],
  providers: [ActivitesService],
})
export class ActivitesModule {}
