import { describe, it, expect } from 'vitest'
import {
  anneeScolaireCourante,
  formatMontantFCFA,
  estAssujettiAdhesion,
  LABELS_STATUT_COTISATION,
  COULEURS_STATUT_COTISATION,
  STATUTS_COTISATION_A_FINALISER,
  STATUTS_COTISATION_ARGENT_RECU,
} from './cotisations'

// StatutCotisation est volontairement réduit à 3 valeurs (voir
// prisma/schema.prisma) — un test de non-régression ici évite qu'une
// évolution future ne réintroduise silencieusement un 4e statut ou n'oublie
// un libellé/couleur pour l'un des trois.
describe('constantes StatutCotisation (3 valeurs)', () => {
  const STATUTS = ['NON_A_JOUR', 'ARGENT_RECU', 'A_JOUR']

  it('LABELS_STATUT_COTISATION a exactement ces 3 clés', () => {
    expect(Object.keys(LABELS_STATUT_COTISATION).sort()).toEqual([...STATUTS].sort())
  })

  it('COULEURS_STATUT_COTISATION a exactement ces 3 clés', () => {
    expect(Object.keys(COULEURS_STATUT_COTISATION).sort()).toEqual([...STATUTS].sort())
  })

  it('STATUTS_COTISATION_A_FINALISER = tout sauf A_JOUR', () => {
    expect([...STATUTS_COTISATION_A_FINALISER].sort()).toEqual(['ARGENT_RECU', 'NON_A_JOUR'])
  })

  it('STATUTS_COTISATION_ARGENT_RECU = ARGENT_RECU et A_JOUR (argent effectivement reçu)', () => {
    expect([...STATUTS_COTISATION_ARGENT_RECU].sort()).toEqual(['ARGENT_RECU', 'A_JOUR'])
  })
})

describe('estAssujettiAdhesion', () => {
  it('vrai pour le staff (ex: CHEF_GROUPE, RESPONSABLE_BRANCHE)', () => {
    expect(estAssujettiAdhesion('CHEF_GROUPE')).toBe(true)
    expect(estAssujettiAdhesion('RESPONSABLE_BRANCHE')).toBe(true)
  })

  it('vrai pour SCOUT (adhésion suivie via la fiche Scout liée)', () => {
    expect(estAssujettiAdhesion('SCOUT')).toBe(true)
  })

  it('faux pour PARENT, qui ne paie pas de droit d’adhésion', () => {
    expect(estAssujettiAdhesion('PARENT')).toBe(false)
  })
})

describe('anneeScolaireCourante', () => {
  it('renvoie l\'année en cours quand on est après septembre', () => {
    expect(anneeScolaireCourante(new Date('2026-10-15'))).toBe('2026-2027')
  })

  it('renvoie l\'année précédente quand on est avant septembre', () => {
    expect(anneeScolaireCourante(new Date('2026-07-06'))).toBe('2025-2026')
  })

  it('bascule pile en septembre', () => {
    expect(anneeScolaireCourante(new Date('2026-09-01'))).toBe('2026-2027')
  })
})

describe('formatMontantFCFA', () => {
  it('formate avec séparateur de milliers et suffixe FCFA', () => {
    expect(formatMontantFCFA(5000)).toMatch(/^5.000 FCFA$/)
  })
})
