import { Module } from '@nestjs/common'
import { DistrictsService } from './districts.service'
import { AdminDistrictsController } from './districts.controller'
import { ParoissesService } from './paroisses.service'
import { AdminParoissesController } from './paroisses.controller'
import { PlateformeService } from './plateforme.service'
import { AdminAuditController, AdminSiteConfigController } from './plateforme.controller'
import { RapportsService } from './rapports.service'
import { AdminRapportsController } from './rapports.controller'
import { UtilisateursService } from './utilisateurs.service'
import { AdminUtilisateursController } from './utilisateurs.controller'

// Administration plateforme (/api/admin/*), réservée à ADMIN_PLATEFORME
// (@Roles(...ROLES_PLATEFORME) sur chaque contrôleur). Ces routes ne servent
// plus le frontend paroissial mais les futures plateformes district, région
// et nation.
@Module({
  controllers: [
    AdminAuditController,
    AdminSiteConfigController,
    AdminDistrictsController,
    AdminParoissesController,
    AdminRapportsController,
    AdminUtilisateursController,
  ],
  providers: [PlateformeService, DistrictsService, ParoissesService, RapportsService, UtilisateursService],
})
export class AdminModule {}
