# Contrats de l'API SCOUT-NDPST

Toutes les routes sont préfixées par `/api` et protégées par défaut (`AuthGuard` global). Les rôles sont vérifiés côté serveur (`@Roles`, `@EditeurContenu`) ; les contrôles de propriété (branche gérée, parent lié, scout lui-même) sont faits dans les services. Les routes `@Public()` ne renvoient que des données explicitement publiées.

- Corps et paramètres validés par Zod (`ZodPipe`) : un champ inconnu est retiré, un type invalide renvoie 400 `{ erreur }`.
- Erreurs : `{ erreur: string }` (et `code` pour `CHANGEMENT_MOT_DE_PASSE_REQUIS`).
- Pagination serveur : `?page=&limite=` (limite bornée), réponse `{ …, pagination: { page, limite, total, totalPages } }`.
- Documentation interactive : `/api/docs` si `SWAGGER_ACTIF=true`.

## Groupes de rôles (`@scout/shared`)

| Groupe | Rôles |
| --- | --- |
| `ROLES_ADMIN` | ADMINISTRATEUR |
| `ROLES_GROUPE` | CHEF_GROUPE |
| `ROLES_GROUPE_ETENDU` | CHEF_GROUPE, ADJOINT_GROUPE, ASSISTANT_GROUPE |
| `ROLES_BRANCHE` | RESPONSABLE_BRANCHE, ADJOINT_BRANCHE, ASSISTANT_BRANCHE |
| `ROLES_TOUT_STAFF` | groupe étendu + branche (maîtrise) |
| `ROLES_GESTION` | CHEF_GROUPE + branche |
| `ROLES_FINANCES` | groupe étendu |
| `ROLES_SUPERVISION` | ADMINISTRATEUR, CHEF_GROUPE |
| `@EditeurContenu()` | ADMINISTRATEUR ou compte avec `editeurContenu = true` |

## Routes

