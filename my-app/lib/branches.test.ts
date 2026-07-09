import { describe, it, expect } from 'vitest'
import { calculerAge, brancheSelonAge, ORDRE_BRANCHES, TRANCHES_AGE_BRANCHES } from './branches'

describe('calculerAge', () => {
  it("calcule l'âge correctement quand l'anniversaire est déjà passé cette année", () => {
    expect(calculerAge(new Date(2015, 0, 15), new Date(2026, 5, 1))).toBe(11)
  })

  it("calcule l'âge correctement quand l'anniversaire n'est pas encore atteint cette année", () => {
    expect(calculerAge(new Date(2015, 11, 20), new Date(2026, 5, 1))).toBe(10)
  })

  it("calcule l'âge correctement le jour de l'anniversaire", () => {
    expect(calculerAge(new Date(2015, 5, 1), new Date(2026, 5, 1))).toBe(11)
  })
})

describe('brancheSelonAge', () => {
  it('retourne la bonne branche pour un âge dans chaque tranche', () => {
    expect(brancheSelonAge(6)).toBe('OISILLONS')
    expect(brancheSelonAge(7)).toBe('OISILLONS')
    expect(brancheSelonAge(8)).toBe('LOUVETEAUX')
    expect(brancheSelonAge(10)).toBe('LOUVETEAUX')
    expect(brancheSelonAge(11)).toBe('ECLAIREURS')
    expect(brancheSelonAge(13)).toBe('ECLAIREURS')
    expect(brancheSelonAge(14)).toBe('CHEMINOTS')
    expect(brancheSelonAge(16)).toBe('CHEMINOTS')
    expect(brancheSelonAge(17)).toBe('COMPAGNONS')
    expect(brancheSelonAge(20)).toBe('COMPAGNONS')
    expect(brancheSelonAge(21)).toBe('RESSOURCES_ADULTES')
    expect(brancheSelonAge(45)).toBe('RESSOURCES_ADULTES')
  })

  it('retourne null pour un âge hors des tranches définies (trop jeune)', () => {
    expect(brancheSelonAge(5)).toBeNull()
  })

  it('les tranches sont contiguës et couvrent ORDRE_BRANCHES sans trou ni chevauchement', () => {
    // Seule la dernière branche (Ressources Adultes) a un `max` nul (pas de
    // limite d'âge supérieure) — elle n'est donc jamais "actuelle" ici.
    for (let i = 0; i < ORDRE_BRANCHES.length - 1; i++) {
      const actuelle = TRANCHES_AGE_BRANCHES[ORDRE_BRANCHES[i]]
      const suivante = TRANCHES_AGE_BRANCHES[ORDRE_BRANCHES[i + 1]]
      expect(actuelle.max).not.toBeNull()
      expect(suivante.min).toBe((actuelle.max as number) + 1)
    }
  })
})
