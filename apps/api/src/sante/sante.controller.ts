import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../common/decorators/public.decorator'
import { PrismaService } from '../prisma/prisma.service'

@ApiTags('Santé')
@Controller('sante')
export class SanteController {
  constructor(private readonly prisma: PrismaService) {}

  // Public : sonde de disponibilité pour PM2, Nginx et la supervision.
  // Ne renvoie aucune information sur la configuration.
  @Public()
  @Get()
  async verifier() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { statut: 'ok' }
    } catch {
      throw new ServiceUnavailableException('Base de données indisponible')
    }
  }
}
