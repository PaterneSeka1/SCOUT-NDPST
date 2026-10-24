import { Module } from '@nestjs/common'
import { AdminHistoireController, PublicHistoireController } from './histoire.controller'
import { HistoireService } from './histoire.service'

@Module({
  controllers: [AdminHistoireController, PublicHistoireController],
  providers: [HistoireService],
})
export class HistoireModule {}
