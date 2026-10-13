import { describe, it, expect } from 'vitest'
import { genererICS } from './calendrier'

describe('genererICS', () => {
  it('produit un VCALENDAR valide avec un VEVENT par élément', () => {
    const ics = genererICS('Mon calendrier', [
      {
        uid: 'abc123',
        debut: new Date('2026-07-10T09:00:00.000Z'),
        fin: new Date('2026-07-10T11:00:00.000Z'),
        titre: 'Réunion Louveteaux',
        lieu: 'Paroisse Saint-Paul',
        description: 'Réunion hebdomadaire',
      },
    ])

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:abc123@scout-ascci')
    expect(ics).toContain('DTSTART:20260710T090000Z')
    expect(ics).toContain('DTEND:20260710T110000Z')
    expect(ics).toContain('SUMMARY:Réunion Louveteaux')
    expect(ics).toContain('LOCATION:Paroisse Saint-Paul')
  })

  it('échappe les virgules, points-virgules et retours à la ligne', () => {
    const ics = genererICS('Cal', [
      { uid: '1', debut: new Date('2026-01-01T00:00:00.000Z'), titre: 'A, B; C\nD' },
    ])
    expect(ics).toContain('SUMMARY:A\\, B\\; C\\nD')
  })

  it('applique une durée par défaut d\'une heure quand la fin est absente', () => {
    const ics = genererICS('Cal', [
      { uid: '1', debut: new Date('2026-01-01T10:00:00.000Z'), titre: 'Sans fin' },
    ])
    expect(ics).toContain('DTSTART:20260101T100000Z')
    expect(ics).toContain('DTEND:20260101T110000Z')
  })
})
