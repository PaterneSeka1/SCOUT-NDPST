# Tests navigateur isolés

Les deux applications Next.js tournent réellement dans Chromium, avec les résolutions bureau et mobile. L’API HTTP locale `mock-api.cjs` fournit uniquement des données fictives en mémoire. Ces tests vérifient les parcours et les contrats envoyés par les interfaces ; ils ne prouvent ni les autorisations NestJS, ni la persistance Prisma, ni la rotation cryptographique des sessions.

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

Sous Linux sans bibliothèques système Chromium : `npx playwright install --with-deps chromium` dans l’environnement de CI autorisé.

Ports réservés : 3100 (paroisse), 3101 (district), 4199 (API simulée). Le lancement échoue si un service occupe ces ports ; aucun service existant n’est réutilisé. `API_URL_INTERNE` pointe explicitement vers l’API simulée et `INSTALLATIONS_GEREES=[]` interdit le relais vers une installation réelle. Aucun serveur NestJS ou PostgreSQL n’est démarré. Les sessions fictives et identifiants `*.invalid` ne sont utilisables que par ce serveur de test.

`SCOUT_E2E=1` isole les sorties Next dans `.next-e2e`, sans collision avec `.next` des builds. Les tests couvrent la première connexion et le remplacement du secret, la création de comptes sans mot de passe permanent, les confirmations avec le focus clavier, les refus d’accès de l’interface et les erreurs statistiques avec relance. L’espace district hors V1 reste bloqué.

Les rapports et traces sont conservés dans `playwright-report/` et `test-results/` en cas d’échec. Ils contiennent des données fictives et doivent rester hors Git. Les tests sur une API et une base temporaires réelles restent nécessaires pour valider l’intégration complète, ainsi qu’un contrôle manuel avec lecteur d’écran.
