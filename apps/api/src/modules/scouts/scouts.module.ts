import { Module } from '@nestjs/common'
import { AccesScoutsService } from './acces-scouts.service'
import { BranchesController } from './branches.controller'
import { BranchesService } from './branches.service'
import { FicheScoutService } from './fiche-scout.service'
import { PassageBrancheService } from './passage-branche.service'
import { ProgressionsService } from './progressions.service'
import { ScoutsController } from './scouts.controller'
import { ScoutsService } from './scouts.service'

// Domaine scouts : fiches, contacts d'urgence, documents, matricule, compte
// utilisateur, progressions (badges), import en masse, passage de branche, et
// synthèse des branches. PrismaService, AuditService et PerimetreService
// viennent des modules globaux.
@Module({
  controllers: [ScoutsController, BranchesController],
  providers: [
    AccesScoutsService,
    ScoutsService,
    FicheScoutService,
    ProgressionsService,
    PassageBrancheService,
    BranchesService,
  ],
  exports: [AccesScoutsService],
})
export class ScoutsModule {}
