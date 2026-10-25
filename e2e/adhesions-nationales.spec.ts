import { expect, test } from '@playwright/test'

// Vrai navigateur et frontend ; API financière simulée pour vérifier les
// contrats d'interface. Les garanties SQL sont testées dans la suite PostgreSQL.
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'scout_acces', value: 'finance', url: baseURL! }])
})
test('collecte, lot, déclaration et confirmation nationale sont des actions distinctes', async ({ page }) => {
  const adhesion = {
    id: 'adhesion-test',
    annee: '2026-2027',
    categorie: 'SCOUT',
    brancheType: 'LOUVETEAUX',
    montantDu: 5000,
    montantEncaisse: 2000,
    solde: 3000,
    aVerifier: false,
    motifVerification: null,
    personne: { scout: { id: 'scout-test', nom: 'Exemple', prenom: 'Aya', matricule: 'SYNTH001' }, utilisateur: null },
    bareme: { id: 'bareme-test', libelle: 'Tarif scouts', montant: 5000, categorie: 'SCOUT', actif: true },
    situationLocale: 'PARTIELLEMENT_PAYE',
    situationReversement: 'NON_ELIGIBLE',
    statutNational: 'NON_CONFIRME',
    eligibleReversement: false,
    encaissements: [],
    confirmations: [],
  }
  const lot = {
    id: 'lot-test',
    createdAt: '2026-10-01T12:00:00.000Z',
    annee: '2026-2027',
    statut: 'PREPARE',
    montantTotal: 5000,
    verseLe: null as string | null,
    reference: null as string | null,
    lignes: [{ id: 'ligne-test', adhesionId: adhesion.id, montant: 5000, adhesion }],
  }
  let lotCree = false
  await page.route('**/api/adhesions-nationales**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      chemin = url.pathname
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: data })
    if (chemin.endsWith('/indicateurs'))
      return json({
        annee: '2026-2027',
        membres: 1,
        attendu: 5000,
        encaisse: adhesion.montantEncaisse,
        restant: adhesion.solde,
        aReverser: adhesion.montantEncaisse,
        reverse: 0,
        confirme: 0,
        aJourLocalement: 0,
        cotisantsConfirmes: 0,
        aVerifier: 0,
      })
    if (chemin.endsWith('/baremes')) return json([adhesion.bareme])
    if (req.method() === 'POST') {
      const c = req.postDataJSON()
      if (chemin.endsWith('/encaissements')) {
        expect(c.montant).toBe(3000)
        expect(c.mode).toBe('Mobile money')
        expect(c.encaisseLe).toBe('2026-10-01T10:30:00.000Z')
        expect(c.idempotence).toMatch(/^[0-9a-f-]{36}$/)
        adhesion.montantEncaisse = 5000
        adhesion.solde = 0
        adhesion.situationLocale = 'ENCAISSE_LOCALEMENT'
        adhesion.eligibleReversement = true
        adhesion.situationReversement = 'EN_ATTENTE_REVERSEMENT'
        return json({ id: 'encaissement-test' }, 201)
      }
      if (chemin.endsWith('/lots-reversement')) {
        expect(c.adhesionIds).toEqual(['adhesion-test'])
        lotCree = true
        adhesion.eligibleReversement = false
        adhesion.situationReversement = 'PREPARE'
        return json(lot, 201)
      }
      if (chemin.endsWith('/declarer')) {
        expect(c.reference).toBe('VERSEMENT-TEST')
        lot.statut = 'DECLARE'
        lot.reference = c.reference
        lot.verseLe = c.verseLe
        adhesion.statutNational = 'CONFIRMATION_NATIONALE_EN_ATTENTE'
        return json(lot, 201)
      }
      if (chemin.endsWith('/confirmer')) {
        expect(c.adhesionIds).toEqual(['adhesion-test'])
        lot.statut = 'CONFIRME'
        adhesion.statutNational = 'COTISANT_CONFIRME'
        return json(lot, 201)
      }
    }
    if (chemin.endsWith('/lots-reversement'))
      return json({
        lots: lotCree ? [lot] : [],
        pagination: { page: 1, limite: 25, total: lotCree ? 1 : 0, totalPages: 1 },
      })
    if (chemin.endsWith('/lots-reversement/lot-test')) return json(lot)
    if (chemin.endsWith('/adhesion-test')) return json(adhesion)
    return json({ adhesions: [adhesion], pagination: { page: 1, limite: 25, total: 1, totalPages: 1 } })
  })
  await page.goto('/dashboard/adhesions-nationales')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Adhésions nationales', exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Encaisser', exact: true }).filter({ visible: true }).click()
  let dialogue = page.getByRole('dialog')
  await dialogue.getByLabel('Montant reçu en FCFA').fill('3000')
  await dialogue.getByLabel('Mode (espèces, mobile money, virement ou autre)').fill('Mobile money')
  await dialogue.getByLabel('Date réelle de réception').fill('2026-10-01T10:30')
  await dialogue.getByRole('button', { name: 'Valider', exact: true }).click()
  await expect(dialogue).not.toBeVisible()
  await main.getByRole('button', { name: 'À reverser', exact: true }).click()
  await main.getByRole('checkbox', { name: 'Sélectionner Aya Exemple' }).filter({ visible: true }).check()
  await main.getByRole('button', { name: 'Préparer un lot' }).click()
  dialogue = page.getByRole('alertdialog')
  await expect(dialogue).toContainText('Aya Exemple')
  await dialogue.getByRole('button', { name: 'Confirmer', exact: true }).click()
  await main.getByRole('button', { name: 'Consulter', exact: true }).filter({ visible: true }).click()
  dialogue = page.getByRole('dialog')
  await expect(dialogue).toContainText('non confirmé')
  await expect(dialogue.getByRole('button', { name: 'Confirmer la sélection' })).toHaveCount(0)
  await dialogue.getByRole('button', { name: 'Déclarer reversé' }).click()
  dialogue = page.getByRole('dialog')
  await dialogue.getByLabel('Date effective du versement').fill('2026-10-02T10:00')
  await dialogue.getByLabel('Référence du versement').fill('VERSEMENT-TEST')
  await dialogue.getByRole('button', { name: 'Valider', exact: true }).click()
  await main.getByRole('button', { name: 'Consulter', exact: true }).filter({ visible: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer la sélection' }).click()
  dialogue = page.getByRole('dialog')
  await expect(dialogue).toContainText('Aya Exemple')
  await dialogue.getByLabel('Référence nationale').fill('NATION-TEST')
  await dialogue.getByRole('button', { name: 'Valider', exact: true }).click()
  await expect(main.getByText('confirme', { exact: true }).filter({ visible: true })).toBeVisible()
})
test('un compte multirôle change d’espace sans se reconnecter', async ({ page, isMobile }) => {
  await page.goto('/dashboard')
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  const select = page.getByLabel('Espace de travail').filter({ visible: true })
  await select.selectOption('mandat-route-test')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Bonjour Awa' })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  await expect(page.getByLabel('Espace de travail').filter({ visible: true })).toHaveValue('mandat-route-test')
})
