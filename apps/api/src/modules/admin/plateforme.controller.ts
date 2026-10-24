import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_SUPERVISION } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { PlateformeService } from './plateforme.service'

// Journal d'audit : administrateur et Chef de Groupe.
@ApiTags('Administration')
@Roles(...ROLES_SUPERVISION)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly plateforme: PlateformeService) {}

  @Get()
  journal(@Query() requete: Record<string, unknown>) {
    return this.plateforme.journalAudit(requete)
  }
}
