# Tests navigateur isolés

L’application `apps/web` tourne réellement dans Chromium, en résolution bureau (1366 × 900) et mobile (Pixel 7). L’API HTTP locale `mock-api.cjs` fournit uniquement des données fictives en mémoire, alignées sur les contrats actuels de l’API. Ces tests vérifient les parcours, la mise en page et les contrats envoyés par l’interface ; ils ne prouvent ni les autorisations NestJS, ni la persistance Prisma, ni la rotation cryptographique des sessions.

```bash
npm ci
npx playwright install chromium
npm run test:e2e            # ou : npx playwright test --workers=1 sur une machine limitée en mémoire
```

Sous Linux sans bibliothèques système Chromium : `npx playwright install --with-deps chromium` dans l’environnement de CI autorisé.

Ports réservés : 3100 (application) et 4199 (API simulée). Le lancement échoue si un service occupe ces ports ; aucun service existant n’est réutilisé. `API_URL_INTERNE` pointe explicitement vers l’API simulée. Aucun serveur NestJS ou PostgreSQL n’est démarré.

`SCOUT_E2E=1` isole les sorties Next dans `.next-e2e`, sans collision avec `.next`.

| Fichier | Couverture |
| --- | --- |
| `site-public.spec.ts` | Absence de débordement horizontal, navbar sur une ligne et nom non tronqué, regroupements au clavier, menu mobile, galerie vide compacte sans action d’administration, absence de lien interne mort, redirection `/contact`, parcours d’inscription (validation et contrat envoyé), filtre de la maîtrise |
| `espace-prive.spec.ts` | Connexion (contrat sans `paroisseId`), erreur de connexion, première connexion avec changement de mot de passe, panne puis reprise du tableau de bord, publication d’un profil public, création de compte avec secret temporaire affiché une seule fois, redirection sans session |

Les rapports et traces sont conservés dans `playwright-report/` et `test-results/` en cas d’échec. Ils contiennent des données fictives et doivent rester hors Git. Les tests sur une API et une base temporaires réelles restent nécessaires pour valider l’intégration complète, ainsi qu’un contrôle manuel avec lecteur d’écran.
