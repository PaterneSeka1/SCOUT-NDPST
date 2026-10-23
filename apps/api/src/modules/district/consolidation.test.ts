import { describe, expect, it } from 'vitest'
import { consoliderIndicateurs } from './consolidation'

const donnees = { version: 1, installationId: 'installation-a', districtId: 'district-a', periode: '2026-10', calculeLe: '2026-10-23T12:00:00.000Z', scoutsActifs: 12, activitesTerminees: 3 }
const source = { installationId: 'installation-a', identiteAuthentifiee: 'installation-a', donnees }

describe('Consolidation préparatoire des agrégats', () => {
  it('additionne uniquement les installations autorisées pour la période demandée', () => {
    const resultat = consoliderIndicateurs('district-a', '2026-10', ['installation-a'], [source, { ...source, installationId: 'installation-z' }])
    expect(resultat.complet).toBe(true)
    expect(resultat.totaux).toEqual({ scoutsActifs: 12, activitesTerminees: 3 })
    expect(resultat.sources).toHaveLength(1)
  })
  it('renvoie un total indisponible lorsque des sources manquent', () => {
    const resultat = consoliderIndicateurs('district-a', '2026-10', ['installation-a', 'installation-b'], [source])
    expect(resultat.complet).toBe(false)
    expect(resultat.totaux).toBeNull()
    expect(resultat.sources[1]?.statut).toBe('indisponible')
  })
  it('refuse une identité de transport incohérente', () => {
    expect(consoliderIndicateurs('district-a', '2026-10', ['installation-a'], [{ ...source, identiteAuthentifiee: 'intrus' }]).sources[0]?.statut).toBe('refusee')
  })
  it.each([
    { ...donnees, districtId: 'autre-district' },
    { ...donnees, periode: '2026-09' },
    { ...donnees, scoutsActifs: -1 },
    { ...donnees, sante: 'information interdite' },
  ])('refuse les données hors périmètre ou hors contrat', (invalide) => {
    expect(consoliderIndicateurs('district-a', '2026-10', ['installation-a'], [{ ...source, donnees: invalide }]).totaux).toBeNull()
  })
  it('refuse les sources dupliquées et ne présente pas une absence comme zéro', () => {
    expect(consoliderIndicateurs('district-a', '2026-10', ['installation-a'], [source, source]).totaux).toBeNull()
    expect(consoliderIndicateurs('district-a', '2026-10', [], []).totaux).toBeNull()
  })
})
