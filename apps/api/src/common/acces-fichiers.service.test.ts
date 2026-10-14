import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const supprimerFichierPrive = vi.fn()
vi.mock('./lib/storage', () => ({ supprimerFichierPrive: (...args: unknown[]) => supprimerFichierPrive(...args) }))

import type { PrismaService } from '../prisma/prisma.service'
import {
  AccesFichiersService,
  analyserUrlFichierPrive,
  estTeleversePar,
  nomFichierPriveGenere,
} from './acces-fichiers.service'
import { PerimetreService } from './perimetre.service'
import type { UtilisateurSession } from './types'

// Fichiers privés = photos, fiches médicales et autorisations de mineurs :
// appartenir à la paroisse ne suffit pas pour les lire.

function utilisateur(role: string, id = 'u1'): UtilisateurSession {
  return { id, matricule: null, email: '', nom: 'Kouassi', prenom: 'Awa', role, roleDistrict: null, paroisseId: 'p1' }
}

interface ScoutSimule {
  id: string
  brancheType: string
  utilisateurId: string | null
  documents: { id: string }[]
  autorisationsCamp: { id: string }[]
}

function construire(scouts: ScoutSimule[], options: { brancheStaff?: string; lienParent?: boolean } = {}) {
  const prisma = {
    scout: { findMany: vi.fn().mockResolvedValue(scouts), count: vi.fn().mockResolvedValue(0) },
    utilisateur: { findUnique: vi.fn().mockResolvedValue({ brancheType: options.brancheStaff ?? null }) },
    lienParentScout: { count: vi.fn().mockResolvedValue(options.lienParent ? 1 : 0) },
  }
  const p = prisma as unknown as PrismaService
  return { prisma, service: new AccesFichiersService(p, new PerimetreService(p)) }
}

const photoLouveteau: ScoutSimule = {
  id: 's1',
  brancheType: 'LOUVETEAUX',
  utilisateurId: null,
  documents: [],
  autorisationsCamp: [],
}
const ficheMedicale: ScoutSimule = { ...photoLouveteau, documents: [{ id: 'd1' }] }

describe('AccesFichiersService.autorisationLecture', () => {
  it("refuse un fichier d'une autre paroisse sans interroger la base", async () => {
    const { prisma, service } = construire([photoLouveteau])
    expect(await service.autorisationLecture(utilisateur('CHEF_GROUPE'), 'p2', 'x.png')).toBeNull()
    expect(prisma.scout.findMany).not.toHaveBeenCalled()
  })

  it('autorise le staff de groupe sur toute la paroisse', async () => {
    const { service } = construire([ficheMedicale])
    expect(await service.autorisationLecture(utilisateur('ADJOINT_GROUPE'), 'p1', 'f.pdf')).toEqual({
      scoutId: 's1',
      sensible: true,
    })
  })

  it("refuse un responsable d'une autre branche", async () => {
    const { service } = construire([ficheMedicale], { brancheStaff: 'ECLAIREURS' })
    expect(await service.autorisationLecture(utilisateur('RESPONSABLE_BRANCHE'), 'p1', 'f.pdf')).toBeNull()
  })

  it('autorise un responsable de la branche du scout', async () => {
    const { service } = construire([ficheMedicale], { brancheStaff: 'LOUVETEAUX' })
    expect(await service.autorisationLecture(utilisateur('ASSISTANT_BRANCHE'), 'p1', 'f.pdf')).not.toBeNull()
  })

  it("refuse un parent qui n'est pas lié au scout", async () => {
    const { service } = construire([ficheMedicale])
    expect(await service.autorisationLecture(utilisateur('PARENT'), 'p1', 'f.pdf')).toBeNull()
  })

  it('autorise un parent lié au scout', async () => {
    const { service } = construire([ficheMedicale], { lienParent: true })
    expect(await service.autorisationLecture(utilisateur('PARENT'), 'p1', 'f.pdf')).not.toBeNull()
  })

  it("refuse un scout pour la fiche d'un autre, l'autorise pour la sienne", async () => {
    const autre = construire([ficheMedicale])
    expect(await autre.service.autorisationLecture(utilisateur('SCOUT'), 'p1', 'f.pdf')).toBeNull()
    const sienne = construire([{ ...photoLouveteau, utilisateurId: 'u1' }])
    expect(await sienne.service.autorisationLecture(utilisateur('SCOUT'), 'p1', 'p.png')).toEqual({
      scoutId: 's1',
      sensible: false,
    })
  })

  it("ne laisse lire un fichier non rattaché qu'à celui qui l'a téléversé", async () => {
    const nom = nomFichierPriveGenere('u1', 'png')
    const { service } = construire([])
    expect(await service.autorisationLecture(utilisateur('PARENT', 'u1'), 'p1', nom)).toEqual({
      scoutId: null,
      sensible: false,
    })
    expect(await service.autorisationLecture(utilisateur('CHEF_GROUPE', 'u2'), 'p1', nom)).toBeNull()
  })
})

