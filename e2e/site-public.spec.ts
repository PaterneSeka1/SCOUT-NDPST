import { expect, test } from '@playwright/test'

const PAGES = ['/', '/notre-histoire', '/notre-equipe', '/nos-branches', '/activites', '/actualites', '/galerie', '/nous-rejoindre', '/confidentialite']

test('aucune page publique ne déborde horizontalement ni n’échoue', async ({ page }) => {
  for (const chemin of PAGES) {
    const reponse = await page.goto(chemin)
    expect(reponse?.status(), chemin).toBe(200)
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(debordement, chemin).toBeLessThanOrEqual(0)
  }
})

test('la navigation bureau tient sur une ligne et le nom du groupe n’est pas tronqué', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'Navigation bureau uniquement')
  await page.goto('/galerie')
  const navigation = page.getByRole('navigation', { name: 'Navigation du site' }).first()
  for (const element of await navigation.locator('a:visible, button:visible').all()) {
    const hauteur = (await element.boundingBox())!.height
    expect(hauteur, await element.innerText()).toBeLessThan(48)
  }
  const nom = page.getByRole('link', { name: /accueil$/ }).locator('.titre-display')
  expect(await nom.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  // Les regroupements s'ouvrent au clavier et se ferment avec Échap.
  const groupe = navigation.getByRole('button', { name: /Le groupe/ })
  await groupe.click()
  await expect(navigation.getByRole('link', { name: /La maîtrise/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(navigation.getByRole('link', { name: /La maîtrise/ })).toBeHidden()
  await expect(groupe).toBeFocused()
})

test('le menu mobile présente les rubriques regroupées et les actions', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile', 'Menu mobile uniquement')
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  const menu = page.getByRole('dialog', { name: 'Menu du site' })
  await expect(menu.getByRole('link', { name: 'Notre histoire' })).toBeVisible()
  await expect(menu.getByRole('link', { name: /Nous rejoindre/ })).toBeVisible()
  await menu.getByRole('link', { name: 'Galerie' }).click()
  await expect(page).toHaveURL(/\/galerie$/)
  await expect(menu).toBeHidden()
})

test('la galerie vide propose un état compact, des liens utiles et aucune action d’administration', async ({ page }) => {
  await page.goto('/galerie')
  const etat = page.getByRole('heading', { name: 'Les premiers albums arrivent bientôt.' })
  await expect(etat).toBeVisible()
  // L'état vide est visible sans défilement : pas d'écran presque blanc.
  expect((await etat.boundingBox())!.y).toBeLessThan(page.viewportSize()!.height)
  await expect(page.getByRole('main').getByRole('link', { name: /Voir l’agenda/ })).toHaveAttribute('href', '/activites')
  await expect(page.locator('a[href^="/admin"], a[href^="/dashboard"]')).toHaveCount(0)
})

test('aucun lien interne du site public n’est mort', async ({ page, request }) => {
  const liens = new Set<string>()
  for (const chemin of ['/', '/galerie', '/nous-rejoindre']) {
    await page.goto(chemin)
    for (const href of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!))) {
      liens.add(href.split('#')[0])
    }
  }
  for (const lien of liens) {
    const reponse = await request.get(lien, { maxRedirects: 5 })
    expect(reponse.status(), lien).toBeLessThan(400)
  }
})

test('l’ancienne adresse /contact mène au parcours « Contacter le groupe »', async ({ page }) => {
  await page.goto('/contact')
  await expect(page).toHaveURL(/\/nous-rejoindre\?objet=contact/)
  await expect(page.locator('#titre-formulaire')).toHaveText('Contacter le groupe')
})

test('l’inscription d’un jeune valide les champs puis envoie un contrat minimal', async ({ page }) => {
  await page.goto('/nous-rejoindre?objet=inscription')
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click()
  await expect(page.getByText('Le formulaire contient des erreurs')).toBeVisible()
  await page.getByLabel(/^Prénom\s*\*?$/).fill('Awa')
  await page.getByLabel(/^Nom\s*\*?$/).fill('Exemple')
  await page.getByLabel(/^Téléphone/).fill('07 00 00 00 00')
  await page.getByLabel(/^Prénom du jeune/).fill('Koffi')
  await page.getByLabel(/^Nom du jeune/).fill('Exemple')
  await page.getByLabel(/^Date de naissance/).fill('2016-03-01')
  await page.getByLabel(/J’accepte/).check()
  const requete = page.waitForRequest((r) => r.url().endsWith('/api/public/demandes') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click()
  const corps = (await requete).postDataJSON()
  expect(corps).toMatchObject({ type: 'INSCRIPTION_JEUNE', prenomJeune: 'Koffi', dateNaissanceJeune: '2016-03-01', consentement: true, siteWeb: '' })
  expect(corps).not.toHaveProperty('allergies')
  await expect(page.getByRole('heading', { name: 'Votre demande a bien été reçue' })).toBeVisible()
})

test('la maîtrise publique se filtre par branche', async ({ page }) => {
  await page.goto('/notre-equipe')
  await expect(page.getByRole('heading', { name: 'Direction du groupe' })).toBeVisible()
  await page.getByRole('link', { name: 'Louveteaux' }).click()
  await expect(page).toHaveURL(/branche=LOUVETEAUX/)
  await expect(page.getByRole('heading', { name: 'Yao Kouassi' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Direction du groupe' })).toHaveCount(0)
})
