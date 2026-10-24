import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_TOUT_STAFF } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { BranchesService } from './branches.service'

@ApiTags('Scouts')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @Roles(...ROLES_TOUT_STAFF)
  synthese() {
    return this.branches.synthese()
  }
}
