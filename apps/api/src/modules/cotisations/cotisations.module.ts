import { Module } from '@nestjs/common'
import { CotisationsController } from './cotisations.controller'
import { CotisationsService } from './cotisations.service'

@Module({
  controllers: [CotisationsController],
  providers: [CotisationsService],
})
export class CotisationsModule {}
