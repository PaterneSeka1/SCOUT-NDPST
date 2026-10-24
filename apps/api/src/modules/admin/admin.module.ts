import { Module } from '@nestjs/common'
import { PlateformeService } from './plateforme.service'
import { AdminAuditController } from './plateforme.controller'
import { RapportsService } from './rapports.service'
import { AdminRapportsController } from './rapports.controller'
import { UtilisateursService } from './utilisateurs.service'
import { AdminUtilisateursController } from './utilisateurs.controller'

// Administration de l'installation (/api/admin/*) : comptes, journal
// d'audit, synthèse et exports. Rôles déclarés sur chaque contrôleur.
@Module({
  controllers: [
    AdminAuditController,
    AdminRapportsController,
    AdminUtilisateursController,
  ],
  providers: [PlateformeService, RapportsService, UtilisateursService],
})
export class AdminModule {}
