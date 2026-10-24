import { expect, test } from '@playwright/test'

const connecter = (valeur: string) => async ({ context, baseURL }: { context: import('@playwright/test').BrowserContext; baseURL?: string }) =>
  context.addCookies([{ name: 'scout_acces', value: valeur, url: baseURL! }])

test('la connexion ouvre le tableau de bord (contrat sans paroisseId)', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Matricule ou numéro de téléphone').fill('TEST001')
  await page.getByLabel('Mot de passe', { exact: true }).fill('Secret-Valide!42')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Bonjour Awa' })).toBeVisible()
})

test('un identifiant refusé affiche l’erreur dans la page', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Matricule ou numéro de téléphone').fill('INVALIDE')
  await page.getByLabel('Mot de passe', { exact: true }).fill('incorrect')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.locator('form').getByRole('alert')).toHaveText('Identifiant ou mot de passe incorrect.')
  await expect(page).toHaveURL(/\/connexion$/)
})

test('la première connexion impose un mot de passe personnel', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Matricule ou numéro de téléphone').fill('SCOUT-TEMP')
  await page.getByLabel('Mot de passe', { exact: true }).fill('Secret-Temporaire!42')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/changer-mot-de-passe$/)
  await page.getByLabel('Mot de passe actuel ou temporaire').fill('Secret-Temporaire!42')
  await page.getByLabel('Nouveau mot de passe personnel', { exact: true }).fill('Personnel-Inedit!42')
  await page.getByLabel('Confirmer le nouveau mot de passe').fill('Personnel-Inedit!42')
  const requete = page.waitForRequest((r) => r.url().endsWith('/api/auth/changer-mot-de-passe') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Enregistrer et me reconnecter' }).click()
  expect((await requete).postDataJSON()).toEqual({ motDePasseActuel: 'Secret-Temporaire!42', nouveauMotDePasse: 'Personnel-Inedit!42' })
  await expect(page.getByRole('status')).toContainText('mot de passe personnel est enregistré')
})

test('le tableau de bord distingue une panne d’un résultat vide et permet la reprise', async ({ page, context, baseURL }) => {
  await connecter('groupe')({ context, baseURL })
  let disponible = false
  await page.route('**/api/tableau-de-bord', async (route) => {
    if (!disponible) return route.fulfill({ status: 500, json: { erreur: 'Indisponible' } })
    return route.fallback()
  })
  await page.goto('/dashboard')
  const contenu = page.getByRole('main')
  await expect(contenu.getByRole('alert')).toContainText('Impossible de charger le tableau de bord')
  disponible = true
  await contenu.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(contenu.getByText('1 scout(s) sans contact d’urgence.')).toBeVisible()
  await expect(contenu.getByText('Scouts actifs', { exact: true })).toBeVisible()
})

test('la direction publie le profil public d’un membre de la maîtrise', async ({ page, context, baseURL }) => {
  await connecter('groupe')({ context, baseURL })
  await page.goto('/dashboard/maitrise')
  await page.getByRole('button', { name: /Profil public de Yao Kouassi/ }).click()
  const tiroir = page.getByRole('dialog')
  await tiroir.getByRole('switch', { name: 'Afficher sur le site public' }).click()
  await tiroir.getByLabel('Fonction affichée').fill('Chef Louveteaux')
  const requete = page.waitForRequest((r) => r.url().endsWith('/api/utilisateurs/resp-test/profil-public') && r.method() === 'PATCH')
  await tiroir.getByRole('button', { name: 'Enregistrer' }).click()
  expect((await requete).postDataJSON()).toMatchObject({ profilPublic: true, fonctionPublique: 'Chef Louveteaux', ordrePublic: 0 })
})

test('l’administrateur crée un compte et voit le secret temporaire une seule fois', async ({ page, context, baseURL }) => {
  await connecter('admin')({ context, baseURL })
  await page.goto('/admin/utilisateurs/nouveau')
  await expect(page).toHaveURL(/\/admin\/utilisateurs\?nouveau=1$/)
  const formulaire = page.getByRole('dialog', { name: 'Nouveau compte' })
  await formulaire.getByLabel(/^Prénom/).fill('Awa')
  await formulaire.getByLabel(/^Nom/).fill('Exemple')
  await formulaire.getByLabel(/^Matricule/).fill('TEST003')
  await formulaire.getByLabel(/^Rôle/).selectOption('ASSISTANT_GROUPE')
  await expect(formulaire.locator('input[type=password]')).toHaveCount(0)
  const requete = page.waitForRequest((r) => r.url().endsWith('/api/admin/utilisateurs') && r.method() === 'POST')
  await formulaire.getByRole('button', { name: 'Créer le compte' }).click()
  expect((await requete).postDataJSON()).not.toHaveProperty('password')
  const secret = page.getByRole('dialog', { name: 'Compte créé' })
  await expect(secret.getByText('Secret-Test-Unique!42')).toBeVisible()
  await secret.getByRole('button', { name: 'J’ai noté ces informations' }).click()
  await expect(page.getByText('Secret-Test-Unique!42')).toHaveCount(0)
})

test('une page privée sans session redirige vers la connexion', async ({ page }) => {
  await page.goto('/admin/configuration')
  await expect(page).toHaveURL(/\/connexion\?callbackUrl=%2Fadmin%2Fconfiguration$/)
})
