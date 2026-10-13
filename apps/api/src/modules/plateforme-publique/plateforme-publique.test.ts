import { describe, expect, it, vi } from 'vitest'
import { PlateformePubliqueController } from './plateforme-publique.controller'
import type { PrismaService } from '../../prisma/prisma.service'

describe('GET public/logo', () => {
  it('renvoie logoUrl null et les valeurs par défaut sans configuration', async () => {
    const prisma = { configurationPlateforme: { findUnique: vi.fn(async () => null) } } as unknown as PrismaService
    await expect(new PlateformePubliqueController(prisma).logo()).resolves.toEqual({
      logoUrl: null,
      nomSite: 'SCOUT ASCCI',
      sousTitreSite: "Côte d'Ivoire",
    })
  })

  it('renvoie la configuration enregistrée', async () => {
    const cfg = { logoUrl: '/api/fichiers-publics/1-a.png', nomSite: 'Mon site', sousTitreSite: 'Abidjan' }
    const prisma = { configurationPlateforme: { findUnique: vi.fn(async () => cfg) } } as unknown as PrismaService
    await expect(new PlateformePubliqueController(prisma).logo()).resolves.toEqual(cfg)
  })
})
