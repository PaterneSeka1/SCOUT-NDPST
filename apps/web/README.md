# Frontend SCOUT-NDPST

Application Next.js (App Router) de la plateforme paroissiale :

- `app/(public)` : site public (accueil, histoire, branches, actualités, activités, galerie, équipe, nous rejoindre, contact) ;
- `app/(auth)` : connexion et mots de passe ;
- `app/(private)/dashboard` : espace de gestion du groupe ;
- `app/(private)/admin` : administration (comptes, configuration, contenus, demandes, audit) ;
- `components/ui` : design system ; `components/layout`, `components/public`, `components/admin` ; `lib/navigation.ts` (rubriques par rôle).

Aucun accès direct à la base : toutes les requêtes `/api/*` sont relayées vers `apps/api`, qui vérifie chaque droit. Voir le [README du dépôt](../../README.md).
