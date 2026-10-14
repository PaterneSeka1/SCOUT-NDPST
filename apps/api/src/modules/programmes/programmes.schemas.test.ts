import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import {
  SchemaCreationLigne,
  SchemaCreationProgramme,
  SchemaModificationLigne,
  SchemaModificationProgramme,
} from './programmes.schemas'

// Premier message d'erreur, tel que renvoyé par ZodPipe au client.
function premierMessage(schema: ZodType, valeur: unknown): string | undefined {
  const resultat = schema.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

const creationValide = { titre: 'Trimestre 1', periodeDebut: '2026-09-01', periodeFin: '2026-12-15' }

describe('SchemaCreationProgramme', () => {
  it('accepte un corps valide et convertit les dates', () => {
    const corps = SchemaCreationProgramme.parse({ ...creationValide, brancheType: null, paroisseId: 42 })
    expect(corps).toMatchObject({ titre: 'Trimestre 1', brancheType: null, paroisseId: undefined })
    expect(corps.periodeDebut).toEqual(new Date('2026-09-01'))
  })

  it.each([
    [{ ...creationValide, titre: undefined }, 'Le titre et la période sont obligatoires'],
    [{ ...creationValide, titre: '' }, 'Le titre et la période sont obligatoires'],
    [{ ...creationValide, titre: 3 }, 'titre doit être une chaîne de caractères'],
    [{ ...creationValide, description: 3 }, 'description doit être une chaîne de caractères'],
    [{ ...creationValide, periodeFin: undefined }, 'Le titre et la période sont obligatoires'],
    [{ ...creationValide, periodeDebut: 'demain' }, 'Date invalide'],
    [{ ...creationValide, periodeFin: '2026-08-01' }, 'La date de fin doit être après la date de début'],
    [{ ...creationValide, brancheType: 'SCOUTS' }, 'Branche invalide'],
    ['corps', 'Le titre et la période sont obligatoires'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaCreationProgramme, corps)).toBe(message)
  })
})

describe('SchemaModificationProgramme', () => {
  it('laisse absents les champs non envoyés et accepte description null', () => {
    expect(SchemaModificationProgramme.parse({ description: null })).toEqual({ description: null })
  })

  it.each([
    [{ titre: null }, 'titre doit être une chaîne de caractères'],
    [{ periodeFin: 'n/a' }, 'Date invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaModificationProgramme, corps)).toBe(message)
  })
})

describe('Schémas des lignes de programme', () => {
  it('création : thème requis, date facultative', () => {
    expect(SchemaCreationLigne.parse({ theme: 'Nœuds', datePrevue: '' })).toEqual({ theme: 'Nœuds', datePrevue: null })
    expect(premierMessage(SchemaCreationLigne, {})).toBe('Le thème est obligatoire')
    expect(premierMessage(SchemaCreationLigne, { theme: 1 })).toBe('theme doit être une chaîne de caractères')
    expect(premierMessage(SchemaCreationLigne, { theme: 'T', datePrevue: 'jamais' })).toBe('Date invalide')
  })

  it('modification : partielle, null efface date et activité', () => {
    expect(SchemaModificationLigne.parse({ datePrevue: null, activiteId: null })).toEqual({
      datePrevue: null,
      activiteId: null,
    })
    expect(SchemaModificationLigne.parse({ ordre: 2 })).toEqual({ ordre: 2 })
    expect(premierMessage(SchemaModificationLigne, { ordre: 1.5 })).toBe('ordre doit être un entier')
    expect(premierMessage(SchemaModificationLigne, { ordre: '2' })).toBe('ordre doit être un entier')
    expect(premierMessage(SchemaModificationLigne, { activiteId: 3 })).toBe(
      'activiteId doit être une chaîne de caractères',
    )
  })
})
