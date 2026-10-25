import 'reflect-metadata'
import { randomUUID } from 'crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { Controller, Get, type INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { UtilisateurCourant } from '../src/common/decorators/utilisateur-courant.decorator'
import { appliquerReprise, planifierReprise } from '../src/modules/adhesions-nationales/reprise-cotisations'
import request from 'supertest'
import { PERMISSIONS_ADHESION } from '@scout/shared'
import { chargerEnv } from '../src/config/env'
import { PrismaService } from '../src/prisma/prisma.service'
import { PrismaModule } from '../src/prisma/prisma.module'
import { AuthGuard } from '../src/common/guards/auth.guard'
import { RolesGuard } from '../src/common/guards/roles.guard'
import { FiltreErreurs } from '../src/common/filters/erreurs.filter'
import type { UtilisateurSession } from '../src/common/types'
import { AdhesionsNationalesModule } from '../src/modules/adhesions-nationales/adhesions-nationales.module'
import { AdhesionsNationalesService } from '../src/modules/adhesions-nationales/adhesions-nationales.service'
import { ResponsabilitesController } from '../src/modules/utilisateurs/responsabilites.controller'

@Controller('recette-session')
class SessionRecette {
  @Get() session(@UtilisateurCourant() u: UtilisateurSession) {
    return u
  }
}

const raw = process.env.SCOUT_TEST_DATABASE_URL
if (!raw) throw new Error('SCOUT_TEST_DATABASE_URL explicite requis')
const url = new URL(raw)
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
  !/^scout_test_integration_adhesions[a-z0-9_]*$/.test(url.pathname.slice(1)) ||
  url.search ||
  url.hash ||
  !url.username
)
  throw new Error('Base jetable dédiée aux adhésions sur loopback requise')
for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) delete process.env[key]
const secret = 'signature-synthetique-adhesions-'.repeat(3)
chargerEnv({ NODE_ENV: 'test', DATABASE_URL: raw, JWT_ACCESS_SECRET: secret, INSTALLATION_ID: 'recette-adhesions' })
let app: INestApplication, prisma: PrismaService, service: AdhesionsNationalesService
let admin: UtilisateurSession, limite: UtilisateurSession, inconnu: UtilisateurSession, token: string
let baremeScout: string, baremeChef: string
const annee = '2026-2027'
const date = '2026-09-10T10:00:00.000Z'
let numero = 0
async function compte(role: 'ADMINISTRATEUR' | 'ASSISTANT_GROUPE' = 'ASSISTANT_GROUPE') {
  const u = await prisma.utilisateur.create({
    data: {
      role,
      nom: `Compte${++numero}`,
      prenom: 'Synthétique',
      matricule: `TEST-${randomUUID()}`,
      password: 'hash-synthetique-inutilisable',
    },
  })
  return {
    id: u.id,
    role,
    nom: u.nom,
    prenom: u.prenom,
    matricule: u.matricule,
    email: '',
    editeurContenu: false,
  } satisfies UtilisateurSession
}
async function creerScout() {
  const s = await prisma.scout.create({
    data: {
      nom: `Scout${++numero}`,
      prenom: 'Synthétique',
      dateNaissance: new Date('2014-01-01'),
      sexe: 'FEMININ',
      brancheType: 'LOUVETEAUX',
    },
  })
  return service.creer(admin, { annee, baremeId: baremeScout, scoutId: s.id })
}
const encaissement = (montant: number, idempotence = randomUUID()) => ({
  montant,
  idempotence,
  mode: 'Espèces',
  encaisseLe: date,
})

beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [PrismaModule, JwtModule.register({ global: true }), AdhesionsNationalesModule],
    controllers: [ResponsabilitesController, SessionRecette],
    providers: [
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_FILTER, useClass: FiltreErreurs },
    ],
  }).compile()
  app = module.createNestApplication()
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  await app.init()
  prisma = app.get(PrismaService)
  service = app.get(AdhesionsNationalesService)
  if ((await prisma.utilisateur.count()) || (await prisma.scout.count()))
    throw new Error('La base dédiée doit être vierge avant cette suite append-only')
  admin = await compte('ADMINISTRATEUR')
  limite = await compte()
  inconnu = await compte()
  await expect(service.baremes(admin, annee)).rejects.toThrow('Habilitation financière requise')
  for (const permission of PERMISSIONS_ADHESION)
    await service.habiliter(admin, {
      utilisateurId: admin.id,
      permission,
      brancheType: null,
      motif: 'Habilitation synthétique de recette',
    })
  for (const permission of ['LIRE', 'ENCAISSER'] as const)
    await service.habiliter(admin, {
      utilisateurId: limite.id,
      permission,
      brancheType: 'ECLAIREURS',
      motif: 'Périmètre synthétique de recette',
    })
  baremeScout = (
    await service.creerBareme(admin, {
      annee,
      categorie: 'SCOUT',
      brancheType: null,
      montant: 5000,
      libelle: 'Scouts',
      debutValidite: date,
      finValidite: null,
    })
  ).id
  baremeChef = (
    await service.creerBareme(admin, {
      annee,
      categorie: 'CHEF',
      brancheType: null,
      montant: 7000,
      libelle: 'Chefs',
      debutValidite: date,
      finValidite: null,
    })
  ).id
  const session = await prisma.sessionUtilisateur.create({
    data: { utilisateurId: admin.id, empreinteJeton: randomUUID(), expireLe: new Date(Date.now() + 3600000) },
  })
  token = await app
    .get(JwtService)
    .signAsync(
      { role: 'ADMINISTRATEUR', sid: session.id },
      { subject: admin.id, issuer: 'recette-adhesions', secret, algorithm: 'HS256' },
    )
})
afterAll(async () => {
  await app?.close()
})