| Méthode | Chemin | Accès | Contrôleur |
| --- | --- | --- | --- |
| POST | `/api/auth/connexion` | Public() | auth.controller.ts |
| POST | `/api/auth/rafraichir` | Public() | auth.controller.ts |
| POST | `/api/auth/deconnexion` | Public() | auth.controller.ts |
| GET | `/api/auth/session` | authentifié | auth.controller.ts |
| POST | `/api/auth/changer-mot-de-passe` | authentifié | auth.controller.ts |
| POST | `/api/auth/mot-de-passe-oublie` | Public() | auth.controller.ts |
| GET | `/api/auth/reinitialiser-motdepasse` | Public() | auth.controller.ts |
| POST | `/api/auth/reinitialiser-motdepasse` | Public() | auth.controller.ts |
| GET | `/api/activites` | Roles(...ROLES_TOUT_STAFF) | activites.controller.ts |
| POST | `/api/activites` | Roles(...ROLES_TOUT_STAFF) | activites.controller.ts |
| GET | `/api/activites/:id` | Roles(...ROLES_TOUT_STAFF) | activites.controller.ts |
| PUT | `/api/activites/:id` | Roles(...ROLES_TOUT_STAFF) | activites.controller.ts |
| DELETE | `/api/activites/:id` | Roles(...ROLES_TOUT_STAFF) | activites.controller.ts |
| POST | `/api/activites/:id/autorisations` | authentifié | activites.controller.ts |
| DELETE | `/api/activites/:id/autorisations` | authentifié | activites.controller.ts |
| GET | `/api/activites/:id/presences` | Roles(...ROLES_TOUT_STAFF) | activites.controller.ts |
| POST | `/api/activites/:id/presences` | Roles(...ROLES_TOUT_STAFF) | activites.controller.ts |
| POST | `/api/public/demandes` | Public() | adhesions.controller.ts |
| GET | `/api/admin/demandes` | @Roles(...ROLES_ADMIN, ...ROLES_GROUPE_ETENDU) | adhesions.controller.ts |
| GET | `/api/admin/demandes/:id` | @Roles(...ROLES_ADMIN, ...ROLES_GROUPE_ETENDU) | adhesions.controller.ts |
| PATCH | `/api/admin/demandes/:id` | @Roles(...ROLES_ADMIN, ...ROLES_GROUPE_ETENDU) | adhesions.controller.ts |
| GET | `/api/admin/audit` | @Roles(...ROLES_SUPERVISION) | plateforme.controller.ts |
| GET | `/api/admin/rapports` | @Roles(...ROLES_SUPERVISION) | rapports.controller.ts |
| GET | `/api/admin/rapports/export` | @Roles(...ROLES_SUPERVISION) | rapports.controller.ts |
| GET | `/api/admin/utilisateurs` | @Roles(...ROLES_ADMIN) | utilisateurs.controller.ts |
| POST | `/api/admin/utilisateurs` | @Roles(...ROLES_ADMIN) | utilisateurs.controller.ts |
| GET | `/api/admin/utilisateurs/:id` | @Roles(...ROLES_ADMIN) | utilisateurs.controller.ts |
| GET | `/api/admin/utilisateurs/:id/mandats` | @Roles(...ROLES_ADMIN) | utilisateurs.controller.ts |
| PUT | `/api/admin/utilisateurs/:id` | @Roles(...ROLES_ADMIN) | utilisateurs.controller.ts |
| DELETE | `/api/admin/utilisateurs/:id` | @Roles(...ROLES_ADMIN) | utilisateurs.controller.ts |
| PUT | `/api/admin/utilisateurs/:id/password` | @Roles(...ROLES_ADMIN) | utilisateurs.controller.ts |
| GET | `/api/calendrier` | Roles(...ROLES_TOUT_STAFF) | calendrier.controller.ts |
| GET | `/api/calendrier/ics` | Public() | calendrier.controller.ts |
| POST | `/api/calendrier/token` | Roles(...ROLES_TOUT_STAFF) | calendrier.controller.ts |
| DELETE | `/api/calendrier/token` | authentifié | calendrier.controller.ts |
| GET | `/api/admin/configuration` | @Roles(...ROLES_ADMIN) | configuration.controller.ts |
| PUT | `/api/admin/configuration` | @Roles(...ROLES_ADMIN) | configuration.controller.ts |
| GET | `/api/configuration` | authentifié | configuration.controller.ts |
| GET | `/api/cotisations/statuts` | Roles(...ROLES_TOUT_STAFF) | cotisations.controller.ts |
| PUT | `/api/cotisations/statuts` | Roles(...ROLES_GROUPE) | cotisations.controller.ts |
| GET | `/api/cotisations/baremes` | Roles(...ROLES_FINANCES) | cotisations.controller.ts |
| POST | `/api/cotisations/baremes` | Roles(...ROLES_FINANCES) | cotisations.controller.ts |
| PATCH | `/api/cotisations/baremes/:id` | Roles(...ROLES_FINANCES) | cotisations.controller.ts |
| DELETE | `/api/cotisations/baremes/:id` | Roles(...ROLES_FINANCES) | cotisations.controller.ts |
| GET | `/api/cotisations` | Roles(...ROLES_TOUT_STAFF) | cotisations.controller.ts |
| POST | `/api/cotisations` | Roles(...ROLES_GROUPE) | cotisations.controller.ts |
| PUT | `/api/cotisations/:id` | Roles(...ROLES_GESTION) | cotisations.controller.ts |
| DELETE | `/api/cotisations/:id` | Roles(...ROLES_GROUPE) | cotisations.controller.ts |
| GET | `/api/documents/expirations` | Roles(...ROLES_TOUT_STAFF) | documents.controller.ts |
| POST | `/api/cron/rappels-documents` | Public() | documents.controller.ts |
| POST | `/api/upload` | authentifié | fichiers.controller.ts |
| GET | `/api/fichiers/:dossier/:fichier` | authentifié | fichiers.controller.ts |
| GET | `/api/fichiers-publics/:fichier` | Public() | fichiers.controller.ts |
| GET | `/api/admin/albums` | @EditeurContenu() | galerie.controller.ts |
| GET | `/api/admin/albums/:id` | @EditeurContenu() | galerie.controller.ts |
| POST | `/api/admin/albums` | @EditeurContenu() | galerie.controller.ts |
| PATCH | `/api/admin/albums/:id` | @EditeurContenu() | galerie.controller.ts |
| DELETE | `/api/admin/albums/:id` | @EditeurContenu() | galerie.controller.ts |
| POST | `/api/admin/albums/:id/medias` | @EditeurContenu() | galerie.controller.ts |
| PATCH | `/api/admin/medias/:id` | @EditeurContenu() | galerie.controller.ts |
| DELETE | `/api/admin/medias/:id` | @EditeurContenu() | galerie.controller.ts |
| GET | `/api/public/galerie` | @Public() | galerie.controller.ts |
| GET | `/api/public/galerie/medias/:id` | @Public() | galerie.controller.ts |
| GET | `/api/public/galerie/:slug` | @Public() | galerie.controller.ts |
| GET | `/api/admin/histoire` | @EditeurContenu() | histoire.controller.ts |
| POST | `/api/admin/histoire` | @EditeurContenu() | histoire.controller.ts |
| PATCH | `/api/admin/histoire/:id` | @EditeurContenu() | histoire.controller.ts |
| DELETE | `/api/admin/histoire/:id` | @EditeurContenu() | histoire.controller.ts |
| GET | `/api/public/histoire` | @Public() | histoire.controller.ts |
| POST | `/api/cron/purge` | Public() | maintenance.controller.ts |
| GET | `/api/me` | authentifié | profil.controller.ts |
| PUT | `/api/me` | authentifié | profil.controller.ts |
| GET | `/api/me/branche` | authentifié | profil.controller.ts |
| PUT | `/api/me/password` | authentifié | profil.controller.ts |
| GET | `/api/mes-enfants` | authentifié | profil.controller.ts |
| POST | `/api/mes-enfants/:scoutId/consentement-image` | authentifié | profil.controller.ts |
| POST | `/api/mes-enfants/:scoutId/consentement-sante` | authentifié | profil.controller.ts |
| GET | `/api/ma-progression` | authentifié | profil.controller.ts |
| GET | `/api/programmes` | Roles(...ROLES_LECTURE) | programmes.controller.ts |
| POST | `/api/programmes` | Roles(...ROLES_GESTION) | programmes.controller.ts |
| GET | `/api/programmes/:id` | Roles(...ROLES_LECTURE) | programmes.controller.ts |
| PATCH | `/api/programmes/:id` | Roles(...ROLES_GESTION) | programmes.controller.ts |
| DELETE | `/api/programmes/:id` | Roles(...ROLES_GESTION) | programmes.controller.ts |
| POST | `/api/programmes/:id/lignes` | Roles(...ROLES_GESTION) | programmes.controller.ts |
| PATCH | `/api/programmes/:id/lignes/:ligneId` | Roles(...ROLES_GESTION) | programmes.controller.ts |
| DELETE | `/api/programmes/:id/lignes/:ligneId` | Roles(...ROLES_GESTION) | programmes.controller.ts |
| GET | `/api/admin/publications` | @EditeurContenu() | publications.controller.ts |
| GET | `/api/admin/publications/:id` | @EditeurContenu() | publications.controller.ts |
| POST | `/api/admin/publications` | @EditeurContenu() | publications.controller.ts |
| PATCH | `/api/admin/publications/:id` | @EditeurContenu() | publications.controller.ts |
| POST | `/api/admin/publications/:id/publier` | @EditeurContenu() | publications.controller.ts |
| POST | `/api/admin/publications/:id/depublier` | @EditeurContenu() | publications.controller.ts |
| POST | `/api/admin/publications/:id/archiver` | @EditeurContenu() | publications.controller.ts |
| DELETE | `/api/admin/publications/:id` | @EditeurContenu() | publications.controller.ts |
| GET | `/api/admin/categories` | @EditeurContenu() | publications.controller.ts |
| POST | `/api/admin/categories` | @EditeurContenu() | publications.controller.ts |
| PATCH | `/api/admin/categories/:id` | @EditeurContenu() | publications.controller.ts |
| DELETE | `/api/admin/categories/:id` | @EditeurContenu() | publications.controller.ts |
| GET | `/api/public/publications` | @Public() | publications.controller.ts |
| GET | `/api/public/publications/:slug` | @Public() | publications.controller.ts |
| GET | `/api/public/categories` | @Public() | publications.controller.ts |
| GET | `/api/reunions/config` | Roles(...ROLES_TOUT_STAFF) | reunions.controller.ts |
| PUT | `/api/reunions/config` | Roles(...ROLES_GROUPE) | reunions.controller.ts |
| GET | `/api/reunions` | Roles(...ROLES_TOUT_STAFF) | reunions.controller.ts |
| POST | `/api/reunions` | Roles(...ROLES_GESTION) | reunions.controller.ts |
| GET | `/api/reunions/:id` | Roles(...ROLES_TOUT_STAFF) | reunions.controller.ts |
| PATCH | `/api/reunions/:id` | Roles(...ROLES_GESTION) | reunions.controller.ts |
| DELETE | `/api/reunions/:id` | Roles(...ROLES_GESTION) | reunions.controller.ts |
| GET | `/api/reunions/:id/presences` | Roles(...ROLES_TOUT_STAFF) | reunions.controller.ts |
| POST | `/api/reunions/:id/presences` | Roles(...ROLES_TOUT_STAFF) | reunions.controller.ts |
| GET | `/api/reunions/:id/presences/export` | Roles(...ROLES_TOUT_STAFF) | reunions.controller.ts |
| GET | `/api/branches` | Roles(...ROLES_TOUT_STAFF) | branches.controller.ts |
| GET | `/api/equipes` | Roles(...ROLES_TOUT_STAFF) | equipes.controller.ts |
| POST | `/api/equipes` | Roles(...ROLES_GROUPE, ...ROLES_BRANCHE_GESTION_EQUIPES) | equipes.controller.ts |
| PATCH | `/api/equipes/:id` | Roles(...ROLES_GROUPE, ...ROLES_BRANCHE_GESTION_EQUIPES) | equipes.controller.ts |
| GET | `/api/scouts` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| POST | `/api/scouts` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| POST | `/api/scouts/import` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| GET | `/api/scouts/doublons` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| GET | `/api/scouts/passage-branche` | Roles(...ROLES_GROUPE) | scouts.controller.ts |
| POST | `/api/scouts/passage-branche` | Roles(...ROLES_GROUPE) | scouts.controller.ts |
| GET | `/api/scouts/:id` | authentifié | scouts.controller.ts |
| PUT | `/api/scouts/:id` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| POST | `/api/scouts/:id/compte` | Roles(...ROLES_GROUPE_ETENDU) | scouts.controller.ts |
| PUT | `/api/scouts/:id/matricule` | Roles(...ROLES_GROUPE_ETENDU) | scouts.controller.ts |
| POST | `/api/scouts/:id/contacts` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| PUT | `/api/scouts/:id/contacts/:contactId` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| DELETE | `/api/scouts/:id/contacts/:contactId` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| POST | `/api/scouts/:id/documents` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| DELETE | `/api/scouts/:id/documents/:documentId` | Roles(...ROLES_TOUT_STAFF) | scouts.controller.ts |
| GET | `/api/scouts/:id/progressions` | Roles(...ROLES_BRANCHE) | scouts.controller.ts |
| POST | `/api/scouts/:id/progressions` | Roles(...ROLES_BRANCHE) | scouts.controller.ts |
| GET | `/api/public/identite` | @Public() | site-public.controller.ts |
| GET | `/api/public/accueil` | @Public() | site-public.controller.ts |
| GET | `/api/public/branches` | @Public() | site-public.controller.ts |
| GET | `/api/public/branches/:slug` | @Public() | site-public.controller.ts |
| GET | `/api/public/equipe` | @Public() | site-public.controller.ts |
| GET | `/api/public/activites` | @Public() | site-public.controller.ts |
| GET | `/api/admin/branches` | @EditeurContenu() | site-public.controller.ts |
| PATCH | `/api/admin/branches/:type` | @EditeurContenu() | site-public.controller.ts |
| GET | `/api/tableau-de-bord` | Roles(...ROLES_TABLEAU) | tableau-de-bord.controller.ts |
| GET | `/api/rapports` | Roles(...ROLES_GROUPE, ...ROLES_ADMIN) | tableau-de-bord.controller.ts |
| GET | `/api/utilisateurs` | @Roles(...ROLES_GROUPE) | utilisateurs.controller.ts |
| GET | `/api/utilisateurs/maitrise` | Roles(...ROLES_TOUT_STAFF) | utilisateurs.controller.ts |
| POST | `/api/utilisateurs` | @Roles(...ROLES_GROUPE) | utilisateurs.controller.ts |
| GET | `/api/utilisateurs/:id` | @Roles(...ROLES_GROUPE) | utilisateurs.controller.ts |
| GET | `/api/utilisateurs/:id/mandats` | @Roles(...ROLES_GROUPE) | utilisateurs.controller.ts |
| PUT | `/api/utilisateurs/:id` | @Roles(...ROLES_GROUPE) | utilisateurs.controller.ts |
| PATCH | `/api/utilisateurs/:id/profil-public` | Roles(...ROLES_GROUPE, ...ROLES_ADMIN) | utilisateurs.controller.ts |
| DELETE | `/api/utilisateurs/:id` | @Roles(...ROLES_GROUPE) | utilisateurs.controller.ts |
| PUT | `/api/utilisateurs/:id/password` | @Roles(...ROLES_GROUPE) | utilisateurs.controller.ts |
| GET | `/api/sante` | Public() | sante.controller.ts || GET | `/api/progression/referentiel` | Roles(...ROLES_TOUT_STAFF) | progression.controller.ts |
| GET | `/api/progression/synthese` | Roles(...ROLES_TOUT_STAFF) | progression.controller.ts |
| POST | `/api/progression/referentiel` | CHEF_GROUPE, ou responsable/adjoint de la branche | progression.controller.ts |
| PATCH | `/api/progression/referentiel/:id` | idem | progression.controller.ts |
| DELETE | `/api/progression/referentiel/:id` | idem (refusé si l'étape a été validée) | progression.controller.ts |

## Routes supprimées par la simplification mono-paroissiale

`/api/admin/paroisses*`, `/api/admin/districts*`, `/api/district/*`, `/api/paroisse`, `/api/admin/site-config`, `/api/public/logo`, `/api/dashboard/kpis` (remplacée par `/api/tableau-de-bord`), `PUT /api/admin/utilisateurs/:id/nominations`.

## Espaces familles

Tant que `ESPACES_FAMILLES_ACTIFS` vaut `false` (`packages/shared/src/perimetre.ts`), le proxy du frontend renvoie 404 pour `/api/mes-enfants*`, `/api/ma-progression`, `/api/scouts/:id/compte` et `/api/cron/rappels-documents`.

## Interconnexion future

Aucune dépendance vers une plateforme district ou régionale. Une éventuelle interconnexion devra être conçue et autorisée séparément (identifiants stables `cuid`, exports CSV contrôlés via `/api/admin/rapports/export`, contrats ci-dessus).
