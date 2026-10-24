import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { SchemaConfiguration } from './configuration.schemas'
import { ConfigurationService } from './configuration.service'

describe('SchemaConfiguration', () => {
  it('refuse une couleur injectable dans la feuille de style', () => {
    expect(SchemaConfiguration.safeParse({ couleurPrimaire: '#fff}</style><script>' }).success).toBe(false)
  })
  it('refuse un réseau social non https ou inconnu', () => {
    expect(SchemaConfiguration.safeParse({ reseauxSociaux: { facebook: 'javascript:alert(1)' } }).success).toBe(false)
    expect(SchemaConfiguration.safeParse({ reseauxSociaux: { myspace: 'https://x.com' } }).success).toBe(false)
    expect(SchemaConfiguration.parse({ reseauxSociaux: { facebook: 'https://facebook.com/g', instagram: '' } }).reseauxSociaux).toEqual({
      facebook: 'https://facebook.com/g',
    })
  })
  it('refuse un logo hors du stockage de la plateforme', () => {
    expect(SchemaConfiguration.safeParse({ logoUrl: 'https://autre-site.example/logo.png' }).success).toBe(false)
    expect(SchemaConfiguration.safeParse({ logoUrl: '/api/fichiers-publics/logo.png' }).success).toBe(true)
  })
  it("ne propose aucun champ d'identifiant : la configuration est unique", () => {
    expect(SchemaConfiguration.parse({ id: 'autre', nomParoisse: 'Paroisse' })).not.toHaveProperty('id')
  })
})

describe('ConfigurationService.identitePublique', () => {
  function service(config: Record<string, unknown>) {
    const prisma = { configurationInstallation: { upsert: vi.fn().mockResolvedValue(config) } }
    return new ConfigurationService(prisma as unknown as PrismaService, { enregistrer: vi.fn() } as unknown as AuditService)
  }
  const base = {
    nomParoisse: 'P',
    nomGroupe: 'G',
    anneeHistorique: 1956,
    rangHistorique: 'Deuxième paroisse',
    rangHistoriqueValide: false,
    sourceHistorique: null,
    couleurPrimaire: '#2f5d3a',
    couleurAccent: 'invalide',
    couleurFond: '#1f3a28',
    couleurHover: '#c27a52',
    reseauxSociaux: null,
  }

  it("masque le rang historique tant qu'il n'est pas confirmé par une source", async () => {
    const identite = await service(base).identitePublique()
    expect(identite.anneeHistorique).toBe(1956)
    expect(identite.rangHistorique).toBeNull()
    const validee = await service({ ...base, rangHistoriqueValide: true, sourceHistorique: 'Archives' }).identitePublique()
    expect(validee.rangHistorique).toBe('Deuxième paroisse')
  })

  it('revalide les couleurs avant de les exposer', async () => {
    const identite = await service(base).identitePublique()
    expect(identite.theme.couleurAccent).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
