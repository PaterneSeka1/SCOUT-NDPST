# Audit initial — 25 octobre 2026

Branche de travail : `feat/adhesions-2026-2027`. Audit statique du code, sans connexion à une base réelle. Aucun volume ni sauvegarde de production vérifié.

## Architecture et parcours constatés

Monorepo npm : API NestJS 11, Prisma 7/PostgreSQL, Next.js 16 App Router, React 19, package partagé Zod 4. Les contrôleurs passent par AuthGuard puis RolesGuard, les hooks utilisent TanStack Query et un proxy API Next.js. L'installation est mono-paroissiale depuis `20261024100000_mono_paroisse`; les anciennes migrations district doivent rester pour rejouer l'historique, aucun CRUD district/paroisse ne doit revenir.

| Fichier / domaine | Comportement actuel | Conséquence / risque | Correction et dépendances |
| --- | --- | --- | --- |
| `apps/api/prisma/schema.prisma`, Cotisation | Scout obligatoire, un montantPaye cumulatif mutable | Chefs exclus, paiements successifs perdus ; critique | Module annuel indépendant, identité commune et écritures immuables ; migration additive |
| `modules/cotisations/cotisations.service.ts`, definirStatut | PAYEE/EXONEREE suffit pour « cotisant », bascule remet le montant à zéro | Confusion local/national et perte de signification comptable ; critique | Isoler le nouveau circuit ; ancienne interface doit annoncer un suivi local historique |
| même fichier, creer/supprimer | Plusieurs lignes annuelles possibles, suppression physique possible | Doublons et destruction de données ; élevé | Conserver les archives ; unicité personne/année et annulations dans le nouveau module |
| `BaremeCotisation` | Année/type/branche, sans catégorie ni validité | Tarif chef impossible ; élevé | Barème annuel catégorisé, montant figé sur l'adhésion |
| `Scout.utilisateurId`, matricules uniques séparément | Lien explicite optionnel ; pas d'identité transversale | Double paiement scout/chef ; critique | Identité commune, réutiliser lien et matricule, refuser rapprochement ambigu sans fusion automatique |
| `modules/utilisateurs/mandats.ts` | Tout changement clôt tous les mandats ; index Mandat_actif_utilisateur_key | Cumul impossible ; élevé | Index par fonction/périmètre ; attribution/clôture individuelle et compatibilité poste principal |
| `common/guards/roles.guard.ts`, `types.ts` | Rôle unique en session | Mandats ignorés ; élevé | Permissions financières explicites et périmètre contrôlé sur chaque ressource |
| `common/perimetre.service.ts` | Une branche du compte | Plusieurs branches non représentées ; élevé | Ajouter résolution des mandats actifs sans élargir implicitement les anciens services |
| `auth/auth.service.ts`, `auth.guard.ts` | Cookies httpOnly, sessions persistées, rotation, compte relu à chaque requête | Bonne base ; mandat/habilitation absent de la session | Enrichir la session depuis la base, aucune autorité accordée à un contexte client |
| `common/audit.service.ts` | Écriture après opération, erreur volontairement absorbée | Finance possible sans journal ; critique | Journal financier dans la même transaction, échec bloquant |
| `modules/tableau-de-bord/indicateurs.service.ts`, `hooks/useDashboard.ts` | Profils et agrégats par rôle principal | Pas de synthèse nationale ni contexte multiple | Synthèse du nouveau module et espaces explicitement autorisés |
| `lib/navigation.ts`, `lib/session-types.ts` | Visibilité par rôle unique | Espaces secondaires absents | Navigation adaptée aux nouveaux droits, serveur toujours autoritaire |
| `components/ui/*`, pages privées | Tableaux, pagination, modales, toasts déjà disponibles | Réutilisables | Ajouter parcours adhésion/encaissement/lot ; conserver les cotisations d'activité |
| `test/*`, `e2e/*`, shared tests | Vitest, HTTP simulé, PostgreSQL dédié et Playwright | Un test mock ne prouve pas la concurrence SQL | Tests métier + transactions réelles sur base jetable ; rapport exact des exécutions |
| `scripts/sauvegarder-base.ts` | Dump chiffré R2, contrôle taille et empreinte à restauration | Non exécuté ici, restauration non prouvée | Sauvegarde et restauration isolée obligatoires avant reprise réelle |

## Décisions et risques à traiter

1. Un paiement local ne confirme jamais le national. Trois axes séparés : solde local calculé, état du lot, confirmations nationales explicites.
2. FCFA entiers positifs, plafond PostgreSQL, verrouillage de la ligne adhésion et idempotence de l'encaissement. Aucune modification/suppression d'une écriture.
3. Pas de permission financière implicite pour un administrateur ni un chef : habilitations nominatives et périmètre facultatif de branche. L'administration technique attribue les habilitations avec motif et audit.
4. Reprise historique distincte et contrôlée : aucune PAYEE convertie en confirmation. Cas ambigus marqués À vérifier, anciennes lignes conservées.
5. La sauvegarde distante et toute migration réelle restent des opérations d'exploitation non exécutées. La recette exige une base synthétique dédiée.
