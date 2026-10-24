import { Module } from '@nestjs/common'
import { AdminDemandesController, PublicDemandesController } from './adhesions.controller'
import { AdhesionsService } from './adhesions.service'

@Module({
  controllers: [PublicDemandesController, AdminDemandesController],
  providers: [AdhesionsService],
})
export class AdhesionsModule {}
