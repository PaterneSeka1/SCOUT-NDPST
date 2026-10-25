import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { z } from 'zod'
import { ROLES_BRANCHE, ROLES_TOUT_STAFF, SchemaMotifAdhesion } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '../../generated/prisma/client'

const SchemaMandat = z
  .object({
    role: z.enum([
      'CHEF_GROUPE',
      'ADJOINT_GROUPE',
      'ASSISTANT_GROUPE',
      'RESPONSABLE_BRANCHE',
      'ADJOINT_BRANCHE',
      'ASSISTANT_BRANCHE',
    ]),
    brancheType: z
      .enum(['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS', 'RESSOURCES_ADULTES'])
      .nullable()
      .default(null),
    motif: z.string().trim().min(5).max(1000),
  })
  .strict()
  .refine((c) => (ROLES_BRANCHE.includes(c.role) ? !!c.brancheType : !c.brancheType), 'Périmètre incohérent')

@Controller()
export class ResponsabilitesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('comptes-mandats')
  @Roles('ADMINISTRATEUR', 'CHEF_GROUPE')
  comptes(
    @Query(new ZodPipe(z.object({ recherche: z.string().trim().max(100).default('') }).strict()))
    f: {
      recherche: string
    },
  ) {
    return this.prisma.utilisateur.findMany({
      where: {
        actif: true,
        OR: [
          { nom: { contains: f.recherche, mode: 'insensitive' } },
          { prenom: { contains: f.recherche, mode: 'insensitive' } },
          { matricule: { contains: f.recherche, mode: 'insensitive' } },
        ],
      },
      select: { id: true, nom: true, prenom: true },
      take: 50,
      orderBy: { nom: 'asc' },
    })
  }
  @Get('mandats')
  @Roles('ADMINISTRATEUR', ...ROLES_TOUT_STAFF)
  async lister(
    @Query(
      new ZodPipe(
        z
          .object({
            utilisateurId: z.string().min(1).max(100).optional(),
            recherche: z.string().trim().max(100).default(''),
            page: z.coerce.number().int().min(1).max(100000).default(1),
            limite: z.coerce.number().int().min(1).max(100).default(25),
            ordre: z.enum(['asc', 'desc']).default('desc'),
            statut: z.enum(['actif', 'clos']).optional(),
          })
          .strict(),
      ),
    )
    f: {
      utilisateurId?: string
      recherche: string
      page: number
      limite: number
      ordre: 'asc' | 'desc'
      statut?: 'actif' | 'clos'
    },
  ) {
    const where: Prisma.MandatWhereInput = {
      ...(f.utilisateurId ? { utilisateurId: f.utilisateurId } : {}),
      ...(f.recherche
        ? {
            utilisateur: {
              OR: [
                { nom: { contains: f.recherche, mode: 'insensitive' } },
                { prenom: { contains: f.recherche, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      ...(f.statut === 'actif'
        ? { debutLe: { lte: new Date() }, OR: [{ finLe: null }, { finLe: { gt: new Date() } }] }
        : f.statut === 'clos'
          ? { finLe: { lte: new Date() } }
          : {}),
    }
    const [mandats, total] = await this.prisma.$transaction([
      this.prisma.mandat.findMany({
        where,
        include: { utilisateur: { select: { id: true, nom: true, prenom: true, actif: true } } },
        orderBy: [{ debutLe: f.ordre }, { id: 'asc' }],
        skip: (f.page - 1) * f.limite,
        take: f.limite,
      }),
      this.prisma.mandat.count({ where }),
    ])
    return { mandats, pagination: { page: f.page, limite: f.limite, total, totalPages: Math.ceil(total / f.limite) } }
  }
  @Post('utilisateurs/:id/mandats')
  @Roles('ADMINISTRATEUR', 'CHEF_GROUPE')
  async attribuer(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaMandat)) c: z.infer<typeof SchemaMandat>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Utilisateur" WHERE id = ${id} FOR UPDATE`
        const cible = await tx.utilisateur.findUnique({ where: { id }, select: { actif: true } })
        if (!cible?.actif) throw new NotFoundException('Compte actif introuvable')
        const mandat = await tx.mandat.create({ data: { ...c, utilisateurId: id, auteurId: u.id } })
        await tx.journalAudit.create({
          data: {
            acteurId: u.id,
            action: 'MANDAT_ATTRIBUE',
            entite: 'Mandat',
            entiteId: mandat.id,
            details: { utilisateurId: id, ...c },
          },
        })
        return mandat
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException('Fonction déjà attribuée ou poste unique déjà occupé')
      throw e
    }
  }
  @Patch('mandats/:id')
  @Roles('ADMINISTRATEUR', 'CHEF_GROUPE')
  async clore(
    @UtilisateurCourant() u: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaMotifAdhesion)) c: z.infer<typeof SchemaMotifAdhesion>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.mandat.findUnique({ where: { id } })
      if (!initial) throw new NotFoundException('Mandat introuvable')
      await tx.$queryRaw`SELECT id FROM "Utilisateur" WHERE id = ${initial.utilisateurId} FOR UPDATE`
      const mandat = await tx.mandat.findUniqueOrThrow({ where: { id } })
      if (mandat.finLe) throw new ConflictException('Mandat déjà clos')
      if (mandat.utilisateurId === u.id && mandat.role === 'CHEF_GROUPE' && u.role !== 'ADMINISTRATEUR')
        throw new ForbiddenException('Le transfert de direction doit être effectué par un administrateur')
      const resultat = await tx.mandat.update({ where: { id }, data: { finLe: new Date() } })
      await tx.journalAudit.create({
        data: {
          acteurId: u.id,
          action: 'MANDAT_CLOS',
          entite: 'Mandat',
          entiteId: id,
          details: { motif: c.motif, utilisateurId: mandat.utilisateurId },
        },
      })
      return resultat
    })
  }
}
