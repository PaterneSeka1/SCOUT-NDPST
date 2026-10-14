import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import {
  SchemaConfirmationAutorisation,
  SchemaCreationActivite,
  SchemaModificationActivite,
  SchemaPresencesActivite,
  SchemaRetraitAutorisation,
} from './activites.schemas'

// Premier message d'erreur, tel que renvoyé par ZodPipe au client.
function premierMessage(schema: ZodType, valeur: unknown): string | undefined {
  const resultat = schema.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

describe('SchemaCreationActivite', () => {
  it('accepte un corps valide et nettoie les textes', () => {
    const corps = SchemaCreationActivite.parse({
      titre: '  Sortie  ',
      dateDebut: '2026-11-01T09:00:00Z',
      dateFin: '2026-11-01T17:00:00Z',
      description: '  ',
      lieu: ' Bingerville ',
      type: 'SORTIE',
      brancheType: 'LOUVETEAUX',
      inconnu: 'ignoré',
    })
    expect(corps).toMatchObject({
      titre: 'Sortie',
      description: null,
      lieu: 'Bingerville',
      type: 'SORTIE',
      brancheType: 'LOUVETEAUX',
    })
    expect(corps.dateDebut).toEqual(new Date('2026-11-01T09:00:00Z'))
    expect(corps.dateFin).toEqual(new Date('2026-11-01T17:00:00Z'))
    expect(corps).not.toHaveProperty('inconnu')
  })

  it('date de fin absente ou vide = aucune', () => {
    expect(SchemaCreationActivite.parse({ titre: 'T', dateDebut: '2026-11-01' }).dateFin).toBeNull()
    expect(SchemaCreationActivite.parse({ titre: 'T', dateDebut: '2026-11-01', dateFin: '' }).dateFin).toBeNull()
  })

  it.each([
    [[], 'Données invalides'],
    [{ dateDebut: '2026-11-01' }, 'Le titre et la date de début sont obligatoires'],
    [{ titre: '   ', dateDebut: '2026-11-01' }, 'Le titre et la date de début sont obligatoires'],
    [{ titre: 'T', dateDebut: '' }, 'Le titre et la date de début sont obligatoires'],
    [{ titre: 'T', dateDebut: 'pas une date' }, 'La date de début est invalide'],
    [{ titre: 'T', dateDebut: '2026-11-01', dateFin: null }, 'La date de fin est invalide'],
    [{ titre: 'T', dateDebut: '2026-11-01', dateFin: 'n/a' }, 'La date de fin est invalide'],
    [{ titre: 'T', dateDebut: '2026-11-02', dateFin: '2026-11-01' }, 'La date de fin doit être après la date de début'],
    [{ titre: 'T', dateDebut: '2026-11-01', type: 'FETE' }, "Type d'activité invalide"],
    [{ titre: 'T', dateDebut: '2026-11-01', type: null }, "Type d'activité invalide"],
    [{ titre: 'T', dateDebut: '2026-11-01', brancheType: '' }, 'Branche invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaCreationActivite, corps)).toBe(message)
  })
})

describe('SchemaModificationActivite', () => {
  it('laisse absents les champs non envoyés (mise à jour partielle)', () => {
    const corps = SchemaModificationActivite.parse({ titre: ' Nouveau ' })
    expect(corps).toEqual({ titre: 'Nouveau' })
  })

  it('efface la date de fin et la branche avec null ou une chaîne vide', () => {
    expect(SchemaModificationActivite.parse({ dateFin: null, brancheType: '' })).toEqual({
      dateFin: null,
      brancheType: null,
    })
    expect(SchemaModificationActivite.parse({ dateFin: '', brancheType: null })).toEqual({
      dateFin: null,
      brancheType: null,
    })
  })

  it('efface description et lieu pour toute valeur non textuelle ou vide', () => {
    expect(SchemaModificationActivite.parse({ description: 42, lieu: '  ' })).toEqual({
      description: null,
      lieu: null,
    })
  })

  it.each([
    [{ titre: 3 }, 'Le titre est invalide'],
    [{ titre: '  ' }, 'Le titre est requis'],
    [{ dateDebut: null }, 'La date de début est invalide'],
    [{ dateDebut: '' }, 'La date de début est invalide'],
    [{ dateFin: 5 }, 'La date de fin est invalide'],
    [{ type: 'X' }, "Type d'activité invalide"],
    [{ brancheType: 'SCOUTS' }, 'Branche invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaModificationActivite, corps)).toBe(message)
  })
})

describe('Schémas des autorisations de camp', () => {
  it('confirmation simple : documents ignorés hors mode DOCUMENT', () => {
    expect(
      SchemaConfirmationAutorisation.parse({ scoutId: 's1', type: 'FICHE_MEDICALE', documentUrl: 'https://x' }),
    ).toEqual({
      scoutId: 's1',
      type: 'FICHE_MEDICALE',
      documentUrl: 'https://x',
      documentNomFichier: '',
      parDocument: false,
    })
  })

  it('confirmation par document : chemin local requis', () => {
    const base = { scoutId: 's1', type: 'AUTORISATION_PARENTALE', mode: 'DOCUMENT' }
    expect(SchemaConfirmationAutorisation.parse({ ...base, documentUrl: ' /api/fichiers/p1/a.pdf ', documentNomFichier: 'a.pdf' })).toMatchObject({
      documentUrl: '/api/fichiers/p1/a.pdf',
      parDocument: true,
    })
    expect(premierMessage(SchemaConfirmationAutorisation, { ...base, documentUrl: '/api/fichiers/a.pdf' })).toBe(
      'Le document est requis pour ce mode',
    )
    expect(
      premierMessage(SchemaConfirmationAutorisation, {
        ...base,
        documentUrl: '//exemple.com/a.pdf',
        documentNomFichier: 'a.pdf',
      }),
    ).toBe('documentUrl doit être un chemin local (ex : /api/fichiers/…)')
  })

  it.each([{ type: 'FICHE_MEDICALE' }, { scoutId: '', type: 'FICHE_MEDICALE' }, { scoutId: 's1', type: 'toString' }])(
    'exige scout et type valides : %j',
    (corps) => {
      expect(premierMessage(SchemaConfirmationAutorisation, corps)).toBe('Scout et type sont requis')
      expect(premierMessage(SchemaRetraitAutorisation, corps)).toBe('Scout et type sont requis')
    },
  )
})

describe('SchemaPresencesActivite', () => {
  it('accepte une liste de présences valide', () => {
    expect(
      SchemaPresencesActivite.parse({
        presences: [
          { scoutId: 's1', present: true },
          { scoutId: 's2', present: false, commentaire: null },
        ],
      }).presences,
    ).toHaveLength(2)
  })

  it.each([
    {},
    { presences: 'non' },
    { presences: [null] },
    { presences: [{ scoutId: '', present: true }] },
    { presences: [{ scoutId: 's1', present: 'oui' }] },
    { presences: [{ scoutId: 's1', present: true, commentaire: 3 }] },
  ])('rejette %j avec « Format invalide »', (corps) => {
    expect(premierMessage(SchemaPresencesActivite, corps)).toBe('Format invalide')
  })
})
