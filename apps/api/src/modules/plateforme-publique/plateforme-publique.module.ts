import { Module } from '@nestjs/common'
import { PlateformePubliqueController } from './plateforme-publique.controller'

@Module({
  controllers: [PlateformePubliqueController],
})
export class PlateformePubliqueModule {}
