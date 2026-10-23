import { expect, test } from '@playwright/test'

test('le tableau de bord utilise les données de son installation et permet la déconnexion', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'scout_acces', value: 'paroisse', url: baseURL! }])
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /Bienvenue, Awa Exemple/ })).toBeVisible()
  if (test.info().project.name.includes('mobile')) {
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await expect(page.getByRole('dialog', { name: 'Navigation principale' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Déconnexion' }).click()
  } else await page.getByRole('button', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL(/login$/)
})

test('la liste et la fiche scout affichent les données synthétiques et la limite du consentement', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'scout_acces', value: 'paroisse', url: baseURL! }])
  await page.goto('/dashboard/scouts')
  await expect(page.getByText('SCOUT001', { exact: true }).and(page.locator(':visible'))).toBeVisible()
  await page.goto('/dashboard/scouts/scout-test')
  await expect(page.getByRole('heading', { name: 'Koffi Synthétique' })).toBeVisible()
  await expect(page.getByText(/Ces indicateurs ne constituent pas une preuve de consentement/)).toBeVisible()
})

test('les activités et la feuille de présence envoient le pointage au serveur', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'scout_acces', value: 'paroisse', url: baseURL! }])
  await page.goto('/dashboard/activites')
  await expect(page.getByText('Réunion de test', { exact: true }).and(page.locator(':visible'))).toBeVisible()
  await page.goto('/dashboard/presences')
  await expect(page.getByText('Réunion de test', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Voir / Modifier' }).click()
  const pointage = page.getByRole('button', { name: 'Présence de Koffi Synthétique' })
  await expect(pointage).toHaveAttribute('aria-pressed', 'false')
  await pointage.click()
  await expect(pointage).toHaveAttribute('aria-pressed', 'true')
  const requete = page.waitForRequest((r) => r.url().endsWith('/api/activites/activite-test/presences') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Enregistrer les présences' }).click()
  expect((await requete).postDataJSON()).toEqual({ presences: [{ scoutId: 'scout-test', present: true }] })
  await expect(page.getByText('Présences enregistrées avec succès.', { exact: true })).toBeVisible()
})

test('le dashboard distingue une panne des activités vides et permet une reprise partagée', async ({ page, context, baseURL }) => {
  const erreursNavigateur: string[] = []
  page.on('pageerror', (erreur) => erreursNavigateur.push(erreur.message))
  await context.addCookies([{ name: 'scout_acces', value: 'paroisse', url: baseURL! }])
  let disponible = false
  let appels = 0
  await page.route('**/api/dashboard/kpis', async (route) => {
    appels += 1
    await route.fulfill(disponible ? {
      status: 200,
      json: { kpis: { Scouts: 3 }, activitesRecentes: [{ id: 'reprise-test', titre: 'Activité restaurée', dateDebut: '2026-01-10T10:00:00.000Z', type: 'REUNION', brancheType: null, lieu: null, _count: { presences: 1 } }] },
    } : { status: 500, json: { erreur: 'Indisponible' } })
  })
  await page.goto('/dashboard')
  const contenu = page.getByRole('main')
  await expect(contenu.getByRole('alert')).toContainText('Impossible de charger le tableau de bord')
  await expect(contenu.getByText('Aucune activité récente pour le moment.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Aucune activité pour le moment.', { exact: true })).toHaveCount(0)
  expect(appels).toBe(1) // La page et le widget partagent le même chargement.
  const appelsAvantReprise = appels
  disponible = true
  await contenu.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(contenu.getByText('Activité restaurée', { exact: true })).toBeVisible()
  await expect(contenu.getByRole('alert')).toHaveCount(0)
  expect(appels).toBe(appelsAvantReprise + 1)
  expect(erreursNavigateur).toEqual([])
})
