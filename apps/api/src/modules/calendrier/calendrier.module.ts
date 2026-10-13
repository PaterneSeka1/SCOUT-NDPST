import { Module } from '@nestjs/common'
import { CalendrierController } from './calendrier.controller'
import { CalendrierService } from './calendrier.service'

@Module({
  controllers: [CalendrierController],
  providers: [CalendrierService],
})
export class CalendrierModule {}
