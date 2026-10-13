import { Module } from '@nestjs/common'
import { ProfilController } from './profil.controller'
import { ProfilService } from './profil.service'

// Espace personnel (me, mes-enfants, ma-progression). PrismaService,
// AuditService et AuthService viennent de modules globaux.
@Module({
  controllers: [ProfilController],
  providers: [ProfilService],
})
export class ProfilModule {}
