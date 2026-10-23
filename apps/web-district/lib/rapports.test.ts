import { describe, expect, it } from 'vitest'
import { lireRapports } from './rapports'

const donneesVides = {
  totaux: { paroisses: 0, paroissesActives: 0, scouts: 0, utilisateurs: 0, activites: 0 },
  kpis: { activitesMois: 0, tauxPresence: 0, cotisationsPayees: 0, cotisationsEnAttente: 0, utilisateursParCategorie: { staff: 0, parents: 0, comptesScouts: 0 } },
  paroisses: [],
}

describe('indicateurs administrateur', () => {
  it('conserve un résultat métier réellement vide', async () => {
    await expect(lireRapports(Response.json(donneesVides))).resolves.toEqual(donneesVides)
  })
  it.each([401, 403, 404, 500])('refuse une erreur HTTP %s même avec des statistiques dans le corps', async (status) => {
    await expect(lireRapports(Response.json(donneesVides, { status }))).rejects.toThrow()
  })
  it('refuse une réponse partielle au lieu de remplacer les valeurs manquantes par zéro', async () => {
    await expect(lireRapports(Response.json({ ...donneesVides, totaux: {} }))).rejects.toThrow('incomplets')
  })
  it('refuse des nombres encodés en texte', async () => {
    await expect(lireRapports(Response.json({ ...donneesVides, totaux: { ...donneesVides.totaux, scouts: '0' } }))).rejects.toThrow('incomplets')
  })
})
