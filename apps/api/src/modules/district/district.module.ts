import { Module } from '@nestjs/common'
import { DistrictController } from './district.controller'
import { DistrictService } from './district.service'

// Espace district (future plateforme district). PrismaService, AuditService,
// PerimetreService et AuthService sont fournis par des modules globaux.
@Module({
  controllers: [DistrictController],
  providers: [DistrictService],
})
export class DistrictModule {}
