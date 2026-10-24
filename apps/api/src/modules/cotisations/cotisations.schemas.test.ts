import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import {
  SchemaCreationBareme,
  SchemaCreationCotisation,
  SchemaModificationBareme,
  SchemaModificationCotisation,
  SchemaStatutCotisant,
} from './cotisations.schemas'

// Premier message d'erreur, tel que renvoyé par ZodPipe au client.
function premierMessage(schema: ZodType, valeur: unknown): string | undefined {
  const resultat = schema.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

describe('SchemaCreationCotisation', () => {
  it('scoutIds (non vide) prime sur scoutId', () => {
    expect(
      SchemaCreationCotisation.parse({ scoutId: 's0', scoutIds: ['s1', 's2'], type: 'CAMP', montant: 5000 }),
    ).toEqual({ cibles: ['s1', 's2'], type: 'CAMP', montant: 5000 })
  })

  it('retombe sur scoutId quand scoutIds est vide', () => {
    expect(
      SchemaCreationCotisation.parse({ scoutId: 's0', scoutIds: [], type: 'AUTRE', montant: 0, libelle: null }),
    ).toEqual({ cibles: ['s0'], type: 'AUTRE', montant: 0, libelle: null })
  })

  it.each([
    [{ type: 'CAMP', montant: 1 }, 'scoutId ou scoutIds est requis'],
    [{ scoutIds: ['s1', ''], type: 'CAMP', montant: 1 }, 'scoutId ou scoutIds est requis'],
    [{ scoutId: 's1', type: 'COTIS', montant: 1 }, 'Type de cotisation invalide'],
    [{ scoutId: 's1', type: 'CAMP', montant: -1 }, 'Le montant doit être un entier positif'],
    [{ scoutId: 's1', type: 'CAMP', montant: 1.5 }, 'Le montant doit être un entier positif'],
    [{ scoutId: 's1', type: 'CAMP', montant: '100' }, 'Le montant doit être un entier positif'],
    [{ scoutId: 's1', type: 'CAMP', montant: 1, libelle: 3 }, 'libelle doit être une chaîne de caractères'],
    [{ scoutId: 's1', type: 'CAMP', montant: 1, anneeScolaire: [] }, 'anneeScolaire doit être une chaîne de caractères'],
    // Un corps qui n'est pas un objet est traité comme un objet vide.
    [[], 'Type de cotisation invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaCreationCotisation, corps)).toBe(message)
  })
})

describe('SchemaModificationCotisation', () => {
  it('accepte un corps vide (aucune modification)', () => {
    expect(SchemaModificationCotisation.parse({})).toEqual({})
    expect(SchemaModificationCotisation.parse(null)).toEqual({})
  })

  it('conserve un montant payé numérique et ignore une autre valeur', () => {
    expect(SchemaModificationCotisation.parse({ statut: 'PARTIELLEMENT_PAYEE', montantPaye: 2000 })).toEqual({
      statut: 'PARTIELLEMENT_PAYEE',
      montantPaye: 2000,
    })
    expect(SchemaModificationCotisation.parse({ statut: 'PAYEE', montantPaye: 'beaucoup' }).montantPaye).toBeUndefined()
  })

  it.each([
    [{ statut: 'REGLEE' }, 'Statut invalide'],
    [{ statut: null }, 'Statut invalide'],
    [{ modePaiement: 5 }, 'modePaiement doit être une chaîne de caractères'],
    [{ notes: {} }, 'notes doit être une chaîne de caractères'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaModificationCotisation, corps)).toBe(message)
  })
})

describe('SchemaStatutCotisant', () => {
  it('année absente ou null : laissée au service (année courante)', () => {
    expect(SchemaStatutCotisant.parse({ scoutId: 's1', cotisant: true }).anneeScolaire).toBeUndefined()
    expect(SchemaStatutCotisant.parse({ scoutId: 's1', cotisant: false, anneeScolaire: null }).anneeScolaire).toBeUndefined()
    expect(SchemaStatutCotisant.parse({ scoutId: 's1', cotisant: false, anneeScolaire: '2025-2026' }).anneeScolaire).toBe(
      '2025-2026',
    )
  })

  it.each([
    [{ cotisant: true }, 'scoutId et cotisant sont requis'],
    [{ scoutId: 's1', cotisant: 'oui' }, 'scoutId et cotisant sont requis'],
    [{ scoutId: 's1', cotisant: true, anneeScolaire: '2025-2027' }, 'Année scolaire invalide'],
    [{ scoutId: 's1', cotisant: true, anneeScolaire: 2025 }, 'Année scolaire invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaStatutCotisant, corps)).toBe(message)
  })
})

describe('Barème et activité', () => {
  it('SchemaCreationCotisation accepte activiteId facultatif', () => {
    expect(SchemaCreationCotisation.parse({ scoutId: 's1', type: 'CAMP', montant: 1, activiteId: 'a1' })).toEqual({
      cibles: ['s1'],
      type: 'CAMP',
      montant: 1,
      activiteId: 'a1',
    })
    expect(SchemaCreationCotisation.parse({ scoutId: 's1', type: 'CAMP', montant: 1, activiteId: '' })).toEqual({
      cibles: ['s1'],
      type: 'CAMP',
      montant: 1,
      activiteId: undefined,
    })
  })

  it('SchemaCreationBareme normalise branche et libellé', () => {
    expect(
      SchemaCreationBareme.parse({ anneeScolaire: '2026-2027', type: 'ADHESION_ANNUELLE', montant: 0, brancheType: '' }),
    ).toEqual({ anneeScolaire: '2026-2027', type: 'ADHESION_ANNUELLE', brancheType: null, libelle: null, montant: 0 })
  })

  it.each([
    [{ anneeScolaire: '2026', type: 'CAMP', montant: 1 }, 'Année scolaire invalide'],
    [{ anneeScolaire: '2026-2027', type: 'X', montant: 1 }, 'Type de cotisation invalide'],
    [{ anneeScolaire: '2026-2027', type: 'CAMP', montant: -5 }, 'Le montant doit être un entier positif ou nul'],
    [{ anneeScolaire: '2026-2027', type: 'CAMP', montant: 2.5 }, 'Le montant doit être un entier positif ou nul'],
    [{ anneeScolaire: '2026-2027', type: 'CAMP', montant: 1, brancheType: 'MOUSSES' }, 'Branche invalide'],
  ])('SchemaCreationBareme rejette %j', (corps, message) => {
    expect(premierMessage(SchemaCreationBareme, corps)).toBe(message)
  })

  it('SchemaModificationBareme : mise à jour partielle', () => {
    expect(SchemaModificationBareme.parse({ montant: 3000 })).toEqual({ montant: 3000 })
    expect(premierMessage(SchemaModificationBareme, { montant: -1 })).toBe(
      'Le montant doit être un entier positif ou nul',
    )
  })
})
