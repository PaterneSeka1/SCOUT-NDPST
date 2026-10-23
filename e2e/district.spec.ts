import { expect, test } from '@playwright/test'

test('une erreur des statistiques affiche une erreur et permet de réessayer', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'scout_acces', value: 'admin', url: baseURL! }])
  let indisponible = true
  await page.route('**/api/admin/rapports', (route) => indisponible
    ? route.fulfill({ status: 500, json: { erreur: 'Indisponible' } })
    : route.continue())
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Indicateurs indisponibles' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Impossible de charger' })).toContainText('Impossible de charger')
  await expect(page.getByText('Paroisses actives', { exact: true })).toHaveCount(0)
  indisponible = false
  await page.getByRole('button', { name: 'Réessayer' }).click()
  await expect(page.getByText('Paroisses actives', { exact: true })).toBeVisible()
})

test('un compte paroissial ne peut pas ouvrir la console plateforme', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'scout_acces', value: 'paroisse', url: baseURL! }])
  await page.goto('/admin')
  await expect(page).toHaveURL(/login\?refus=1$/)
  await expect(page.getByText('Accès réservé aux administrateurs de la plateforme.', { exact: true }).first()).toBeVisible()
})

test('le journal affiche les opérations administratives synthétiques', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'scout_acces', value: 'admin', url: baseURL! }])
  await page.goto('/admin/audit')
  await expect(page.getByRole('heading', { name: "Journal d'audit", level: 1 })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'operation : Nomination de test' })).toBeVisible()
})

test('une nomination de rôle est confirmée avant son envoi et garde le district masqué', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'scout_acces', value: 'admin', url: baseURL! }])
  await page.goto('/admin/utilisateurs')
  await page.getByRole('button', { name: 'Nommer', exact: true }).and(page.locator(':visible')).click()
  const modal = page.getByRole('dialog', { name: 'Nommer Awa Exemple' })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('heading', { name: 'Affectation district' })).toHaveCount(0)
  await modal.getByLabel('Rôle', { exact: false }).selectOption('ADJOINT_GROUPE')
  await modal.getByRole('button', { name: 'Enregistrer la nomination' }).click()
  const confirmation = page.getByRole('alertdialog', { name: 'Confirmer cette nomination ?' })
  await expect(confirmation).toBeVisible()
  const requete = page.waitForRequest((r) => r.url().endsWith('/api/admin/utilisateurs/membre-test/nominations') && r.method() === 'PUT')
  await confirmation.getByRole('button', { name: 'Enregistrer la nomination' }).click()
  expect((await requete).postDataJSON()).toMatchObject({ role: 'ADJOINT_GROUPE', roleDistrict: null })
  await expect(modal).not.toBeVisible()
})
