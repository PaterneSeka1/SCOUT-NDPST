import { homonymeFinancier } from './identite'
import { champCsv } from '../../common/lib/csv'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  syntheseAdhesion,
  type PermissionAdhesion,
  type SchemaBaremeAdhesion,
  type SchemaCreationAdhesion,
  type SchemaEncaissementAdhesion,
  type SchemaLotNational,
  type SchemaDeclarationNationale,
  type SchemaConfirmationNationale,
  type SchemaHabilitationAdhesion,
} from '@scout/shared'
import type { z } from 'zod'
import { Prisma, type BrancheType } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { UtilisateurSession } from '../../common/types'

type Tx = Prisma.TransactionClient
const membre = { id: true, nom: true, prenom: true, matricule: true } as const
export const DETAIL_ADHESION = {
  personne: { include: { scout: { select: membre }, utilisateur: { select: membre } } },
  bareme: true,
  encaissements: { include: { annulation: true }, orderBy: { createdAt: 'asc' } },
  lignes: { include: { lot: true } },
  confirmations: { include: { correction: true } },
} satisfies Prisma.AdhesionAnnuelleInclude

@Injectable()
export class AdhesionsNationalesService {
  constructor(private readonly prisma: PrismaService) {}

  // Une habilitation permet la lecture dans son périmètre, jamais une autre mutation.
  private async perimetre(tx: Tx, u: UtilisateurSession, permission: PermissionAdhesion) {
    const compte = await tx.utilisateur.findUnique({
      where: { id: u.id },
      select: { actif: true, habilitationsAdhesion: { where: { revoqueeLe: null } } },
    })
    if (!compte?.actif) throw new ForbiddenException('Compte inactif')
    const droits = compte.habilitationsAdhesion.filter((d) => permission === 'LIRE' || d.permission === permission)
    if (!droits.length) throw new ForbiddenException('Habilitation financière requise')
    return droits.some((d) => d.brancheType === null) ? null : droits.map((d) => d.brancheType!)
  }

  private async autoriser(tx: Tx, u: UtilisateurSession, permission: PermissionAdhesion, branche?: BrancheType | null) {
    const branches = await this.perimetre(tx, u, permission)
    if (branches !== null && (!branche || !branches.includes(branche)))
      throw new ForbiddenException('Hors de votre périmètre financier')
  }

  private audit(tx: Tx, u: UtilisateurSession, action: string, entiteId: string, details: Prisma.InputJsonObject = {}) {
    return tx.journalAudit.create({ data: { acteurId: u.id, action, entite: 'AdhesionNationale', entiteId, details } })
  }

