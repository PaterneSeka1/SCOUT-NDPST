import { BadRequestException } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import { ParoisseService } from './paroisse.service'

const chefGroupe: UtilisateurSession = {
  id: 'u1',
  matricule: null,
  email: '',
  nom: 'N',
  prenom: 'P',
  role: 'CHEF_GROUPE',
  roleDistrict: null,
  paroisseId: 'p1',
}

function construire() {
  const prisma = {
    paroisse: { update: vi.fn().mockResolvedValue({ id: 'p1' }) },
  }
  return {
    service: new ParoisseService(prisma as unknown as PrismaService),
    prisma,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('ParoisseService.modifier — validation', () => {
  it.each(['https://exemple.com/logo.png', 'javascript:alert(1)', '//exemple.com/logo.png'])(
    'refuse un logo hors stockage autorisé : %s',
    async (logo) => {
      const { service, prisma } = construire()
      await expect(service.modifier(chefGroupe, { logo })).rejects.toBeInstanceOf(BadRequestException)
      expect(prisma.paroisse.update).not.toHaveBeenCalled()
    },
  )

  it('accepte un chemin local de fichier public', async () => {
    const { service, prisma } = construire()
    await service.modifier(chefGroupe, {
      logo: ' /api/fichiers-publics/logo.png ',
    })
    expect(prisma.paroisse.update.mock.calls[0][0].data).toEqual({
      logo: '/api/fichiers-publics/logo.png',
    })
  })

  it('accepte une URL du stockage S3 configuré côté serveur', async () => {
    vi.stubEnv('STORAGE_S3_BUCKET', 'bucket')
    vi.stubEnv('STORAGE_PUBLIC_URL_BASE', 'https://cdn.exemple.com/')
    const { service, prisma } = construire()
    await service.modifier(chefGroupe, {
      logo: 'https://cdn.exemple.com/public/logo.png',
    })
    expect(prisma.paroisse.update).toHaveBeenCalledOnce()
  })

  it('ignore les champs non modifiables (couleurs, district) et refuse un type non textuel', async () => {
    const { service, prisma } = construire()
    await service.modifier(chefGroupe, {
      nom: ' Saint-Paul ',
      couleurPrimaire: '#000000',
      districtId: 'd2',
    })
    expect(prisma.paroisse.update.mock.calls[0][0]).toEqual({
      where: { id: 'p1' },
      data: { nom: 'Saint-Paul' },
    })

    await expect(service.modifier(chefGroupe, { email: 42 })).rejects.toThrow(
      'email doit être une chaîne de caractères',
    )
  })
})
