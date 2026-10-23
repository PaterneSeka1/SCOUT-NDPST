import { describe, expect, it } from 'vitest'
import { chargerApercuDistrict } from './apercu-district'

const donnees = {
  nomDistrict: 'Test',
  totaux: { paroisses: 1, paroissesActives: 1, scouts: 12, utilisateurs: 4, activitesMois: 2 },
  paroisses: [{ id: 'p1', nom: 'Saint Test', ville: 'Abidjan', actif: true, scouts: 12, utilisateurs: 4 }],
}

describe('Aperçu district local — lecture du contrat API', () => {
  it('valide les agrégats et retire les champs supplémentaires de la projection', async () => {
    const resultat = await chargerApercuDistrict(async () => Response.json({
      ...donnees, mineurs: [{ nom: 'Nom confidentiel' }],
      paroisses: [{ ...donnees.paroisses[0], chefGroupe: { nom: 'Nom responsable' } }],
    }))
    expect(resultat).toEqual({ statut: 'disponible', donnees })
    expect(JSON.stringify(resultat)).not.toContain('Nom confidentiel')
    expect(JSON.stringify(resultat)).not.toContain('Nom responsable')
  })

  it.each([[401, 'session-expiree'], [403, 'interdit'], [404, 'fonctionnalite-indisponible'], [503, 'indisponible']] as const)(
    'distingue le statut HTTP %i sans fabriquer des totaux à zéro', async (code, statut) => {
      expect(await chargerApercuDistrict(async () => new Response(null, { status: code }))).toEqual({ statut })
    },
  )

  it('distingue une indisponibilité réseau', async () => {
    expect(await chargerApercuDistrict(async () => { throw new Error('délai dépassé') })).toEqual({ statut: 'reseau' })
  })

  it.each([
    {},
    { ...donnees, totaux: { ...donnees.totaux, scouts: -1 } },
    { ...donnees, totaux: { ...donnees.totaux, scouts: 100 } },
    { ...donnees, totaux: { ...donnees.totaux, paroissesActives: 2 } },
    { ...donnees, paroisses: [{ ...donnees.paroisses[0], utilisateurs: '4' }] },
  ])('rejette une réponse invalide ou incohérente', async (corps) => {
    expect(await chargerApercuDistrict(async () => Response.json(corps))).toEqual({ statut: 'invalide' })
  })

  it('rejette une réponse 200 au format HTML', async () => {
    expect(await chargerApercuDistrict(async () => new Response('<html>Erreur</html>'))).toEqual({ statut: 'invalide' })
  })
})
