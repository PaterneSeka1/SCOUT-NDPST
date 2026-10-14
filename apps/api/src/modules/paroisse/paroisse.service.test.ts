import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import { SchemaModificationParoisse } from './paroisse.schemas'
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

function premierMessage(valeur: unknown): string | undefined {
  const resultat = SchemaModificationParoisse.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('SchemaModificationParoisse — validation', () => {
  it.each(['https://exemple.com/logo.png', 'javascript:alert(1)', '//exemple.com/logo.png'])(
    'refuse un logo hors stockage autorisé : %s',
    (logo) => {
      expect(premierMessage({ logo })).toBe(
        'logo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
      )
    },
  )

  it('accepte une URL du stockage S3 configuré côté serveur', () => {
    vi.stubEnv('STORAGE_S3_BUCKET', 'bucket')
    vi.stubEnv('STORAGE_PUBLIC_URL_BASE', 'https://cdn.exemple.com/')
    expect(premierMessage({ logo: 'https://cdn.exemple.com/public/logo.png' })).toBeUndefined()
  })

  it('accepte un logo vide ou null (effacement)', () => {
    expect(premierMessage({ logo: '' })).toBeUndefined()
    expect(premierMessage({ logo: null })).toBeUndefined()
  })

  it('refuse un type non textuel et un corps qui n’est pas un objet', () => {
    expect(premierMessage({ email: 42 })).toBe('email doit être une chaîne de caractères')
    expect(premierMessage([])).toBe('Données invalides')
  })
})

describe('ParoisseService.modifier', () => {
  it('accepte un chemin local de fichier public (nettoyé)', async () => {
    const { service, prisma } = construire()
    await service.modifier(chefGroupe, SchemaModificationParoisse.parse({ logo: ' /api/fichiers-publics/logo.png ' }))
    expect(prisma.paroisse.update.mock.calls[0][0].data).toEqual({
      logo: '/api/fichiers-publics/logo.png',
    })
  })

  it('ignore les champs non modifiables (couleurs, district)', async () => {
    const { service, prisma } = construire()
    await service.modifier(
      chefGroupe,
      SchemaModificationParoisse.parse({
        nom: ' Saint-Paul ',
        couleurPrimaire: '#000000',
        districtId: 'd2',
      }),
    )
    expect(prisma.paroisse.update.mock.calls[0][0]).toEqual({
      where: { id: 'p1' },
      data: { nom: 'Saint-Paul' },
    })
  })

  it('ignore un nom null mais efface un champ facultatif null ou vide', async () => {
    const { service, prisma } = construire()
    await service.modifier(chefGroupe, SchemaModificationParoisse.parse({ nom: null, adresse: null, email: '  ' }))
    expect(prisma.paroisse.update.mock.calls[0][0].data).toEqual({ adresse: null, email: null })
  })
})
