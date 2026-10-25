import { Body, Controller, Get, Param, Post, Query, Header } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import {
  SchemaAnneeAdhesion,
  SchemaBaremeAdhesion,
  SchemaCreationAdhesion,
  SchemaEncaissementAdhesion,
  SchemaLotNational,
  SchemaDeclarationNationale,
  SchemaConfirmationNationale,
  SchemaMotifAdhesion,
  SchemaHabilitationAdhesion,
} from '@scout/shared'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import { AdhesionsNationalesService } from './adhesions-nationales.service'

export const SchemaListeAdhesions = z
  .object({
    annee: SchemaAnneeAdhesion,
    branche: z
      .enum(['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS', 'RESSOURCES_ADULTES'])
      .optional(),
    categorie: z.enum(['SCOUT', 'CHEF']).optional(),
    recherche: z.string().trim().max(100).optional(),
    aReverser: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(25),
    tri: z.enum(['createdAt', 'montantDu']).default('createdAt'),
    ordre: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
const SchemaAnneeQuery = z.object({ annee: SchemaAnneeAdhesion }).strict()
const SchemaListeLots = SchemaAnneeQuery.extend({
  page: SchemaListeAdhesions.shape.page,
  limite: SchemaListeAdhesions.shape.limite,
  recherche: SchemaListeAdhesions.shape.recherche,
  ordre: SchemaListeAdhesions.shape.ordre,
})
const SchemaIndicateurs = SchemaAnneeQuery.extend({ branche: SchemaListeAdhesions.shape.branche })

@ApiTags('Adhésions nationales')
@Controller('adhesions-nationales')
export class AdhesionsNationalesController {
  constructor(private readonly service: AdhesionsNationalesService) {}
  @Get()
  lister(
    @UtilisateurCourant() u: UtilisateurSession,
    @Query(new ZodPipe(SchemaListeAdhesions)) f: z.infer<typeof SchemaListeAdhesions>,
  ) {
    return this.service.lister(u, f)
  }
  @Post()
  creer(
    @UtilisateurCourant() u: UtilisateurSession,
    @Body(new ZodPipe(SchemaCreationAdhesion)) c: z.infer<typeof SchemaCreationAdhesion>,
  ) {
    return this.service.creer(u, c)
  }
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="adhesions.csv"')
  exporter(
    @UtilisateurCourant() u: UtilisateurSession,
    @Query(new ZodPipe(SchemaListeAdhesions)) f: z.infer<typeof SchemaListeAdhesions>,
  ) {
    return this.service.exporter(u, f)
  }
  @Get('indicateurs')
  indicateurs(
    @UtilisateurCourant() u: UtilisateurSession,
    @Query(new ZodPipe(SchemaIndicateurs)) f: z.infer<typeof SchemaIndicateurs>,
  ) {
    return this.service.indicateurs(u, f.annee, f.branche)
  }
  @Get('membres')
  membres(
    @UtilisateurCourant() u: UtilisateurSession,
    @Query(
      new ZodPipe(
        z.object({ categorie: z.enum(['SCOUT', 'CHEF']), recherche: z.string().trim().max(100).default('') }).strict(),
      ),
    )
    f: { categorie: 'SCOUT' | 'CHEF'; recherche: string },
  ) {
    return this.service.membres(u, f.categorie, f.recherche)
  }
  @Get('baremes')
  baremes(
    @UtilisateurCourant() u: UtilisateurSession,
    @Query(new ZodPipe(SchemaAnneeQuery)) f: z.infer<typeof SchemaAnneeQuery>,
  ) {
    return this.service.baremes(u, f.annee)
  }
  @Post('baremes')
  creerBareme(
    @UtilisateurCourant() u: UtilisateurSession,
    @Body(new ZodPipe(SchemaBaremeAdhesion)) c: z.infer<typeof SchemaBaremeAdhesion>,
  ) {
    return this.service.creerBareme(u, c)
  }
  @Post('baremes/:id/desactiver')
  desactiverBareme(@UtilisateurCourant() u: UtilisateurSession, @Param('id') id: string) {
    return this.service.desactiverBareme(u, id)
  }
  @Get('habilitations')
  habilitations(@UtilisateurCourant() u: UtilisateurSession) {
    return this.service.habilitations(u)
  }
  @Post('habilitations')
  habiliter(
    @UtilisateurCourant() u: UtilisateurSession,
    @Body(new ZodPipe(SchemaHabilitationAdhesion)) c: z.infer<typeof SchemaHabilitationAdhesion>,
  ) {
    return this.service.habiliter(u, c)
  }
  @Post('habilitations/:id/revoquer')
  revoquer(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaMotifAdhesion)) c: z.infer<typeof SchemaMotifAdhesion>,
  ) {
    return this.service.revoquer(u, id, c.motif)
  }
  @Get('lots-reversement')
  lots(
    @UtilisateurCourant() u: UtilisateurSession,
    @Query(new ZodPipe(SchemaListeLots)) f: z.infer<typeof SchemaListeLots>,
  ) {
    return this.service.lots(u, f)
  }
  @Post('lots-reversement')
  creerLot(
    @UtilisateurCourant() u: UtilisateurSession,
    @Body(new ZodPipe(SchemaLotNational)) c: z.infer<typeof SchemaLotNational>,
  ) {
    return this.service.creerLot(u, c)
  }
  @Get('lots-reversement/:id')
  lot(@UtilisateurCourant() u: UtilisateurSession, @Param('id') id: string) {
    return this.service.lot(u, id)
  }
  @Post('lots-reversement/:id/declarer')
  declarer(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaDeclarationNationale)) c: z.infer<typeof SchemaDeclarationNationale>,
  ) {
    return this.service.declarer(u, id, c)
  }
  @Post('lots-reversement/:id/confirmer')
  confirmer(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaConfirmationNationale)) c: z.infer<typeof SchemaConfirmationNationale>,
  ) {
    return this.service.confirmer(u, id, c)
  }
  @Post('lots-reversement/:id/anomalie')
  anomalie(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaMotifAdhesion)) c: z.infer<typeof SchemaMotifAdhesion>,
  ) {
    return this.service.anomalieLot(u, id, c.motif)
  }
  @Get(':id')
  detail(@UtilisateurCourant() u: UtilisateurSession, @Param('id') id: string) {
    return this.service.detail(u, id)
  }
  @Post(':id/examen')
  examiner(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Body(
      new ZodPipe(
        SchemaMotifAdhesion.extend({ decision: z.enum(['RAPPROCHER_LOCAL', 'EXONERER', 'ANNULER_EXONERATION']) }),
      ),
    )
    c: { decision: 'RAPPROCHER_LOCAL' | 'EXONERER' | 'ANNULER_EXONERATION'; motif: string },
  ) {
    return this.service.examiner(u, id, c.decision, c.motif)
  }
  @Post(':id/encaissements')
  encaisser(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaEncaissementAdhesion)) c: z.infer<typeof SchemaEncaissementAdhesion>,
  ) {
    return this.service.encaisser(u, id, c)
  }
  @Post(':id/encaissements/:encaissementId/annuler')
  annuler(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Param('encaissementId') encaissementId: string,
    @Body(new ZodPipe(SchemaMotifAdhesion)) c: z.infer<typeof SchemaMotifAdhesion>,
  ) {
    return this.service.annulerEncaissement(u, id, encaissementId, c.motif)
  }
}
