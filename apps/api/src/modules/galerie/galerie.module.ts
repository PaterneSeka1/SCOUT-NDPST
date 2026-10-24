import { Module } from '@nestjs/common'
import { AdminGalerieController, PublicGalerieController } from './galerie.controller'
import { GalerieService } from './galerie.service'

@Module({
  controllers: [AdminGalerieController, PublicGalerieController],
  providers: [GalerieService],
  exports: [GalerieService],
})
export class GalerieModule {}
