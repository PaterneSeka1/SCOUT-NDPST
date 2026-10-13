import { Global, Module } from '@nestjs/common'
import { AuditService } from './audit.service'
import { PerimetreService } from './perimetre.service'

// Services transverses utilisés par la quasi-totalité des modules métier.
@Global()
@Module({
  providers: [AuditService, PerimetreService],
  exports: [AuditService, PerimetreService],
})
export class CommunModule {}
