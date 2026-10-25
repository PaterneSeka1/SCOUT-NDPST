# Livraison des adhésions 2026–2027

Branche : `feat/adhesions-2026-2027`. Aucun push, aucune fusion, aucun déploiement et aucune intervention sur des données de production.

## Documents

- [Audit initial et matrice de risques](audit.md).
- [Architecture, états, matrice des permissions et contrats API](architecture-api.md).
- [Migration, sauvegardes et exploitation](migration-exploitation.md).
- [Revue de sécurité et limites](securite.md).
- [Récapitulatif pour pull request](pull-request.md).

## Changements livrés

| Lot | Réalisation                                                                                                                                              | Fichiers principaux                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Audit du circuit actuel et des dépendances ; branche dédiée                                                                                              | `docs/adhesions-2026-2027/audit.md`                                                                                                                                                                                                                                                |
| 1   | Identité financière commune, unicité annuelle, barèmes scouts/chefs et provenance                                                                        | `apps/api/prisma/schema.prisma`, trois migrations `20261025*`, `packages/shared/src/adhesions-nationales.ts`                                                                                                                                                                       |
| 2   | Encaissements séparés, idempotence, compensation, réservations par lots, déclaration et confirmation nationale, audit transactionnel                     | `apps/api/src/modules/adhesions-nationales/*`, `common/lib/identite.ts`, frontière du module historique `cotisations.service.ts`                                                                                                                                                   |
| 3   | Mandats simultanés, clôture individuelle, sessions relues, sélection d'espace vérifiée et périmètres de branche                                          | `common/guards/auth.guard.ts`, `common/perimetre.service.ts`, `modules/utilisateurs/{mandats,responsabilites.controller}.ts`, services métier utilisateurs/scouts/activités/documents/programmes/progression/réunions/calendrier/tableau-de-bord, `packages/shared/src/mandats.ts` |
| 4   | Vues adhésions/scouts/chefs/encaissements/à reverser/lots/barèmes/rapports ; habilitations ; mandats ; synthèse sur dashboard ; organigrammes actualisés | `apps/web/components/adhesions/*`, `hooks/useAdhesionsNationales.ts`, nouvelles pages privées, `SelecteurEspace.tsx`, navigation et types de session ; pages de maîtrise publiques/privées et anciennes cotisations                                                                |
| 5   | Reprise simulable et idempotente, tests SQL/HTTP/navigateur, intégration dans la CI et dossier de livraison                                              | `reprise-cotisations.ts`, `scripts/reprendre-cotisations.ts`, `test/adhesions-nationales.postgres.ts`, `vitest.adhesions.config.mts`, `e2e/adhesions-nationales.spec.ts`, `.github/workflows/ci.yml`                                                                               |

Les encaissements locaux ne confèrent jamais le statut de cotisant national. Un chef à plusieurs fonctions conserve une seule adhésion par année. Les montants officiels ne sont pas inventés : ils doivent être saisis dans les barèmes par un compte explicitement habilité.

## Vérifications exécutées

| Commande / contrôle                                                                                  | Résultat observé                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                       | Réussi, aucune erreur ni avertissement bloquant                                                                                                                                         |
| `npm run typecheck`                                                                                  | Réussi ; API, web et package partagé                                                                                                                                                    |
| `npm test -w @scout/shared`                                                                          | 71 tests réussis                                                                                                                                                                        |
| `npm test -w @scout/api`                                                                             | 554 tests réussis, dans Node 22 jetable                                                                                                                                                 |
| `npm test -w @scout/web`                                                                             | 18 tests réussis                                                                                                                                                                        |
| `npm run test:integration -w @scout/api`                                                             | 10 tests PostgreSQL historiques réussis sur leur base temporaire distincte                                                                                                              |
| `npm run test:adhesions:integration -w @scout/api`                                                   | 14 tests PostgreSQL/HTTP financiers réussis sur une base vierge dédiée                                                                                                                  |
| `npm exec -w @scout/api -- prisma validate`                                                          | Schéma valide                                                                                                                                                                           |
| `prisma migrate deploy`                                                                              | 29 migrations appliquées sur une base vierge, dont les trois nouvelles                                                                                                                  |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code` | Aucune dérive : migration vide                                                                                                                                                          |
| `npm run build`                                                                                      | Compilation de production du monorepo ; voir rapport final de commande                                                                                                                  |
| Playwright, configuration temporaire sur build de production                                         | 32 réussites, 2 ignorés selon le format d'écran ; nouveaux parcours financiers sur bureau et mobile inclus                                                                              |
| Sauvegarde `pg_dump -Fc` puis `pg_restore --exit-on-error`                                           | Restauration synthétique réussie sur une nouvelle base ; 14 adhésions, 9 écritures, 25 000 FCFA encaissés, 3 cotisations sources et 44 entrées d'audit financier identiques avant/après |
| Analyse du YAML CI avec `js-yaml`                                                                    | Valide ; pipeline distant non exécuté                                                                                                                                                   |
| `git diff --check`                                                                                   | Aucun défaut d'espacement                                                                                                                                                               |

### Environnement et incidents de recette

Le chargement natif SWC de l'hôte refuse ses ancêtres de cache ; les tests API et les builds ont donc été exécutés dans `node:22-bookworm-slim`, sans changer les dépendances de l'application. Le PostgreSQL 16 de recette est un conteneur distinct sans volume persistant.

Le premier passage Playwright sur `next dev` a donné 29 réussites, 3 échecs et 2 ignorés. Le test financier cherchait un rôle `dialog` au lieu du rôle `alertdialog` du composant de confirmation ; ce sélecteur a été corrigé. Le serveur de développement a aussi émis une erreur de mesure de performance. La recette a été rejouée intégralement sur le build de production stabilisé : 32 réussites et 2 ignorés. Ces tests utilisent une API simulée ; la persistance et les autorisations NestJS sont vérifiées séparément par la suite PostgreSQL/HTTP réelle.

Les bibliothèques système de Chromium ont été installées uniquement dans le conteneur navigateur jetable. Le navigateur local déjà disponible a été monté en lecture seule. Les configurations temporaires de lancement ne sont pas ajoutées au dépôt.

Prisma/pg émet un avertissement de dépréciation sur la sérialisation de requêtes internes pendant certains tests transactionnels ; les tests de concurrence réussissent. Le serveur Next peut journaliser une fermeture anticipée d'un flux lorsqu'une navigation de test l'annule ; aucun échec final n'est masqué.

## Préconditions avant mise en service réelle

Sauvegarde réelle restaurable et vérifiée, analyse des volumes/doublons réels, validation des tarifs et habilitations nominatives, rapprochement des cas ambigus, recette avec le groupe et autorisation de déploiement. Ces opérations réelles n'ont pas été exécutées.

Les lots déclarés en anomalie restent bloqués pour rapprochement externe ; aucun remboursement national n'est inventé. Les homonymes sans preuve d'identité et les anciens doublons annuels ne sont pas fusionnés automatiquement. Le script de reprise est restreint à la recette locale tant qu'une intervention sur une cible réelle n'est pas autorisée.

Ne sont pas revendiqués : audit exhaustif de toutes les dépendances distantes, test de charge, recette avec lecteur d'écran, CI GitHub exécutée, intégration navigateur avec une API de production ou validation par la plateforme nationale indisponible.
