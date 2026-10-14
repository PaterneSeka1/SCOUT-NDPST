import { Controller, Headers, HttpCode, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { verifierSecretCron } from '../../common/lib/cron'
import { MaintenanceService } from './maintenance.service'

@ApiTags('Maintenance')
@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  // Tâche planifiée quotidienne (cron du serveur, en-tête x-cron-secret) :
  // voir docs/deploiement-ovh.md, « Tâches planifiées ».
  @Public()
  @Post('cron/purge')
  @HttpCode(200)
  purger(@Headers('x-cron-secret') secret: string | undefined) {
    verifierSecretCron(secret)
    return this.maintenance.purger()
  }
}
