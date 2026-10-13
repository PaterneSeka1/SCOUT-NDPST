import { Module } from '@nestjs/common'
import { IndicateursService } from './indicateurs.service'
import { ParoisseController, RapportsController, TableauDeBordController } from './paroisse.controller'
import { ParoisseService } from './paroisse.service'

// Fiche paroisse, indicateurs du tableau de bord et rapport d'activité.
@Module({
  controllers: [ParoisseController, TableauDeBordController, RapportsController],
  providers: [ParoisseService, IndicateursService],
})
export class ParoisseModule {}
