# Développer dans l'API NestJS

Consignes pour ajouter ou modifier un domaine dans `apps/api/src/modules/<domaine>/`. Le frontend (`apps/web`) n'accède jamais à la base : il relaie `/api/*` vers l'API (`next.config.ts`, `rewrites.fallback`).

## Briques disponibles

| Besoin | Brique |
| --- | --- |
| Accès base | `PrismaService` (`src/prisma/prisma.service.ts`), types Prisma depuis `src/generated/prisma/client` |
| Utilisateur courant | `@UtilisateurCourant() utilisateur: UtilisateurSession` (`id`, `role`, `editeurContenu`…) |
| Contrôle de rôle | `@Roles(...ROLES_TOUT_STAFF)`, groupes importés de `@scout/shared` (voir `docs/contrats-api.md`) |
| Contenus publics | `@EditeurContenu()` : administrateur ou compte avec `editeurContenu` |
| Route publique | `@Public()` — toute route est protégée par défaut ; chaque usage est justifié en commentaire et ne renvoie que des données publiées |
| Branche gérée | `PerimetreService.brancheUtilisateur(id)` |
| Identité de la paroisse | `ConfigurationService` (module global) : `lire()`, `identitePublique()` |
| Journal d'audit | `AuditService.enregistrer({ acteurId, action, entite, entiteId, details })` ; ajouter le libellé dans `packages/shared/src/audit-labels.ts` |
| Fermer les sessions d'un compte | `AuthService.revoquerToutes(utilisateurId, tx?)` après changement de rôle, de mot de passe ou désactivation |
| Validation | `ZodPipe(Schema)` ; briques `common/lib/schemas-contenus.ts` (`texteFacultatif`, `texteRequis`, `urlImagePublique`, `dateFacultative`) |
| Pagination | `common/lib/pagination.ts` (`lirePagination`, `metaPagination`, `texteRequete`) |
| Slugs | `common/lib/slug.ts` (`slugUnique`) |
| Fichiers | `/api/upload` (visibilité `privee`, `publique`, `galerie`), `AccesFichiersService` pour les droits de lecture et le rattachement |
| Utilitaires serveur | `common/lib/` : `logger`, `rateLimit`, `email`, `notifications`, `storage`, `fileSignature`, `csv`, `calendrier` |

`PrismaService`, `AuditService`, `PerimetreService`, `AccesFichiersService`, `ConfigurationService` et `AuthService` sont fournis par des modules globaux : il suffit de les injecter.

## Règles

- Une seule paroisse : aucune clé `paroisseId`, aucun filtre ou sélecteur de paroisse. Le cloisonnement se fait par rôle, branche gérée et propriété (parent lié, scout lui-même).
- Contrôleur mince, logique métier et contrôles de propriété dans un service.
- Jamais de corps de requête brut passé à Prisma : schéma Zod, puis correspondance explicite des champs.
- Erreurs : exceptions Nest (`BadRequestException`, `NotFoundException`, `ForbiddenException`, `ConflictException`…) ; le filtre global renvoie `{ erreur }`. Traduire `P2002` en 409 avec un message compréhensible.
- Données de mineurs : ne jamais exposer une donnée de scout sur une route publique ; une photo n'est publique qu'après publication explicite et, pour des mineurs, vérification des consentements (`mediaVisiblePublic`).
- Toute action sensible est journalisée.
- Tests Vitest à côté du service (`*.test.ts`, Prisma simulé) ; règles dépendant de PostgreSQL dans `test/postgres-*.integration.ts`.
- Schéma : voir le README (section migrations) — jamais de `prisma migrate dev` ni `migrate reset` sur une base à conserver.
- Commentaires en français.
