# SCOUT-NDPST

Plateforme numérique du groupe scout d'**une paroisse** catholique de Côte d'Ivoire, qui a accueilli le scoutisme en 1956 :

- un **site public** (histoire, branches, actualités, activités, galerie, équipe, « Nous rejoindre », contact) ;
- un **espace de gestion** privé (scouts, branches, équipes, maîtrise, réunions, activités et camps, présences, cotisations, progression pédagogique, documents, rapports) ;
- une **administration** (comptes et permissions, identité et configuration, contenus publics, demandes d'adhésion, journal d'audit).

La paroisse est l'**identité fixe de l'installation** : une configuration unique, jamais une entité gérée en plusieurs exemplaires. Il n'existe ni gestion de paroisses, ni district, ni région.

| Paquet | Rôle |
| --- | --- |
| `apps/api` (`@scout/api`) | API NestJS + Prisma/PostgreSQL, seule à accéder à la base |
| `apps/web` (`@scout/web`) | Next.js (App Router) : `app/(public)`, `app/(auth)`, `app/(private)/dashboard`, `app/(private)/admin` |
| `packages/shared` (`@scout/shared`) | Règles métier pures partagées : rôles, branches, validation, contenus, périmètre |

## Architecture

```text
Navigateur ──► Nginx ──► web (Next.js) ──/api/*──► api (NestJS) ──► PostgreSQL
                                                        └──► Cloudflare R2 (fichiers, sauvegardes chiffrées)
```

- Le navigateur n'appelle jamais l'API directement : le frontend relaie `/api/*` côté serveur (même origine, ni CORS ni cookie tiers).
- **Authentification** : jeton d'accès JWT court (5 min, HS256, lié à une session révocable) et jeton de session opaque (12 h, rotation), en cookies httpOnly. Chaque requête relit la session, le compte, son rôle et sa permission `editeurContenu`.
- **Autorisation** : toutes les routes sont protégées par défaut (`AuthGuard` global) ; `@Roles(...)`, `@EditeurContenu()`, `@Public()` ; contrôles de branche et de propriété dans les services. Voir [les contrats de l'API](docs/contrats-api.md).
- **Données publiques** : uniquement ce qui est explicitement publié (activités publiques avec texte dédié, articles publiés, photos publiées et — pour des mineurs — consentements vérifiés, profils publics acceptés).
- **Espaces parent et scout** : conservés mais fermés (`ESPACES_FAMILLES_ACTIFS`, `packages/shared/src/perimetre.ts`).

## Démarrer

```bash
./setup.sh   # première fois : .env, dépendances, base, migrations, comptes de démonstration
./start.sh   # base, API (4000) et frontend (3000)
```

Détails, comptes de démonstration et commandes : [guide d'installation](docs/guide-installation.md).

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e
```

## Documentation

| Document | Contenu |
| --- | --- |
| [Guide d'installation](docs/guide-installation.md) | Développement local, variables, première mise en production, migrations |
| [Guide de l'administrateur](docs/guide-administrateur.md) | Rôles, configuration, comptes, contenus, consentements, demandes, audit |
| [Migration mono-paroissiale](docs/migration-mono-paroisse.md) | Reprise contrôlée d'une base existante, arbitrage, retour arrière |
| [Contrats de l'API](docs/contrats-api.md) | Routes, rôles, conventions |
| [Développer dans l'API](docs/developpement-api.md) | Briques et règles pour un nouveau module |
| [Déploiement OVH](docs/deploiement-ovh.md) et [releases](docs/exploitation-releases.md) | Production, sauvegardes, supervision, rollback |
| [Données sensibles et consentements](docs/donnees-sensibles-et-consentements.md) | Santé, image, conservation |
| [Rapport de refonte](docs/rapport-refonte.md) | Problèmes identifiés, corrections, validations, risques |

## Migrations Prisma

**Ne jamais lancer `prisma migrate dev` ni `prisma migrate reset` sur une base qui contient des données à conserver.** Utiliser `npm run db:diff`, créer le dossier de migration à la main (backfill avant toute contrainte `NOT NULL`), puis `npm run db:deploy`. Voir le [guide d'installation](docs/guide-installation.md#migrations-prisma).
