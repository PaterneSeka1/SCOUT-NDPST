# Migration des routes Next.js vers l'API NestJS

Consignes communes à chaque domaine migré de `apps/web-paroisse/app/api/**` vers `apps/api/src/modules/<domaine>/`.

## Principe

Le frontend relaie `/api/*` vers l'API NestJS en repli (`next.config.ts`, `rewrites.fallback`) : une route encore présente dans `app/api/` reste prioritaire, et chaque route supprimée bascule automatiquement vers l'API. Migrer un domaine consiste donc à :

1. réimplémenter chaque route dans un module NestJS **avec le même chemin, la même méthode HTTP, les mêmes paramètres et la même forme de réponse** (le frontend ne doit pas changer) ;
2. supprimer les fichiers `route.ts` correspondants dans `apps/web-paroisse/app/api/`.

Seule différence de contrat assumée : les erreurs ont toujours la forme `{ erreur: string }` (certaines routes Next renvoyaient `{ error }`).

## Briques disponibles dans l'API

| Besoin | Brique |
| --- | --- |
| Accès base | `PrismaService` (`src/prisma/prisma.service.ts`), types Prisma depuis `src/generated/prisma/client` |
| Utilisateur courant | `@UtilisateurCourant() utilisateur: UtilisateurSession` (`src/common/decorators/utilisateur-courant.decorator.ts`) |
| Contrôle de rôle | `@Roles(...ROLES_TOUT_STAFF)` (rôle paroissial) et `@RolesDistrict(...)` (affectation district), groupes importés de `@scout/shared` |
| Route publique | `@Public()` — toute route est protégée par défaut ; chaque usage est justifié en commentaire |
| Paroisse de l'utilisateur | `paroisseIdRequise(utilisateur)` (`src/common/paroisse.ts`) |
| Branche gérée, paroisses d'un district | `PerimetreService` (`brancheUtilisateur`, `brancheDistrictUtilisateur`, `paroissesDuDistrict`, `paroissesParDistrict`) |
| Journal d'audit | `AuditService.enregistrer({ paroisseId, acteurId, action, entite, entiteId, details })` |
| Fermer les sessions d'un compte | `AuthService.revoquerToutes(utilisateurId)` — à appeler après un changement de mot de passe ou une désactivation de compte |
| Validation | Contrôles existants (`estValeurEnum`, `entierBorne`, `estCheminLocalValide`… de `@scout/shared`) ou `ZodPipe` |
| Utilitaires serveur | `src/common/lib/` : `logger`, `rateLimit` (`limiterTaux`), `email`, `notifications`, `storage`, `fileSignature`, `csv`, `calendrier` |

`PrismaService`, `AuditService`, `PerimetreService` et `AuthService` sont fournis par des modules globaux : il suffit de les injecter.

## Règles

- Contrôleur mince, logique métier et contrôles de propriété (paroisse, branche) dans un service.
- Erreurs : `BadRequestException('message')`, `NotFoundException`, `ForbiddenException`, `ConflictException`… Pour un corps enrichi : `new BadRequestException({ erreur, details })`. Le filtre global met tout au format `{ erreur }`.
- Statut HTTP : reproduire celui de la route Next (`@HttpCode(200)` sur un `POST` qui renvoyait 200, `@HttpCode(201)` sinon).
- Réponses non JSON (CSV, iCal, fichiers) : `@Res() reponse: Response` (Express), en-têtes identiques à la route Next.
- Envoi de fichiers : `FileInterceptor` de `@nestjs/platform-express` (stockage mémoire, limite de taille), mêmes noms de champs que le `formData` d'origine, vérification par signature (`detecterTypeFichier`).
- Jamais de corps de requête brut passé à Prisma : correspondance explicite des champs.
- Ne modifier ni `src/app.module.ts`, ni `src/common/**`, ni `src/auth/**`, ni `packages/shared/**`. Un manque dans ces zones est signalé dans le compte rendu.
- Commentaires en français, au même niveau de détail que le code d'origine (les justifications de sécurité sont conservées).
