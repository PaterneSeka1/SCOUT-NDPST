import { Module } from '@nestjs/common'
import { ReunionsController } from './reunions.controller'
import { ReunionsService } from './reunions.service'

// Réunions hebdomadaires de branche : planification, présences, export CSV et
// configuration par branche.
@Module({
  controllers: [ReunionsController],
  providers: [ReunionsService],
})
export class ReunionsModule {}
