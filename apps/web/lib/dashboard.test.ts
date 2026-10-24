import { describe, expect, it } from 'vitest'
import { lireDashboard } from './dashboard'

const vide = { profil: 'DIRECTION', indicateurs: [{ cle: 'effectif', libelle: 'Scouts actifs', valeur: 0 }], alertes: [], actions: [], activitesAVenir: [] }

describe('contrat du tableau de bord (GET /api/tableau-de-bord)', () => {
  it('distingue un résultat vide valide d’une indisponibilité', async () => {
    await expect(lireDashboard(Response.json(vide))).resolves.toEqual(vide)
  })
  it.each([401, 403, 500])('rejette une erreur HTTP %s même si le corps contient des indicateurs', async (status) => {
    await expect(lireDashboard(Response.json(vide, { status }))).rejects.toThrow()
  })
  it('refuse une réponse sans profil ni alertes au lieu d’afficher un tableau vide', async () => {
    await expect(lireDashboard(Response.json({ indicateurs: vide.indicateurs }))).rejects.toThrow('incomplètes')
  })
  it('refuse des indicateurs et activités non exploitables', async () => {
    await expect(
      lireDashboard(Response.json({ ...vide, indicateurs: [{ cle: 'x', libelle: 'X', valeur: null }], activitesAVenir: [{}] })),
    ).rejects.toThrow('incomplètes')
  })
  it('accepte le profil administrateur avec son journal et l’état des services', async () => {
    const admin = {
      profil: 'ADMIN',
      indicateurs: [],
      alertes: [{ niveau: 'attention', message: 'Un seul administrateur actif.', lien: '/admin/utilisateurs' }],
      actions: [{ libelle: 'Traiter les demandes', lien: '/admin/demandes', nombre: 2 }],
      journal: [{ id: 'j1', action: 'CONNEXION', entite: null, createdAt: '2026-10-24T08:00:00.000Z', acteur: null }],
      services: { baseDeDonnees: true, stockage: 'local', email: false },
    }
    await expect(lireDashboard(Response.json(admin))).resolves.toMatchObject({ profil: 'ADMIN' })
  })
})