describe('AccesFichiersService.verifierRattachable', () => {
  let ctx: ReturnType<typeof construire>
  beforeEach(() => {
    ctx = construire([])
  })

  it('accepte un fichier téléversé par le même utilisateur dans sa paroisse', async () => {
    const url = `/api/fichiers/p1/${nomFichierPriveGenere('u1', 'pdf')}`
    await expect(ctx.service.verifierRattachable(utilisateur('PARENT'), url, 's1')).resolves.toBeUndefined()
  })

  it("refuse le fichier d'un autre utilisateur non rattaché à ce scout", async () => {
    const url = `/api/fichiers/p1/${nomFichierPriveGenere('u2', 'pdf')}`
    await expect(ctx.service.verifierRattachable(utilisateur('PARENT'), url, 's1')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('accepte un fichier déjà rattaché au même scout (valeur inchangée)', async () => {
    ctx.prisma.scout.count.mockResolvedValue(1)
    const url = `/api/fichiers/p1/${nomFichierPriveGenere('u2', 'png')}`
    await expect(ctx.service.verifierRattachable(utilisateur('CHEF_GROUPE'), url, 's1')).resolves.toBeUndefined()
  })

  it("refuse un fichier d'une autre paroisse ou une URL hors /api/fichiers", async () => {
    const autreParoisse = `/api/fichiers/p2/${nomFichierPriveGenere('u1', 'pdf')}`
    await expect(ctx.service.verifierRattachable(utilisateur('PARENT'), autreParoisse)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(ctx.service.verifierRattachable(utilisateur('PARENT'), '/logo.png')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})

describe('Noms de fichiers privés', () => {
  it('sont imprévisibles et portent le préfixe de leur auteur', () => {
    const a = nomFichierPriveGenere('u1', 'png')
    const b = nomFichierPriveGenere('u1', 'png')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{16}-[0-9a-f]{32}\.png$/)
    expect(estTeleversePar(a, 'u1')).toBe(true)
    expect(estTeleversePar(a, 'u2')).toBe(false)
  })

  it('analyse une URL de fichier privé et rejette tout le reste', () => {
    expect(analyserUrlFichierPrive('/api/fichiers/p1/a.png')).toEqual({ paroisseId: 'p1', nomFichier: 'a.png' })
    expect(analyserUrlFichierPrive('/api/fichiers/p1/../a.png')).toBeNull()
    expect(analyserUrlFichierPrive('/api/fichiers-publics/a.png')).toBeNull()
  })
})

describe('AccesFichiersService.supprimerSiOrphelin', () => {
  beforeEach(() => {
    supprimerFichierPrive.mockReset()
  })

  it("supprime du stockage un fichier qui n'est plus rattaché à rien", async () => {
    const { service } = construire([])
    await service.supprimerSiOrphelin('/api/fichiers/p1/f.pdf')
    expect(supprimerFichierPrive).toHaveBeenCalledWith('p1', 'f.pdf')
  })

  it('conserve un fichier encore rattaché à un scout', async () => {
    const { prisma, service } = construire([])
    prisma.scout.count.mockResolvedValue(1)
    await service.supprimerSiOrphelin('/api/fichiers/p1/f.pdf')
    expect(supprimerFichierPrive).not.toHaveBeenCalled()
  })

  it('ignore une URL absente ou hors /api/fichiers', async () => {
    const { service } = construire([])
    await service.supprimerSiOrphelin(null)
    await service.supprimerSiOrphelin('/api/fichiers-publics/logo.png')
    expect(supprimerFichierPrive).not.toHaveBeenCalled()
  })

  it("ne fait pas échouer l'opération si le stockage refuse la suppression", async () => {
    supprimerFichierPrive.mockImplementation(async () => {
      throw new Error('R2 indisponible')
    })
    const { service } = construire([])
    await expect(service.supprimerSiOrphelin('/api/fichiers/p1/f.pdf')).resolves.toBeUndefined()
  })
})