describe('PostgreSQL / HTTP réel : adhésions 2026–2027', () => {
  it('crée scout et chef avec tarifs distincts, une seule adhésion malgré plusieurs mandats', async () => {
    const scout = await creerScout()
    expect(scout.montantDu).toBe(5000)
    const chef = await compte('ADMINISTRATEUR')
    await prisma.mandat.createMany({
      data: [
        { utilisateurId: chef.id, role: 'ASSISTANT_GROUPE' },
        { utilisateurId: chef.id, role: 'RESPONSABLE_BRANCHE', brancheType: 'COMPAGNONS' },
      ],
    })
    const adhesion = await service.creer(admin, { annee, baremeId: baremeChef, utilisateurId: chef.id })
    expect(adhesion.montantDu).toBe(7000)
    const fiche = await prisma.scout.create({
      data: {
        nom: chef.nom,
        prenom: chef.prenom,
        matricule: chef.matricule,
        utilisateurId: chef.id,
        dateNaissance: new Date('1990-01-01'),
        sexe: 'MASCULIN',
        brancheType: 'COMPAGNONS',
      },
    })
    await expect(service.creer(admin, { annee, baremeId: baremeScout, scoutId: fiche.id })).rejects.toThrow(
      'Opération concurrente ou déjà enregistrée',
    )
    expect(await prisma.adhesionAnnuelle.count({ where: { personneId: adhesion.personneId, annee } })).toBe(1)
  })
  it('fige le montant historique après désactivation et remplacement du barème', async () => {
    const a = await creerScout()
    await service.desactiverBareme(admin, baremeScout)
    baremeScout = (
      await service.creerBareme(admin, {
        annee,
        categorie: 'SCOUT',
        brancheType: null,
        montant: 5000,
        libelle: 'Tarif de remplacement',
        debutValidite: date,
        finValidite: null,
      })
    ).id
    expect((await service.detail(admin, a.id)).montantDu).toBe(5000)
  })
  it('conserve trois paiements successifs sans confirmation automatique', async () => {
    const a = await creerScout()
    for (const montant of [2000, 1500, 1500]) await service.encaisser(admin, a.id, encaissement(montant))
    const d = await service.detail(admin, a.id)
    expect(d.encaissements).toHaveLength(3)
    expect(d.montantEncaisse).toBe(5000)
    expect(d.solde).toBe(0)
    expect(d.statutNational).toBe('NON_CONFIRME')
    await expect(service.encaisser(admin, a.id, encaissement(1))).rejects.toThrow('supérieur au solde')
  })
  it('sérialise deux encaissements concurrentiels sans dépasser le solde', async () => {
    const a = await creerScout()
    const resultats = await Promise.allSettled([
      service.encaisser(admin, a.id, encaissement(3000)),
      service.encaisser(admin, a.id, encaissement(3000)),
    ])
    expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await service.detail(admin, a.id)).montantEncaisse).toBe(3000)
  })
  it('rend une double soumission idempotente et refuse un contenu modifié', async () => {
    const a = await creerScout(),
      corps = encaissement(2000)
    const [e1, e2] = await Promise.all([service.encaisser(admin, a.id, corps), service.encaisser(admin, a.id, corps)])
    expect(e1.id).toBe(e2.id)
    expect((await service.detail(admin, a.id)).montantEncaisse).toBe(2000)
    await expect(service.encaisser(admin, a.id, { ...corps, montant: 1000 })).rejects.toThrow('idempotence')
  })
  it('annule par compensation traçable, empêche une seconde annulation et la mutation SQL', async () => {
    const a = await creerScout(),
      e = await service.encaisser(admin, a.id, encaissement(2000))
    await service.annulerEncaissement(admin, a.id, e.id, 'Erreur synthétique de saisie')
    const d = await service.detail(admin, a.id)
    expect(d.montantEncaisse).toBe(0)
    expect(d.encaissements).toHaveLength(1)
    expect(d.encaissements[0].annulation).not.toBeNull()
    await expect(service.annulerEncaissement(admin, a.id, e.id, 'Double annulation')).rejects.toThrow('déjà annulé')
    await expect(prisma.encaissementAdhesion.update({ where: { id: e.id }, data: { montant: 1000 } })).rejects.toThrow(
      'immuable',
    )
  })
  it('annule le paiement entier si la journalisation transactionnelle échoue', async () => {
    const a = await creerScout()
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION test_refuser_audit_adhesion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Echec synthetique audit'; END; $$`,
    )
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER test_audit_adhesion BEFORE INSERT ON "JournalAudit" FOR EACH ROW WHEN (NEW.action = 'ADHESION_ENCAISSEE') EXECUTE FUNCTION test_refuser_audit_adhesion()`,
      )
      await expect(service.encaisser(admin, a.id, encaissement(1000))).rejects.toThrow('audit')
      expect((await service.detail(admin, a.id)).montantEncaisse).toBe(0)
      expect(await prisma.encaissementAdhesion.count({ where: { adhesionId: a.id } })).toBe(0)
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_audit_adhesion ON "JournalAudit"')
      await prisma.$executeRawUnsafe('DROP FUNCTION test_refuser_audit_adhesion()')
    }
  })
  it('applique les CHECK SQL et protège le journal financier', async () => {
    const a = await creerScout()
    await expect(
      prisma.adhesionAnnuelle.update({ where: { id: a.id }, data: { montantEncaisse: 6000 } }),
    ).rejects.toThrow()
    const journal = await prisma.journalAudit.findFirstOrThrow({ where: { entiteId: a.id } })
    await expect(prisma.journalAudit.delete({ where: { id: journal.id } })).rejects.toThrow('immuable')
  })
  it('refuse les accès directs hors branche et les mutations sans habilitation', async () => {
    const a = await creerScout()
    await expect(service.detail(limite, a.id)).rejects.toThrow('périmètre')
    await expect(service.encaisser(limite, a.id, encaissement(100))).rejects.toThrow('périmètre')
    await expect(service.detail(inconnu, a.id)).rejects.toThrow('Habilitation')
    expect(
      (await service.lister(limite, { annee, page: 1, limite: 25, tri: 'createdAt', ordre: 'asc' })).pagination.total,
    ).toBe(0)
  })
  it('interdit deux lots incompatibles, exige déclaration puis confirmation manuelle', async () => {
    const a = await creerScout()
    await service.encaisser(admin, a.id, encaissement(5000))
    const lots = await Promise.allSettled([
      service.creerLot(admin, { annee, adhesionIds: [a.id] }),
      service.creerLot(admin, { annee, adhesionIds: [a.id] }),
    ])
    expect(lots.filter((l) => l.status === 'fulfilled')).toHaveLength(1)
    const lot = lots.find((l) => l.status === 'fulfilled')!
    if (lot.status !== 'fulfilled') throw new Error('Lot absent')
    const c = { adhesionIds: [a.id], reference: 'NATION-SYNTHETIQUE' }
    await expect(service.confirmer(admin, lot.value.id, c)).rejects.toThrow('effectif')
    expect((await service.detail(admin, a.id)).statutNational).toBe('NON_CONFIRME')
    await service.declarer(admin, lot.value.id, { verseLe: date, reference: 'VERSEMENT-SYNTHETIQUE' })
    expect((await service.detail(admin, a.id)).statutNational).toBe('CONFIRMATION_NATIONALE_EN_ATTENTE')
    const confirmations = await Promise.allSettled([
      service.confirmer(admin, lot.value.id, c),
      service.confirmer(admin, lot.value.id, c),
    ])
    expect(confirmations.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await service.detail(admin, a.id)).statutNational).toBe('COTISANT_CONFIRME')
    await expect(service.confirmer(admin, lot.value.id, c)).rejects.toThrow()
    await service.anomalieLot(admin, lot.value.id, 'Rejet national synthétique à rapprocher')
    expect((await service.detail(admin, a.id)).statutNational).toBe('A_VERIFIER')
    expect(await prisma.confirmationNationale.count({ where: { adhesionId: a.id } })).toBe(1)
    expect(await prisma.journalAudit.count({ where: { entiteId: a.id, action: 'ADHESION_NATIONALE_CONFIRMEE' } })).toBe(
      1,
    )
  })
  it('libère un lot préparé annulé mais conserve ses lignes', async () => {
    const a = await creerScout()
    await service.encaisser(admin, a.id, encaissement(5000))
    const lot = await service.creerLot(admin, { annee, adhesionIds: [a.id] })
    await service.anomalieLot(admin, lot.id, 'Annulation du lot de recette')
    await expect(service.creerLot(admin, { annee, adhesionIds: [a.id] })).resolves.toBeDefined()
    expect(await prisma.ligneReversementNational.count({ where: { lotId: lot.id } })).toBe(1)
  })
  it('reprend les montants historiques sans toucher les sources ni inventer une confirmation', async () => {
    const s = await prisma.scout.create({
      data: {
        nom: 'Historique synthétique',
        prenom: 'Recette',
        dateNaissance: new Date('2010-01-01'),
        sexe: 'MASCULIN',
        brancheType: 'LOUVETEAUX',
      },
    })
    const c = await prisma.cotisation.create({
      data: { scoutId: s.id, anneeScolaire: '2025-2026', montant: 5000, montantPaye: 5000, statut: 'PAYEE' },
    })
    const plan = await planifierReprise(prisma)
    const r = await appliquerReprise(prisma, admin.id, plan.rapport.empreinte)
    expect(r.importees).toBe(1)
    expect(r.montantPayeRepris).toBe(5000)
    expect(await prisma.cotisation.findUnique({ where: { id: c.id } })).toEqual(c)
    const reprise = await prisma.repriseCotisation.findUniqueOrThrow({ where: { cotisationId: c.id } })
    const d = await service.detail(admin, reprise.adhesionId)
    expect(d.montantEncaisse).toBe(5000)
    expect(d.statutNational).toBe('A_VERIFIER')
    expect(d.encaissements[0].encaisseLe).toBeNull()
    await expect(prisma.cotisation.delete({ where: { id: c.id } })).rejects.toThrow()
    const second = await appliquerReprise(prisma, admin.id, plan.rapport.empreinte)
    expect(second.importees).toBe(0)
    expect(second.dejaReprises).toBe(1)
    await service.examiner(admin, d.id, 'RAPPROCHER_LOCAL', 'Montants locaux vérifiés sur justificatifs synthétiques')
    expect((await service.detail(admin, d.id)).statutNational).toBe('NON_CONFIRME')
  })
  it('n’importe pas les doublons annuels ambigus', async () => {
    const s = await prisma.scout.create({
      data: {
        nom: 'Doublon historique',
        prenom: 'Recette',
        dateNaissance: new Date('2010-01-01'),
        sexe: 'MASCULIN',
        brancheType: 'LOUVETEAUX',
      },
    })
    await prisma.cotisation.createMany({
      data: [1, 2].map(() => ({
        scoutId: s.id,
        anneeScolaire: annee,
        montant: 5000,
        montantPaye: 5000,
        statut: 'PAYEE' as const,
      })),
    })
    const plan = await planifierReprise(prisma)
    expect(plan.rapport.lignesAmbigues).toBe(2)
    const r = await appliquerReprise(prisma, admin.id, plan.rapport.empreinte)
    expect(r.importees).toBe(0)
    expect(await prisma.cotisation.count({ where: { scoutId: s.id } })).toBe(2)
  })
  it('effectue les contrôles HTTP de session, validation et permissions', async () => {
    await request(app.getHttpServer()).get(`/api/adhesions-nationales?annee=${annee}`).expect(401)
    await request(app.getHttpServer())
      .get('/api/adhesions-nationales?annee=2026-2029')
      .auth(token, { type: 'bearer' })
      .expect(400)
    const a = await creerScout()
    await request(app.getHttpServer())
      .post(`/api/adhesions-nationales/${a.id}/encaissements`)
      .auth(token, { type: 'bearer' })
      .send({ ...encaissement(100), montant: -100 })
      .expect(400)
    await request(app.getHttpServer())
      .get(`/api/adhesions-nationales/${a.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)
    await request(app.getHttpServer())
      .post(`/api/utilisateurs/${admin.id}/mandats`)
      .auth(token, { type: 'bearer' })
      .send({ role: 'ASSISTANT_GROUPE', motif: 'Cumul synthétique de recette' })
      .expect(201)
    const mandat = await prisma.mandat.findFirstOrThrow({ where: { utilisateurId: admin.id, finLe: null } })
    const contexte = await request(app.getHttpServer())
      .get('/api/recette-session')
      .auth(token, { type: 'bearer' })
      .set('Cookie', `scout_espace=${mandat.id}`)
      .expect(200)
    expect(contexte.body.role).toBe('ASSISTANT_GROUPE')
    expect(contexte.body.roleTechnique).toBe('ADMINISTRATEUR')
    // Sur ce contexte de maîtrise, le rôle effectif ne donne pas l'administration.
    await request(app.getHttpServer())
      .get('/api/adhesions-nationales/habilitations')
      .auth(token, { type: 'bearer' })
      .set('Cookie', `scout_espace=${mandat.id}`)
      .expect(200)
    await request(app.getHttpServer())
      .patch(`/api/mandats/${mandat.id}`)
      .auth(token, { type: 'bearer' })
      .send({ motif: 'Fin synthétique de recette' })
      .expect(200)
  })
})
