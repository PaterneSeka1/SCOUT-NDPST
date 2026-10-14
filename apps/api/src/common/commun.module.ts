import { Global, Module, type OnApplicationShutdown } from '@nestjs/common'
import { AccesFichiersService } from './acces-fichiers.service'
import { AuditService } from './audit.service'
import { fermerLimiteur } from './lib/rateLimit'
import { PerimetreService } from './perimetre.service'

// Services transverses utilisés par la quasi-totalité des modules métier.
@Global()
@Module({
  providers: [AccesFichiersService, AuditService, PerimetreService],
  exports: [AccesFichiersService, AuditService, PerimetreService],
})
export class CommunModule implements OnApplicationShutdown {
  // Connexion Redis du limiteur de tentatives (si REDIS_URL) : fermée à l'arrêt.
  async onApplicationShutdown(): Promise<void> {
    await fermerLimiteur()
  }
}
