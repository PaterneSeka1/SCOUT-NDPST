import { describe, it, expect } from 'vitest'
import { calculerAge, brancheSelonAge, ORDRE_BRANCHES, ORDRE_CATEGORIES_SCOUTS, TRANCHES_AGE_BRANCHES } from './branches'

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
  it('distingue les cinq branches de la catégorie ressources adultes', () => {
    expect(ORDRE_BRANCHES).toEqual(['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS'])
    expect(ORDRE_CATEGORIES_SCOUTS).toEqual([...ORDRE_BRANCHES, 'RESSOURCES_ADULTES'])
  })

  it('propose les ressources adultes seulement à partir de 21 ans révolus', () => {
    const naissance = new Date(2005, 9, 25)
    expect(brancheSelonAge(calculerAge(naissance, new Date(2026, 9, 24)))).toBe('COMPAGNONS')
    expect(brancheSelonAge(calculerAge(naissance, new Date(2026, 9, 25)))).toBe('RESSOURCES_ADULTES')
  })

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

  it('les tranches sont contiguës et couvrent toutes les catégories sans trou ni chevauchement', () => {
    // Seule la dernière catégorie (Ressources Adultes) a un `max` nul (pas de
    // limite d'âge supérieure) — elle n'est donc jamais "actuelle" ici.
    for (let i = 0; i < ORDRE_CATEGORIES_SCOUTS.length - 1; i++) {
      const actuelle = TRANCHES_AGE_BRANCHES[ORDRE_CATEGORIES_SCOUTS[i]]
      const suivante = TRANCHES_AGE_BRANCHES[ORDRE_CATEGORIES_SCOUTS[i + 1]]
      expect(actuelle.max).not.toBeNull()
      expect(suivante.min).toBe((actuelle.max as number) + 1)
    }
  })
})
