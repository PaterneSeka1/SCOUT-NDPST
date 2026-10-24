import { Module } from '@nestjs/common'
import { IndicateursService } from './indicateurs.service'
import { TableauDeBordController } from './tableau-de-bord.controller'

// Indicateurs des tableaux de bord par rôle et rapport d'activité du groupe.
@Module({
  controllers: [TableauDeBordController],
  providers: [IndicateursService],
})
export class TableauDeBordModule {}
