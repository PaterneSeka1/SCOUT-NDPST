import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { AuthModule } from './auth/auth.module'
import { CommunModule } from './common/commun.module'
import { FiltreErreurs } from './common/filters/erreurs.filter'
import { AuthGuard } from './common/guards/auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { ActivitesModule } from './modules/activites/activites.module'
import { AdhesionsModule } from './modules/adhesions/adhesions.module'
import { AdminModule } from './modules/admin/admin.module'
import { CalendrierModule } from './modules/calendrier/calendrier.module'
import { ConfigurationModule } from './modules/configuration/configuration.module'
import { CotisationsModule } from './modules/cotisations/cotisations.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { FichiersModule } from './modules/fichiers/fichiers.module'
import { GalerieModule } from './modules/galerie/galerie.module'
import { HistoireModule } from './modules/histoire/histoire.module'
import { MaintenanceModule } from './modules/maintenance/maintenance.module'
import { ProfilModule } from './modules/profil/profil.module'
import { ProgrammesModule } from './modules/programmes/programmes.module'
import { ProgressionModule } from './modules/progression/progression.module'
import { PublicationsModule } from './modules/publications/publications.module'
import { ReunionsModule } from './modules/reunions/reunions.module'
import { ScoutsModule } from './modules/scouts/scouts.module'
import { SitePublicModule } from './modules/site-public/site-public.module'
import { TableauDeBordModule } from './modules/tableau-de-bord/tableau-de-bord.module'
import { UtilisateursModule } from './modules/utilisateurs/utilisateurs.module'
import { PrismaModule } from './prisma/prisma.module'
import { SanteController } from './sante/sante.controller'

@Module({
  imports: [
    // Secret et options passés explicitement à chaque signature/vérification
    // (AuthService, AuthGuard) : rien n'est configuré globalement ici.
    JwtModule.register({ global: true }),
    PrismaModule,
    CommunModule,
    AuthModule,
    // Modules métier.
    ConfigurationModule,
    ActivitesModule,
    AdhesionsModule,
    AdminModule,
    CalendrierModule,
    CotisationsModule,
    DocumentsModule,
    FichiersModule,
    GalerieModule,
    HistoireModule,
    MaintenanceModule,
    ProfilModule,
    ProgrammesModule,
    ProgressionModule,
    PublicationsModule,
    ReunionsModule,
    ScoutsModule,
    SitePublicModule,
    TableauDeBordModule,
    UtilisateursModule,
  ],
  controllers: [SanteController],
  providers: [
    // Ordre significatif : authentification puis rôles, refus par défaut.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: FiltreErreurs },
  ],
})
export class AppModule {}
