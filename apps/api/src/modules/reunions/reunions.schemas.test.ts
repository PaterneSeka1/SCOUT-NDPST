import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import {
  SchemaConfigReunion,
  SchemaCreationReunions,
  SchemaModificationReunion,
  SchemaPresencesReunion,
} from './reunions.schemas'

// Premier message d'erreur, tel que renvoyé par ZodPipe au client.
function premierMessage(schema: ZodType, valeur: unknown): string | undefined {
  const resultat = schema.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

describe('SchemaCreationReunions', () => {
  it('convertit les dates de la série', () => {
    const corps = SchemaCreationReunions.parse({ dates: ['2026-11-07T15:00:00Z'], brancheType: null, dureeMinutes: 90 })
    expect(corps.dates).toEqual([new Date('2026-11-07T15:00:00Z')])
    expect(corps.brancheType).toBeNull()
  })

  it.each([
    [{}, 'Au moins une date est requise'],
    [{ dates: [] }, 'Au moins une date est requise'],
    [{ dates: Array.from({ length: 61 }, () => '2026-11-07') }, 'Maximum 60 réunions par création en série'],
    [{ dates: ['2026-11-07', 12] }, 'Une ou plusieurs dates sont invalides'],
    [{ dates: ['2026-11-07'], brancheType: 'SCOUTS' }, 'Branche invalide'],
    [{ dates: ['2026-11-07'], titre: 1 }, 'Le titre est invalide'],
    [{ dates: ['2026-11-07'], lieu: {} }, 'Le lieu est invalide'],
    [{ dates: ['2026-11-07'], notes: true }, 'Les notes sont invalides'],
    [{ dates: ['2026-11-07'], dureeMinutes: 1.5 }, 'La durée est invalide'],
    [[], 'Données invalides'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaCreationReunions, corps)).toBe(message)
  })
})

describe('SchemaModificationReunion', () => {
  it('laisse absents les champs non envoyés (mise à jour partielle)', () => {
    expect(SchemaModificationReunion.parse({ titre: null })).toEqual({ titre: null })
  })

  it('report : nouvelle date requise, une valeur vide efface la date de report', () => {
    expect(SchemaModificationReunion.parse({ statut: 'REPORTEE', dateReportee: '2026-11-14' }).dateReportee).toEqual(
      new Date('2026-11-14'),
    )
    expect(SchemaModificationReunion.parse({ dateReportee: '' })).toEqual({ dateReportee: null })
    expect(premierMessage(SchemaModificationReunion, { statut: 'REPORTEE' })).toBe(
      'La nouvelle date est requise pour reporter une réunion',
    )
    expect(premierMessage(SchemaModificationReunion, { statut: 'REPORTEE', dateReportee: null })).toBe(
      'La nouvelle date est requise pour reporter une réunion',
    )
  })

  it.each([
    [{ statut: 'FINIE' }, 'Statut invalide'],
    [{ dateReportee: 'plus tard' }, 'La date de report est invalide'],
    [{ dateReportee: 5 }, 'La date de report est invalide'],
    [{ dateHeure: null }, 'La date de la réunion est invalide'],
    [{ dateHeure: 'n/a' }, 'La date de la réunion est invalide'],
    [{ brancheType: '' }, 'Branche invalide'],
    [{ dureeMinutes: '90' }, 'La durée est invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaModificationReunion, corps)).toBe(message)
  })
})

describe('SchemaPresencesReunion', () => {
  it('accepte une feuille valide', () => {
    expect(
      SchemaPresencesReunion.parse({ presences: [{ scoutId: 's1', statut: 'EXCUSE', note: null }] }).presences,
    ).toHaveLength(1)
  })

  it.each([
    [{}, 'Format invalide'],
    [{ presences: [{ statut: 'PRESENT' }] }, 'Format invalide'],
    [{ presences: [{ scoutId: 's1', statut: 'PRESENT', note: 3 }] }, 'Format invalide'],
    [{ presences: [{ scoutId: 's1', statut: 'RETARD' }] }, 'Statut de présence invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaPresencesReunion, corps)).toBe(message)
  })
})

describe('SchemaConfigReunion', () => {
  it('accepte une configuration valide', () => {
    expect(SchemaConfigReunion.parse({ brancheType: 'LOUVETEAUX', jourSemaine: 6, heureDebut: '15:00' })).toEqual({
      brancheType: 'LOUVETEAUX',
      jourSemaine: 6,
      heureDebut: '15:00',
    })
  })

  it.each([
    [{ jourSemaine: 6, heureDebut: '15:00' }, 'Champs requis manquants'],
    [{ brancheType: 'LOUVETEAUX', heureDebut: '15:00' }, 'Champs requis manquants'],
    [{ brancheType: 'LOUVETEAUX', jourSemaine: 6, heureDebut: '' }, 'Champs requis manquants'],
    [{ brancheType: 'SCOUTS', jourSemaine: 6, heureDebut: '15:00' }, 'Branche invalide'],
    [
      { brancheType: 'LOUVETEAUX', jourSemaine: 7, heureDebut: '15:00' },
      'jourSemaine doit être compris entre 0 (dimanche) et 6 (samedi)',
    ],
    [{ brancheType: 'LOUVETEAUX', jourSemaine: 6, heureDebut: 1500 }, "L'heure de début est invalide"],
    [{ brancheType: 'LOUVETEAUX', jourSemaine: 6, heureDebut: '15:00', lieu: 1 }, 'Le lieu est invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaConfigReunion, corps)).toBe(message)
  })
})
