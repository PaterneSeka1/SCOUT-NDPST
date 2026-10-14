import { Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_TOUT_STAFF } from '@scout/shared'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { DocumentsService } from './documents.service'

@ApiTags('Documents')
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('documents/expirations')
  @Roles(...ROLES_TOUT_STAFF)
  expirations(@UtilisateurCourant() utilisateur: UtilisateurSession, @Query('joursAvant') joursAvant: unknown) {
    return this.documents.expirations(utilisateur, typeof joursAvant === 'string' ? joursAvant : undefined)
  }

  // Public : endpoint destiné à un déclencheur externe (cron du serveur…)
  // plutôt qu'à un usage interactif — authentifié par le secret partagé
  // CRON_SECRET (en-tête x-cron-secret, comparé en temps constant) et non par
  // une session.
  // POST : la route envoie des e-mails, elle ne doit pas être déclenchée par
  // un simple GET (préchargement, robot, journal de proxy rejoué).
  @Public()
  @Post('cron/rappels-documents')
  @HttpCode(200)
  async rappelsDocuments(@Headers('x-cron-secret') secret: string | undefined) {
    this.documents.verifierSecretCron(secret)
    return this.documents.envoyerRappels()
  }
}
