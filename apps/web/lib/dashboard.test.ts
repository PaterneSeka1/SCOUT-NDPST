import { describe, expect, it } from 'vitest'
import { lireDashboard } from './dashboard'

const vide = { kpis: { Scouts: 0, Présence: '0 %' }, activitesRecentes: [] }

describe('contrat du tableau de bord paroissial', () => {
  it('distingue un résultat vide valide d’une indisponibilité', async () => {
    await expect(lireDashboard(Response.json(vide))).resolves.toEqual(vide)
  })
  it.each([401, 403, 500])('rejette une erreur HTTP %s même si le corps contient des KPI', async (status) => {
    await expect(lireDashboard(Response.json(vide, { status }))).rejects.toThrow()
  })
  it('refuse les activités manquantes au lieu d’afficher une liste vide', async () => {
    await expect(lireDashboard(Response.json({ kpis: vide.kpis }))).rejects.toThrow('incomplètes')
  })
  it('refuse des valeurs de KPI et activités non exploitables', async () => {
    await expect(lireDashboard(Response.json({ kpis: { Scouts: null }, activitesRecentes: [{}] }))).rejects.toThrow('incomplètes')
  })
})
