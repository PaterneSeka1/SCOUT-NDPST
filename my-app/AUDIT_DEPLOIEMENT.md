# Audit de préparation au déploiement — SCOUT-NDPST

Rapport de lecture seule : aucun code n'a été modifié dans le cadre de cet audit. Chaque constat a été vérifié directement dans le dépôt (pas de supposition).

## Résumé

| # | Constat | Sévérité |
|---|---|---|
| 1 | Deux chemins de déploiement parallèles, non unifiés | Bloquant à moyen terme |
| 2 | Mot de passe admin par défaut en dur dans `prisma/seed.ts`, affiché en clair dans les logs | Bloquant avant toute mise en production |
| 3 | Aucun healthcheck applicatif (`/api/health`) | À corriger avant supervision automatisée |
| 4 | `.env.example` incomplet (`NEXT_PUBLIC_SITE_URL` absente) | Mineur, source de confusion |
| 5 | `lib/rateLimit.ts` en mémoire, invalide en multi-instance | Non bloquant tant qu'une seule instance tourne |
| 6 | CI valide mais ne migre/déploie jamais automatiquement | Attendu vu le mode de déploiement actuel, à documenter |

---

## 1. Deux chemins de déploiement parallèles

Le dépôt contient deux implémentations indépendantes de la même logique critique (sauvegarde + migration + démarrage) :

- **`my-app/Dockerfile` + `my-app/docker-entrypoint.sh`** : multi-stage, `output: 'standalone'`, utilisateur non-root, l'entrypoint fait `pg_dump` puis `prisma migrate deploy` avant `node server.js`. Utilisé uniquement par `docker-compose.yml` (profil dev local) et par le job `docker-build` de la CI — qui **construit** l'image mais ne l'**exécute jamais**.
- **En production réelle (VPS OVH)** : `deploy-ovh.sh` ne passe pas par ce Dockerfile. Seul PostgreSQL tourne en conteneur (`docker-compose.prod.yml` — vérifié : un seul service `db`, aucun service `app`). L'application Next.js tourne directement sur l'hôte via **pm2** (`npm run build` puis `pm2 start ... -- run start -- -p 3002`), avec nginx en reverse proxy (hors dépôt). Le script rejoue **manuellement** les mêmes étapes critiques (backup, `migrate deploy`, build) côté hôte.

**Risque** : les deux chemins peuvent diverger silencieusement — une évolution de la logique de backup/migration dans l'un n'est pas garantie de se propager à l'autre, et le chemin Docker n'est jamais testé en conditions réelles (seul son *build* est vérifié en CI, jamais son exécution).

**Recommandation** : choisir une cible officielle unique. Si `deploy-ovh.sh`/pm2 reste la cible réelle, documenter clairement que le `Dockerfile` est un chemin secondaire (dev local uniquement) et ne pas laisser croire qu'il reflète la prod. Sinon, migrer la prod vers le conteneur Docker et supprimer la duplication.

## 2. Mot de passe admin par défaut en dur (`prisma/seed.ts`)

```ts
// prisma/seed.ts:51
const motDePasse = process.env.ADMIN_PASSWORD ?? 'Admin1234!'
...
// prisma/seed.ts:64
console.log(`  Admin plateforme → matricule: ${admin.matricule}  /  mot de passe: ${motDePasse}`)
```

Deux problèmes distincts, vérifiés dans le fichier :
- Si `ADMIN_PASSWORD` n'est pas défini au moment d'un `seed`, le compte admin plateforme est créé avec le mot de passe prévisible `Admin1234!`.
- Le mot de passe (par défaut ou fourni) est **affiché en clair dans la sortie standard** — s'il est relancé en production, ce mot de passe atterrit potentiellement dans des logs de build/déploiement (pm2 logs, logs CI, historique de terminal SSH).

**Recommandation** : avant toute mise en production, vérifier que `ADMIN_PASSWORD` est bien positionné dans l'environnement de prod (`.env.prod`), et envisager de retirer le `console.log` du mot de passe en clair (ou de le conditionner à un mode explicitement interactif/dev), pour qu'un re-seed accidentel en prod n'expose jamais le mot de passe dans des logs persistants.

## 3. Absence de healthcheck applicatif

Vérifié : aucune route `app/api/health*` n'existe. Ni `my-app/Dockerfile` (pas de directive `HEALTHCHECK`) ni `docker-compose.prod.yml` ne définissent de vérification de santé pour l'application — seul le service `db` en a une (`pg_isready`).

**Recommandation** : ajouter une route `GET /api/health` légère (ping DB + `200 OK`), utile dès qu'un load balancer, un monitoring externe, ou pm2 lui-même (`pm2` peut redémarrer un process en échec de healthcheck) doit superviser l'app.

## 4. `.env.example` incomplet

`NEXT_PUBLIC_SITE_URL` est lue dans `app/layout.tsx` (fallback sur `NEXTAUTH_URL`) pour construire les métadonnées SEO (`metadataBase`, canonical) — ajoutées récemment sur `/admin/apparence`. Elle n'apparaît pas dans `.env.example`, qui ne documente que `NEXTAUTH_URL`.

**Recommandation** : ajouter `NEXT_PUBLIC_SITE_URL` à `.env.example` avec un commentaire expliquant son rôle SEO, pour que tout futur déploiement pense à la renseigner.

## 5. Rate limiting en mémoire

`lib/rateLimit.ts` utilise une `Map` en mémoire (documenté comme tel dans le code), utilisée pour la connexion et les endpoints sensibles (mot de passe oublié/réinitialisation, ICS calendrier). Cohérent avec le déploiement actuel (une seule instance pm2), mais deviendrait inefficace dès qu'une deuxième instance serait ajoutée (chaque instance aurait son propre compteur, contournant la limite globale).

**Recommandation** : pas d'action requise tant qu'une seule instance tourne. À remplacer par une solution partagée (Redis ou équivalent) avant tout projet de scaling horizontal.

## 6. CI ne migre/déploie jamais automatiquement

`.github/workflows/ci.yml` : un job `test` (lint + `tsc --noEmit` + tests unitaires) et un job `docker-build` (construit l'image, **sans la publier ni l'exécuter**). Aucune étape ne migre une base de test, ne déploie, ni ne fait tourner de smoke test sur l'image construite. Le déploiement réel reste un script manuel (`deploy-ovh.sh`) lancé en SSH.

**Recommandation** : c'est cohérent avec le choix actuel (déploiement manuel maîtrisé plutôt qu'automatisé) — à condition que ce soit un choix assumé, pas un oubli. Si le passage à un déploiement automatisé est envisagé un jour, ce pipeline devra grandir pour inclure au minimum un test de migration contre une base éphémère.

---

*Rapport généré par lecture directe du dépôt le 2026-07-19. Aucune correction n'a été appliquée — ce document liste ce qui bloquerait une mise en production sans intervention, à traiter selon vos priorités.*
