import { Module } from '@nestjs/common'
import { FichiersController } from './fichiers.controller'
import { FichiersService } from './fichiers.service'

@Module({
  controllers: [FichiersController],
  providers: [FichiersService],
})
export class FichiersModule {}
