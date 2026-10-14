import 'reflect-metadata'
import { BadRequestException, ForbiddenException, type INestApplication } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { FiltreErreurs } from '../../common/filters/erreurs.filter'
import { AccesFichiersService } from '../../common/acces-fichiers.service'
import { AuditService } from '../../common/audit.service'
import type { RequeteAuthentifiee, UtilisateurSession } from '../../common/types'
import { FichiersController } from './fichiers.controller'
import { FichiersService, nomFichierSur } from './fichiers.service'

vi.mock('../../common/lib/storage', () => ({
  TYPES_MIME_FICHIERS: { '.png': 'image/png', '.pdf': 'application/pdf' },
  lireFichierPrive: vi.fn(async () => Buffer.from('contenu-prive')),
  lireFichierPublicLocal: vi.fn(async () => Buffer.from('contenu-public')),
  sauvegarderFichierPrive: vi.fn(async (p: string, n: string) => `/api/fichiers/${p}/${n}`),
  sauvegarderFichierPublic: vi.fn(async (n: string) => `/api/fichiers-publics/${n}`),
}))

const utilisateur: UtilisateurSession = {
  id: 'u1',
  matricule: null,
  email: 'chef@exemple.ci',
  nom: 'Kouassi',
  prenom: 'Awa',
  role: 'CHEF_GROUPE',
  roleDistrict: null,
  paroisseId: 'paroisse-a',
}

// Règles fines d'accès (scout, branche, parent) : voir acces-fichiers.service.test.ts.
// Ici, seul le cloisonnement par paroisse est simulé.
const accesSimule = {
  autorisationLecture: vi.fn(async (u: UtilisateurSession, paroisseId: string) =>
    u.paroisseId === paroisseId ? { scoutId: null as string | null, sensible: false } : null,
  ),
}
const auditSimule = { enregistrer: vi.fn() }

describe('FichiersService', () => {
  const service = new FichiersService(accesSimule as never, auditSimule as never)

  it("journalise la consultation d'un document sensible", async () => {
    accesSimule.autorisationLecture.mockResolvedValueOnce({ scoutId: 's1', sensible: true })
    await service.lirePrive(utilisateur, 'paroisse-a', 'fiche.pdf')
    expect(auditSimule.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DOCUMENT_CONSULTE', entiteId: 's1', acteurId: 'u1' }),
    )
  })

  it("refuse un fichier privé d'une autre paroisse", async () => {
    await expect(service.lirePrive(utilisateur, 'paroisse-b', 'photo.png')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('refuse un nom de fichier avec traversée de chemin', async () => {
    await expect(service.lirePrive(utilisateur, 'paroisse-a', '../../.env')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.lirePublic('../.env')).rejects.toBeInstanceOf(BadRequestException)
    expect(() => nomFichierSur('sous/dossier.png')).toThrow(BadRequestException)
    expect(nomFichierSur('123-abc.png')).toBe('123-abc.png')
  })

  it('sert un fichier privé de sa propre paroisse avec le type fixé par la liste blanche', async () => {
    const lu = await service.lirePrive(utilisateur, 'paroisse-a', '123-abc.png')
    expect(lu.typeMime).toBe('image/png')
  })

  it('refuse un fichier dont la signature ne correspond à aucun type autorisé', async () => {
    const html = Buffer.from('<svg onload="alert(1)"></svg>')
    await expect(service.televerser(utilisateur, { buffer: html, size: html.length }, 'privee')).rejects.toThrow(
      'Type de fichier non autorisé',
    )
  })

  it("refuse le dépôt public à un rôle qui n'est pas autorisé à publier", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await expect(
      service.televerser(
        { ...utilisateur, role: 'RESPONSABLE_BRANCHE' },
        { buffer: png, size: png.length },
        'publique',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})

describe('FichiersController (HTTP)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FichiersController],
      providers: [
        FichiersService,
        { provide: AccesFichiersService, useValue: accesSimule },
        { provide: AuditService, useValue: auditSimule },
        { provide: APP_FILTER, useClass: FiltreErreurs },
        {
          // Remplace AuthGuard : session simulée de paroisse-a.
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: { switchToHttp: () => { getRequest: () => RequeteAuthentifiee } }) => {
              ctx.switchToHttp().getRequest().utilisateur = utilisateur
              return true
            },
          },
        },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("renvoie 403 { erreur } pour un fichier privé d'une autre paroisse", async () => {
    const res = await request(app.getHttpServer()).get('/api/fichiers/paroisse-b/photo.png')
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ erreur: 'Accès refusé' })
  })

  it('renvoie 400 { erreur } pour une traversée de chemin encodée', async () => {
    const res = await request(app.getHttpServer()).get('/api/fichiers/paroisse-a/..%2F..%2F.env')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erreur: 'Fichier invalide' })

    const pub = await request(app.getHttpServer()).get('/api/fichiers-publics/..%2F.env')
    expect(pub.status).toBe(400)
    expect(pub.body).toEqual({ erreur: 'Fichier invalide' })
  })

  it('sert un fichier privé autorisé avec les en-têtes attendus', async () => {
    const res = await request(app.getHttpServer()).get('/api/fichiers/paroisse-a/123-abc.png')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/png')
    expect(res.headers['cache-control']).toBe('private, max-age=3600')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('renvoie 400 « Aucun fichier reçu » sans fichier téléversé', async () => {
    const res = await request(app.getHttpServer()).post('/api/upload').field('visibilite', 'privee')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erreur: 'Aucun fichier reçu' })
  })

  it('renvoie 400 « Fichier trop volumineux » au-delà de 5 Mo', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/upload')
      .attach('fichier', Buffer.alloc(5 * 1024 * 1024 + 1), 'gros.png')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erreur: 'Fichier trop volumineux (max 5 Mo)' })
  })

  it('accepte un PNG privé et renvoie son URL', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
    const res = await request(app.getHttpServer()).post('/api/upload').attach('fichier', png, 'photo.png')
    expect(res.status).toBe(200)
    expect(res.body.url).toMatch(/^\/api\/fichiers\/paroisse-a\/[0-9a-f]{16}-[0-9a-f]{32}\.png$/)
  })
})
