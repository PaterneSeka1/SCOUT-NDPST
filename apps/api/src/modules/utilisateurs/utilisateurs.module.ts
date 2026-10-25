import { ResponsabilitesController } from './responsabilites.controller'
import { Module } from '@nestjs/common'
import { UtilisateursController } from './utilisateurs.controller'
import { UtilisateursService } from './utilisateurs.service'

// PrismaService, AuditService et AuthService viennent de modules globaux.
@Module({
  controllers: [UtilisateursController, ResponsabilitesController],
  providers: [UtilisateursService],
})
export class UtilisateursModule {}
