import { Module } from '@nestjs/common'
import { AdhesionsNationalesController } from './adhesions-nationales.controller'
import { AdhesionsNationalesService } from './adhesions-nationales.service'
@Module({
  controllers: [AdhesionsNationalesController],
  providers: [AdhesionsNationalesService],
  exports: [AdhesionsNationalesService],
})
export class AdhesionsNationalesModule {}