  // Les conflits d'unicité et de sérialisation sont des erreurs métier récupérables.
  private async transaction<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, { timeout: 15000 })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) {
        throw new ConflictException(
          'Opération concurrente ou déjà enregistrée. Rechargez puis réessayez avec la même référence.',
        )
      }
      throw e
    }
  }

  private async verrouiller(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM "AdhesionAnnuelle" WHERE id = ${id} FOR UPDATE`
    const a = await tx.adhesionAnnuelle.findUnique({ where: { id }, include: DETAIL_ADHESION })
    if (!a) throw new NotFoundException('Adhésion introuvable')
    return a
  }

  private async filtre(
    u: UtilisateurSession,
    f: { annee: string; branche?: BrancheType; categorie?: 'SCOUT' | 'CHEF'; recherche?: string; aReverser?: boolean },
  ) {
    const branches = await this.perimetre(this.prisma, u, 'LIRE')
    if (branches && f.branche && !branches.includes(f.branche)) throw new ForbiddenException('Branche non autorisée')
    const recherche = f.recherche
      ? {
          OR: ['nom', 'prenom', 'matricule'].map((champ) => ({
            [champ]: { contains: f.recherche, mode: 'insensitive' },
          })),
        }
      : undefined
    return {
      annee: f.annee,
      ...(branches
        ? { brancheType: { in: f.branche ? [f.branche] : branches } }
        : f.branche
          ? { brancheType: f.branche }
          : {}),
      ...(f.categorie ? { categorie: f.categorie } : {}),
      ...(recherche ? { personne: { OR: [{ scout: recherche }, { utilisateur: recherche }] } } : {}),
      ...(f.aReverser
        ? {
            aVerifier: false,
            exoneree: false,
            montantDu: { gt: 0 },
            montantEncaisse: { equals: this.prisma.adhesionAnnuelle.fields.montantDu },
            lignes: { none: { engagee: true } },
            confirmations: { none: { correction: null } },
          }
        : {}),
    } as Prisma.AdhesionAnnuelleWhereInput
  }

  async lister(
    u: UtilisateurSession,
    f: {
      annee: string
      branche?: BrancheType
      categorie?: 'SCOUT' | 'CHEF'
      recherche?: string
      aReverser?: boolean
      page: number
      limite: number
      tri: 'createdAt' | 'montantDu'
      ordre: 'asc' | 'desc'
    },
  ) {
    const where = await this.filtre(u, f)
    const [adhesions, total] = await this.prisma.$transaction([
      this.prisma.adhesionAnnuelle.findMany({
        where,
        include: DETAIL_ADHESION,
        orderBy: [{ [f.tri]: f.ordre }, { id: 'asc' }],
        skip: (f.page - 1) * f.limite,
        take: f.limite,
      }),
      this.prisma.adhesionAnnuelle.count({ where }),
    ])
    return {
      adhesions: adhesions.map(syntheseAdhesion),
      pagination: { page: f.page, limite: f.limite, total, totalPages: Math.ceil(total / f.limite) },
    }
  }

  async exporter(u: UtilisateurSession, f: Parameters<AdhesionsNationalesService['lister']>[1]) {
    const lignes = [
      [
        'Nom',
        'Catégorie',
        'Branche',
        'Matricule',
        'Année',
        'Barème',
        'Dû FCFA',
        'Encaissé FCFA',
        'Solde FCFA',
        'Collecte locale',
        'Reversement',
        'National',
      ],
    ]
    for (let page = 1; ; page++) {
      const resultat = await this.lister(u, { ...f, page, limite: 100 })
      if (resultat.pagination.total > 10000)
        throw new BadRequestException('Export limité à 10 000 adhésions : précisez les filtres')
      for (const a of resultat.adhesions) {
        const m = a.personne.utilisateur ?? a.personne.scout
        lignes.push([
          `${m?.prenom ?? ''} ${m?.nom ?? ''}`,
          a.categorie,
          a.brancheType ?? '',
          m?.matricule ?? '',
          a.annee,
          a.bareme?.libelle ?? 'Reprise historique',
          String(a.montantDu),
          String(a.montantEncaisse),
          String(a.solde),
          a.situationLocale,
          a.situationReversement,
          a.statutNational,
        ])
      }
      if (page >= resultat.pagination.totalPages) break
    }
    await this.audit(this.prisma, u, 'ADHESIONS_EXPORTEES', f.annee, { nombre: lignes.length - 1 })
    return lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')
  }

  async detail(u: UtilisateurSession, id: string) {
    const a = await this.prisma.adhesionAnnuelle.findUnique({ where: { id }, include: DETAIL_ADHESION })
    if (!a) throw new NotFoundException('Adhésion introuvable')
    await this.autoriser(this.prisma, u, 'LIRE', a.brancheType)
    return syntheseAdhesion(a)
  }

  async indicateurs(u: UtilisateurSession, annee: string, branche?: BrancheType) {
    const where = await this.filtre(u, { annee, branche })
    const [totaux, local, confirmer, reverse, aVerifier, membres] = await this.prisma.$transaction([
      this.prisma.adhesionAnnuelle.aggregate({
        where: { AND: [where, { exoneree: false }] },
        _sum: { montantDu: true, montantEncaisse: true },
        _count: true,
      }),
      this.prisma.adhesionAnnuelle.count({
        where: {
          AND: [
            where,
            { montantDu: { gt: 0 }, montantEncaisse: { equals: this.prisma.adhesionAnnuelle.fields.montantDu } },
          ],
        },
      }),
      this.prisma.adhesionAnnuelle.aggregate({
        where: { AND: [where, { confirmations: { some: { correction: null } } }] },
        _sum: { montantDu: true },
        _count: true,
      }),
      this.prisma.ligneReversementNational.aggregate({
        where: {
          adhesion: where,
          engagee: true,
          lot: { statut: { in: ['DECLARE', 'PARTIELLEMENT_CONFIRME', 'CONFIRME', 'ANOMALIE'] } },
        },
        _sum: { montant: true },
      }),
      this.prisma.adhesionAnnuelle.count({ where: { AND: [where, { aVerifier: true }] } }),
      this.prisma.adhesionAnnuelle.count({ where }),
    ])
    const attendu = totaux._sum.montantDu ?? 0,
      encaisse = totaux._sum.montantEncaisse ?? 0,
      reverseTotal = reverse._sum.montant ?? 0
    return {
      annee,
      membres,
      attendu,
      encaisse,
      restant: attendu - encaisse,
      aReverser: encaisse - reverseTotal,
      reverse: reverseTotal,
      confirme: confirmer._sum.montantDu ?? 0,
      aJourLocalement: local,
      cotisantsConfirmes: confirmer._count,
      aVerifier,
    }
  }

  async membres(u: UtilisateurSession, categorie: 'SCOUT' | 'CHEF', recherche: string) {
    const branches = await this.perimetre(this.prisma, u, 'LIRE')
    const nom = {
      OR: [
        { nom: { contains: recherche, mode: 'insensitive' as const } },
        { prenom: { contains: recherche, mode: 'insensitive' as const } },
        { matricule: { contains: recherche, mode: 'insensitive' as const } },
      ],
    }
    if (categorie === 'SCOUT')
      return this.prisma.scout.findMany({
        where: { actif: true, ...nom, ...(branches ? { brancheType: { in: branches } } : {}) },
        select: { ...membre, brancheType: true },
        take: 50,
        orderBy: { nom: 'asc' },
      })
    return this.prisma.utilisateur.findMany({
      where: {
        actif: true,
        ...nom,
        mandats: {
          some: {
            debutLe: { lte: new Date() },
            OR: [{ finLe: null }, { finLe: { gt: new Date() } }],
            ...(branches ? { brancheType: { in: branches } } : {}),
          },
        },
      },
      select: { ...membre, brancheType: true },
      take: 50,
      orderBy: { nom: 'asc' },
    })
  }

  async baremes(u: UtilisateurSession, annee: string) {
    const branches = await this.perimetre(this.prisma, u, 'LIRE')
    return this.prisma.baremeAdhesion.findMany({
      where: { annee, ...(branches ? { OR: [{ brancheType: null }, { brancheType: { in: branches } }] } : {}) },
      orderBy: [{ categorie: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async creerBareme(u: UtilisateurSession, c: z.infer<typeof SchemaBaremeAdhesion>) {
    return this.transaction(async (tx) => {
      await this.autoriser(tx, u, 'BAREMES', c.brancheType)
      const b = await tx.baremeAdhesion.create({
        data: {
          ...c,
          debutValidite: new Date(c.debutValidite),
          finValidite: c.finValidite ? new Date(c.finValidite) : null,
        },
      })
      await this.audit(tx, u, 'BAREME_ADHESION_CREE', b.id, { montant: c.montant })
      return b
    })
  }

  async desactiverBareme(u: UtilisateurSession, id: string) {
    return this.transaction(async (tx) => {
      const b = await tx.baremeAdhesion.findUniqueOrThrow({ where: { id } })
      await this.autoriser(tx, u, 'BAREMES', b.brancheType)
      await tx.baremeAdhesion.update({ where: { id }, data: { actif: false } })
      await this.audit(tx, u, 'BAREME_ADHESION_DESACTIVE', id)
      return { ok: true }
    })
  }

  async creer(u: UtilisateurSession, c: z.infer<typeof SchemaCreationAdhesion>) {
    return this.transaction(async (tx) => {
      // Sérialise la résolution transversale de l'identité, y compris les créations concurrentes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20262027)`
      let scout = c.scoutId ? await tx.scout.findUnique({ where: { id: c.scoutId } }) : null
      let utilisateur = c.utilisateurId ? await tx.utilisateur.findUnique({ where: { id: c.utilisateurId } }) : null
      if ((c.scoutId && !scout) || (c.utilisateurId && !utilisateur)) throw new NotFoundException('Membre introuvable')
      if (scout?.utilisateurId) utilisateur = await tx.utilisateur.findUnique({ where: { id: scout.utilisateurId } })
      if (utilisateur) {
        const lie = await tx.scout.findUnique({ where: { utilisateurId: utilisateur.id } })
        if (lie) scout = lie
      }
      // Un matricule commun est une preuve de rapprochement, jamais le nom seul.
      if (scout?.matricule && !utilisateur)
        utilisateur = await tx.utilisateur.findUnique({ where: { matricule: scout.matricule } })
      if (utilisateur?.matricule && !scout)
        scout = await tx.scout.findUnique({ where: { matricule: utilisateur.matricule } })
      if (
        scout &&
        utilisateur &&
        ((scout.utilisateurId && scout.utilisateurId !== utilisateur.id) ||
          (scout.matricule && utilisateur.matricule && scout.matricule !== utilisateur.matricule))
      ) {
        throw new ConflictException('Identités contradictoires : rapprochement manuel requis')
      }
      const categorie = c.utilisateurId ? 'CHEF' : 'SCOUT'
      if (categorie === 'CHEF') {
        const mandat = await tx.mandat.count({
          where: {
            utilisateurId: utilisateur!.id,
            debutLe: { lte: new Date() },
            OR: [{ finLe: null }, { finLe: { gt: new Date() } }],
          },
        })
        if (!utilisateur?.actif || !mandat) throw new BadRequestException('Un chef doit posséder un mandat actif')
      } else if (!scout?.actif) throw new BadRequestException('Scout inactif')
      const mandatsBranche = utilisateur
        ? await tx.mandat.findMany({
            where: {
              utilisateurId: utilisateur.id,
              debutLe: { lte: new Date() },
              finLe: null,
              brancheType: { not: null },
            },
          })
        : []
      const branchesMembre = [...new Set(mandatsBranche.map((m) => m.brancheType))]
      const branche =
        scout?.brancheType ?? (branchesMembre.length === 1 ? branchesMembre[0] : utilisateur?.brancheType) ?? null
      await this.autoriser(tx, u, 'CREER', branche)
      const b = await tx.baremeAdhesion.findUnique({ where: { id: c.baremeId } })
      const maintenant = new Date()
      if (
        !b?.actif ||
        b.annee !== c.annee ||
        b.categorie !== categorie ||
        (b.brancheType && b.brancheType !== branche) ||
        b.debutValidite > maintenant ||
        (b.finValidite && b.finValidite <= maintenant)
      )
        throw new BadRequestException('Barème incompatible ou hors validité')
      const identites = await tx.personneAdhesion.findMany({
        where: {
          OR: [...(scout ? [{ scoutId: scout.id }] : []), ...(utilisateur ? [{ utilisateurId: utilisateur.id }] : [])],
        },
      })
      if (identites.length > 1)
        throw new ConflictException('Deux identités financières existent : rapprochement manuel requis')
      let personne = identites[0]
      if (!personne) {
        // Homonymes sans matricule/lien : ne jamais créer une seconde identité silencieusement.
        const nom = scout?.nom ?? utilisateur!.nom,
          prenom = scout?.prenom ?? utilisateur!.prenom
        const homonyme = await homonymeFinancier(tx, nom, prenom)
        if (homonyme) throw new ConflictException('Homonyme détecté : vérifier et rapprocher les fiches avant création')
        personne = await tx.personneAdhesion.create({ data: { scoutId: scout?.id, utilisateurId: utilisateur?.id } })
      } else {
        if (
          (scout && personne.scoutId && scout.id !== personne.scoutId) ||
          (utilisateur && personne.utilisateurId && utilisateur.id !== personne.utilisateurId)
        )
          throw new ConflictException('Identité à vérifier')
        personne = await tx.personneAdhesion.update({
          where: { id: personne.id },
          data: { scoutId: scout?.id, utilisateurId: utilisateur?.id },
        })
      }
      const adhesion = await tx.adhesionAnnuelle.create({
        data: {
          annee: c.annee,
          personneId: personne.id,
          categorie,
          brancheType: branche,
          baremeId: b.id,
          montantDu: b.montant,
        },
      })
      await this.audit(tx, u, 'ADHESION_CREEE', adhesion.id, { personneId: personne.id, montantDu: b.montant })
      return adhesion
    })
  }

  async encaisser(u: UtilisateurSession, id: string, c: z.infer<typeof SchemaEncaissementAdhesion>) {
    return this.transaction(async (tx) => {
      const a = await this.verrouiller(tx, id)
      await this.autoriser(tx, u, 'ENCAISSER', a.brancheType)
      const deja = await tx.encaissementAdhesion.findUnique({ where: { idempotence: c.idempotence } })
      if (deja) {
        if (
          deja.adhesionId !== id ||
          deja.acteurId !== u.id ||
          deja.montant !== c.montant ||
          deja.mode !== c.mode ||
          deja.encaisseLe?.getTime() !== new Date(c.encaisseLe).getTime() ||
          (deja.reference ?? '') !== (c.reference ?? '') ||
          (deja.note ?? '') !== (c.note ?? '')
        )
          throw new ConflictException('Clé d’idempotence réutilisée avec un contenu différent')
        return deja
      }
      if (a.aVerifier) throw new ConflictException('Rapprocher le dossier à vérifier avant encaissement')
      if (a.exoneree || c.montant > a.montantDu - a.montantEncaisse)
        throw new BadRequestException('Montant supérieur au solde ou adhésion exonérée')
      const e = await tx.encaissementAdhesion.create({
        data: { ...c, adhesionId: id, acteurId: u.id, encaisseLe: new Date(c.encaisseLe) },
      })
      await tx.adhesionAnnuelle.update({ where: { id }, data: { montantEncaisse: { increment: c.montant } } })
      await this.audit(tx, u, 'ADHESION_ENCAISSEE', id, { encaissementId: e.id, montant: c.montant })
      return e
    })
  }

  async examiner(
    u: UtilisateurSession,
    id: string,
    decision: 'RAPPROCHER_LOCAL' | 'EXONERER' | 'ANNULER_EXONERATION',
    motif: string,
  ) {
    return this.transaction(async (tx) => {
      const a = await this.verrouiller(tx, id)
      await this.autoriser(tx, u, 'CORRIGER', a.brancheType)
      if (a.lignes.some((l) => l.engagee))
        throw new ConflictException('Un lot engage cette adhésion : traiter le reversement avant examen')
      if (decision === 'EXONERER' && a.montantEncaisse > 0)
        throw new ConflictException('Annuler et rapprocher les encaissements avant exonération')
      if (decision === 'RAPPROCHER_LOCAL' && a.montantDu === 0 && !a.exoneree)
        throw new ConflictException('Montant dû inconnu : dossier à vérifier')
      const donnees = decision === 'RAPPROCHER_LOCAL' ? { aVerifier: false } : { exoneree: decision === 'EXONERER' }
      const resultat = await tx.adhesionAnnuelle.update({ where: { id }, data: donnees })
      await this.audit(tx, u, 'ADHESION_EXAMINEE', id, {
        decision,
        motif,
        ancienExoneree: a.exoneree,
        ancienAVerifier: a.aVerifier,
      })
      return resultat
    })
  }

  async annulerEncaissement(u: UtilisateurSession, id: string, encaissementId: string, motif: string) {
    return this.transaction(async (tx) => {
      const a = await this.verrouiller(tx, id)
      await this.autoriser(tx, u, 'CORRIGER', a.brancheType)
      const e = a.encaissements.find((e) => e.id === encaissementId)
      if (!e) throw new NotFoundException('Encaissement introuvable')
      if (e.annulation) throw new ConflictException('Encaissement déjà annulé')
      if (a.lignes.some((l) => l.engagee))
        throw new ConflictException('Annuler le lot préparé ou traiter son anomalie avant correction du paiement')
      const annulation = await tx.annulationEncaissement.create({ data: { encaissementId, acteurId: u.id, motif } })
      await tx.adhesionAnnuelle.update({ where: { id }, data: { montantEncaisse: { decrement: e.montant } } })
      await this.audit(tx, u, 'ENCAISSEMENT_ANNULE', id, { encaissementId, motif, montant: e.montant })
      return annulation
    })
  }

  async creerLot(u: UtilisateurSession, c: z.infer<typeof SchemaLotNational>) {
    return this.transaction(async (tx) => {
      await this.autoriser(tx, u, 'REVERSER')
      const adhesions = []
      // Ordre stable : deux lots chevauchants ne se verrouillent pas dans l'ordre inverse.
      for (const id of [...c.adhesionIds].sort()) {
        const a = await this.verrouiller(tx, id)
        if (a.annee !== c.annee || !syntheseAdhesion(a).eligibleReversement)
          throw new ConflictException('Une adhésion est non éligible ou déjà engagée')
        adhesions.push(a)
      }
      const montantTotal = adhesions.reduce((s, a) => s + a.montantDu, 0)
      if (montantTotal > 2_147_483_647) throw new BadRequestException('Montant du lot trop élevé')
      const lot = await tx.lotReversementNational.create({
        data: {
          annee: c.annee,
          responsableId: u.id,
          montantTotal,
          lignes: { create: adhesions.map((a) => ({ adhesionId: a.id, montant: a.montantDu })) },
        },
      })
      await this.audit(tx, u, 'LOT_NATIONAL_PREPARE', lot.id, { adhesionIds: c.adhesionIds, montantTotal })
      return lot
    })
  }

  async lots(
    u: UtilisateurSession,
    f: { annee: string; page: number; limite: number; recherche?: string; ordre: 'asc' | 'desc' },
  ) {
    await this.autoriser(this.prisma, u, 'LIRE')
    const where: Prisma.LotReversementNationalWhereInput = {
      annee: f.annee,
      ...(f.recherche
        ? {
            OR: [
              { id: { contains: f.recherche, mode: 'insensitive' } },
              { reference: { contains: f.recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
    const [lots, total] = await this.prisma.$transaction([
      this.prisma.lotReversementNational.findMany({
        where,
        orderBy: [{ createdAt: f.ordre }, { id: 'asc' }],
        skip: (f.page - 1) * f.limite,
        take: f.limite,
      }),
      this.prisma.lotReversementNational.count({ where }),
    ])
    return { lots, pagination: { page: f.page, limite: f.limite, total, totalPages: Math.ceil(total / f.limite) } }
  }

  async lot(u: UtilisateurSession, id: string) {
    await this.autoriser(this.prisma, u, 'LIRE')
    const lot = await this.prisma.lotReversementNational.findUnique({
      where: { id },
      include: { lignes: { include: { adhesion: { include: DETAIL_ADHESION } } } },
    })
    if (!lot) throw new NotFoundException('Lot introuvable')
    return lot
  }

  private async verrouillerLot(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM "LotReversementNational" WHERE id = ${id} FOR UPDATE`
    const lot = await tx.lotReversementNational.findUnique({
      where: { id },
      include: { lignes: { include: { confirmations: { include: { correction: true } } } } },
    })
    if (!lot) throw new NotFoundException('Lot introuvable')
    return lot
  }

  async declarer(u: UtilisateurSession, id: string, c: z.infer<typeof SchemaDeclarationNationale>) {
    return this.transaction(async (tx) => {
      await this.autoriser(tx, u, 'REVERSER')
      const lot = await this.verrouillerLot(tx, id)
      if (lot.statut !== 'PREPARE') throw new ConflictException('Seul un lot préparé peut être déclaré reversé')
      const resultat = await tx.lotReversementNational.update({
        where: { id },
        data: {
          statut: 'DECLARE',
          verseLe: new Date(c.verseLe),
          reference: c.reference,
          justification: c.justification,
        },
      })
      await this.audit(tx, u, 'LOT_NATIONAL_DECLARE', id, {
        reference: c.reference,
        verseLe: c.verseLe,
        montant: lot.montantTotal,
        justification: c.justification ?? null,
      })
      return resultat
    })
  }

  async confirmer(u: UtilisateurSession, id: string, c: z.infer<typeof SchemaConfirmationNationale>) {
    return this.transaction(async (tx) => {
      await this.autoriser(tx, u, 'CONFIRMER')
      const lot = await this.verrouillerLot(tx, id)
      if (!['DECLARE', 'PARTIELLEMENT_CONFIRME'].includes(lot.statut) || !lot.verseLe)
        throw new ConflictException('Un reversement effectif doit être déclaré avant confirmation')
      for (const adhesionId of c.adhesionIds) {
        const ligne = lot.lignes.find((l) => l.adhesionId === adhesionId)
        if (!ligne?.engagee) throw new BadRequestException('Adhésion absente du lot')
        if (ligne.confirmations.some((c) => !c.correction)) throw new ConflictException('Confirmation déjà enregistrée')
        const a = await this.verrouiller(tx, adhesionId)
        if (a.aVerifier || a.montantEncaisse !== a.montantDu) throw new ConflictException('Adhésion à vérifier')
        await tx.confirmationNationale.create({
          data: { adhesionId, ligneId: ligne.id, acteurId: u.id, reference: c.reference, commentaire: c.commentaire },
        })
        await this.audit(tx, u, 'ADHESION_NATIONALE_CONFIRMEE', adhesionId, {
          lotId: id,
          montant: ligne.montant,
          reference: c.reference ?? null,
        })
      }
      const total = lot.lignes.filter((l) => l.confirmations.some((c) => !c.correction)).length + c.adhesionIds.length
      return tx.lotReversementNational.update({
        where: { id },
        data: { statut: total === lot.lignes.length ? 'CONFIRME' : 'PARTIELLEMENT_CONFIRME' },
      })
    })
  }

  async anomalieLot(u: UtilisateurSession, id: string, motif: string) {
    return this.transaction(async (tx) => {
      await this.autoriser(tx, u, 'CORRIGER')
      const lot = await this.verrouillerLot(tx, id)
      if (['ANNULE', 'ANOMALIE'].includes(lot.statut)) throw new ConflictException('Lot déjà annulé ou signalé')
      // Seul un lot jamais versé peut libérer les fonds. Un versement déclaré
      // demeure immobilisé jusqu'à rapprochement documenté (pas de remboursement inventé).
      const prepare = lot.statut === 'PREPARE'
      for (const ligne of lot.lignes) {
        await this.verrouiller(tx, ligne.adhesionId)
        for (const confirmation of ligne.confirmations.filter((c) => !c.correction)) {
          await tx.correctionConfirmation.create({ data: { confirmationId: confirmation.id, acteurId: u.id, motif } })
        }
        if (prepare) await tx.ligneReversementNational.update({ where: { id: ligne.id }, data: { engagee: false } })
        else
          await tx.adhesionAnnuelle.update({
            where: { id: ligne.adhesionId },
            data: { aVerifier: true, motifVerification: motif },
          })
      }
      await this.audit(tx, u, prepare ? 'LOT_NATIONAL_ANNULE' : 'LOT_NATIONAL_ANOMALIE', id, { motif })
      return tx.lotReversementNational.update({
        where: { id },
        data: { statut: prepare ? 'ANNULE' : 'ANOMALIE', justification: motif },
      })
    })
  }

  async habilitations(u: UtilisateurSession) {
    if ((u.roleTechnique ?? u.role) !== 'ADMINISTRATEUR')
      throw new ForbiddenException('Administration technique requise')
    return this.prisma.habilitationAdhesion.findMany({
      where: { revoqueeLe: null },
      include: { utilisateur: { select: membre } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async habiliter(u: UtilisateurSession, c: z.infer<typeof SchemaHabilitationAdhesion>) {
    if ((u.roleTechnique ?? u.role) !== 'ADMINISTRATEUR')
      throw new ForbiddenException('Administration technique requise')
    return this.transaction(async (tx) => {
      const cible = await tx.utilisateur.findUnique({ where: { id: c.utilisateurId }, select: { actif: true } })
      if (!cible?.actif) throw new BadRequestException('Compte cible inactif ou absent')
      const droit = await tx.habilitationAdhesion.create({ data: { ...c, auteurId: u.id } })
      await this.audit(tx, u, 'HABILITATION_FINANCIERE_ATTRIBUEE', droit.id, c)
      return droit
    })
  }

  async revoquer(u: UtilisateurSession, id: string, motif: string) {
    if ((u.roleTechnique ?? u.role) !== 'ADMINISTRATEUR')
      throw new ForbiddenException('Administration technique requise')
    return this.transaction(async (tx) => {
      const droit = await tx.habilitationAdhesion.updateMany({
        where: { id, revoqueeLe: null },
        data: { revoqueeLe: new Date() },
      })
      if (droit.count !== 1) throw new ConflictException('Habilitation absente ou déjà révoquée')
      await this.audit(tx, u, 'HABILITATION_FINANCIERE_REVOQUEE', id, { motif })
      return { ok: true }
    })
  }
}
