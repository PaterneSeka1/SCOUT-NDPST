# Refonte UX/UI — octobre 2026

Branche `feature/refonte-ux-ui-premium`, créée depuis `main` (`280c3d3`). Aucun push, merge ou migration. Les dépôts `suivi-pedagogique-cmg` et `suivi-pedagogique-cmg-backend` ont été consultés en lecture seule.

## 1. Audit comparatif

| | SCOUT-NDPST | suivi-pedagogique-cmg (+ backend) |
| --- | --- | --- |
| Périmètre | Un groupe paroissial, six branches (Oisillons → Ressources adultes) | Branche Route seule, à l’échelle de la région (région › district › paroisse › communauté) |
| Stack | Next.js 16 / React 19 / Tailwind 4, NestJS + Prisma | Identique côté front ; NestJS 11 + Prisma 6, RBAC en base |
| Progression | Référentiel d’étapes par branche, saisi par le groupe ; validation sur la fiche scout | Étapes figées (Noviciat → Départ routier), workflow proposé/validé, insignes, matrice âge/étape |
| Design | Charte du logo (forêt, terracotta), Fraunces + Source Sans 3 | Tokens « route » (bleu roi, rouge, violet), mêmes polices |

Repris de la référence : le principe de tokens par identité (ici `--color-branche-*`), le parcours par étapes affiché comme une suite numérotée, les états toujours accompagnés d’un libellé et d’une icône. Écarté comme hors périmètre : districts, régions, rôles régional/commissaire, tableaux par district, multi-paroisses. Le référentiel de progression existant de SCOUT-NDPST est conservé : il respecte déjà la pédagogie propre à chaque branche sans imposer un contenu non vérifié.

## 2. Inventaire des routes

**Public** : `/`, `/notre-histoire`, `/notre-equipe` *(créée)*, `/nos-branches`, `/nos-branches/[slug]`, `/activites`, `/actualites`, `/actualites/[slug]`, `/galerie`, `/galerie/[slug]`, `/nous-rejoindre` *(créée)*, `/confidentialite` *(créée)*, `/contact` → redirection permanente vers `/nous-rejoindre?objet=contact`.

**Authentification** : `/connexion`, `/changer-mot-de-passe`, `/mot-de-passe-oublie`, `/reinitialiser-motdepasse` (`/login` → `/connexion`).

**Gestion** (`/dashboard/…`) : tableau de bord, `calendrier` *(créée)*, `scouts` (+ fiche, carte, modifier, nouveau, importer), `branches` (+ passage), `ma-branche`, `maitrise` *(créée)*, `equipes` *(créée)*, `utilisateurs` (+ fiche, modifier, nouveau), `reunions` (+ nouveau, présences), `activites` (+ fiche, modifier, présences, nouvelle), `presences`, `programmes` (+ fiche, nouveau), `progression` *(créée)*, `cotisations`, `documents`, `rapports`, `profil`. Fermées par le périmètre (espaces familles) : `parents`, `mes-enfants`, `ma-progression`.

**Administration** (`/admin/…`) : `utilisateurs` *(créée, + `nouveau` → fenêtre de création)*, `configuration` *(créée)*, `publications`, `galerie`, `histoire`, `branches`, `demandes`, `audit`.

## 3. Diagnostic initial

Problèmes constatés dans le code et par captures (Playwright, 375/768/1366/1920 px) :

1. **Liens morts** : 14 cibles internes sans page — publiques (`/nous-rejoindre`, `/notre-equipe`, `/contact`, `/confidentialite`) et privées (`/dashboard/maitrise|equipes|progression|calendrier|paroisse`, `/admin/utilisateurs|configuration|parametres`). Les API correspondantes existaient.
2. **Connexion impossible par l’interface** : la page exigeait `utilisateur.paroisseId`, supprimé par la refonte mono-paroissiale ; tout compte était refusé puis déconnecté.
3. **Tableau de bord en erreur pour tous** : appel à `/api/dashboard/kpis` (inexistant) au lieu de `/api/tableau-de-bord`.
4. **Profil public impossible à alimenter** : aucune interface pour `PATCH /utilisateurs/:id/profil-public`, donc page « La maîtrise » toujours vide.
5. **Navbar** (capture `/galerie`) : 7 liens + 2 actions, libellés sur deux lignes à 1366 px, nom du groupe tronqué.
6. **Composition répétitive** : même bandeau centré beige à pois sur chaque page, puis section vide ; galerie vide = grand bandeau + petit message.
7. **Accueil** : six cartes de branches identiques sans image (icône sur aplat).
8. **Requêtes parasites** : `/api/auth/session` (401) à chaque visite anonyme, `/api/public/logo` (404) sur les pages d’authentification.
9. **Débordement** : tableau des activités +135 px à 1366 px (élément `sr-only` positionné hors du conteneur défilant).
10. **Tests e2e obsolètes** : configuration Playwright pointant vers `apps/web-paroisse` et `apps/web-district`, supprimées.

Éléments étrangers à l’application, laissés tels quels : le « N » (indicateur de Next.js en développement), le logo « palmier » (React Query Devtools, développement uniquement) et, sur la capture fournie, les extensions du navigateur.

## 4. Architecture de navigation

| Rubrique | Contenu | Justification |
| --- | --- | --- |
| Le groupe ▾ | Notre histoire, La maîtrise | Découvrir qui porte le groupe (parents, paroissiens) |
| Nos branches | Échelle des âges puis présentation par branche | Question n° 1 d’une famille : « quelle branche pour mon enfant ? » |
| Activités ▾ | Agenda, Actualités | Contenus datés, même intention de lecture |
| Galerie | Albums | Rubrique visuelle autonome |
| **Nous rejoindre** (action) | Inscrire un jeune, Devenir chef, Demander une information, Contacter le groupe | Regroupe adhésion et contact (même API `POST /public/demandes`) ; supprime le doublon Contact/Nous rejoindre |
| Espace membres (discret) | Connexion | Accès secondaire, ne concurrence pas l’adhésion |

En-tête `sticky` (hauteur portée par `--hauteur-entete`, réutilisée pour `scroll-padding` et les ancres), transparent seulement sur la photo d’accueil. Regroupements : bouton de divulgation (`aria-expanded`), fermeture par Échap, clic extérieur ou perte du focus. Mobile : menu plein écran (dialog natif), rubriques regroupées, actions en pied.

## 5. Direction artistique « Carnet de route »

Une organisation historique, vivante et active : la carte, le sentier, le fanion.

- **Typographie** : Fraunces (titres éditoriaux, axe `opsz`), Source Sans 3 (interface et lecture), Barlow Condensed (signalétique : surtitres, dates, âges, chiffres — classes `.signal`, `.chiffre-signal`). Titres très grands réservés aux ouvertures (accueil, histoire).
- **Couleurs** : couleurs institutionnelles configurables (`--cp`, `--ca`, `--cf`, `--ch`) ; papier `#f6f3ec` et encres `encre / encre-douce / encre-pale` (AA vérifié, ≥ 4,5:1 sur papier et papier foncé) ; lignes `ligne / ligne-forte`.
- **Branches** : palette catégorielle validée par script (séparation en daltonisme et en vision normale, plancher de chroma) : `#c99a10 #a63f18 #55a060 #24539a #8e2f62 #00949e`. Pour le texte, variantes « encre » de contraste AA (`--color-encre-*`). La couleur n’est jamais seule : le nom de la branche l’accompagne toujours.
- **Motif** : courbes de niveau (`.motif-topo`, `.motif-topo-clair`), à 5–8 % d’opacité, réservées aux ouvertures, au pied de page et aux états vides. Le motif à pois est neutralisé.
- **Composition** : grille 12 colonnes, sections contrastées papier / forêt, mises en page asymétriques (texte + panneau), listes éditoriales plutôt que cartes identiques, rayons réduits (`rounded-lg`), ombres légères. Animations limitées à une apparition d’ouverture et aux survols, désactivées par `prefers-reduced-motion`.

## 6. Design system

| Élément | Emplacement |
| --- | --- |
| Tokens (surfaces, encres, branches, motif, ombres) | `apps/web/app/globals.css` |
| Accents de branche | `apps/web/lib/branches-visuel.ts` (`accentBranche`, `encreBranche`, `styleAccent`) |
| Navigation publique | `apps/web/lib/navigation-publique.ts` |
| Site public | `components/public/` : `EnTetePage`, `Section`, `TitreSection`, `EnTeteSection`, `Cartes` (article, activité, branche, membre, album, pagination, liens), `ImagePublique` (repli sur échec), `EtatVidePublic`, `ParcoursBranches`, `parcours.ts` |
| Espace privé | `components/ui/` existant (DataTable, Modal/Drawer, Field, Tabs, Badge…) + `components/dashboard/Blocs.tsx` ; `DataTable` gagne les seuils `xl`/`2xl` et un conteneur positionné ; `CHAMP` est exporté |

## 7. Pages modifiées ou créées

- **Accueil** : photo plein cadre + repères réels (fondation, nombre de branches) ; « Le groupe » (message + panneau 1956 et jalons) ; parcours des branches ; agenda et actualités côte à côte ; valeurs en liste numérotée sur fond forêt ; galerie ; maîtrise ; parcours d’adhésion directement cliquables.
- **Notre histoire** : ouverture forêt avec l’année en grand, sentier chronologique par décennie, témoignages en citations, mentions « À confirmer par les archives » conservées, appel à partager des souvenirs.
- **Nos branches** : échelle des âges, puis une présentation par branche (photo alternée si publiée, sinon bandeau compact avec l’âge en grand). **Fiche branche** : bandeau teinté, contenu pédagogique en lignes titrées, encadrement et inscription en colonne latérale.
- **La maîtrise** (`/notre-equipe`) : direction puis branches, portraits ou monogrammes teintés, filtre par branche (liens, sans JavaScript).
- **Agenda** : regroupement par mois (intertitres collants), onglets à venir / passées. **Actualités** : article à la une, grille éditoriale, recherche et catégories conservées.
- **Galerie** : album à la une + mosaïque, compteur, état vide compact avec liens vers l’agenda et les actualités, note sur les autorisations. Aucun contenu fictif, aucune action d’administration.
- **Nous rejoindre** : quatre parcours (liens `?objet=`), formulaire réduit au parcours choisi, étapes du traitement, coordonnées. **Données personnelles** : texte factuel aligné sur le fonctionnement réel (à faire valider, voir § 12).
- **Connexion** : deux volets, erreurs dans la page (`role="alert"`), retour au site.
- **Shell privé** : nom complet du groupe, recherche globale, menu du compte, état actif lisible.
- **Tableau de bord** : par profil — à traiter (alertes triées par gravité), indicateurs réels, prochaines activités et réunions, effectifs par branche (barres étiquetées), cotisations, présences 30 j, évolution sur 12 mois (+ tableau accessible) ; administrateur : comptes par rôle, journal, état des services.
- **Créées** : maîtrise (organigramme + éditeur de profil public avec portrait), équipes, progression (synthèse par branche + parcours d’étapes éditable selon les droits), calendrier (mois, liste, abonnement iCal), comptes administrateur, identité et configuration (contrôle de contraste des couleurs).
- **Harmonisées** : gris froids → gris chauds de la charte dans tous les écrans privés et d’authentification ; liste « Comptes de la maîtrise » reprise sur `DataTable`.

## 8. Évolutions fonctionnelles et backend

- Backend : `GET /api/public/equipe` (et listes de membres publics) expose désormais `brancheType` (ajout non cassant, test ajouté). Aucune migration Prisma.
- Frontend : correction de la connexion, du tableau de bord, du logo et de la session anonyme ; nouvelles pages branchées sur les routes API existantes ; redirection `/contact`.

## 9. Matrice des rôles (interface ; l’API revérifie chaque appel)

| Rubrique | Admin | Chef de groupe | Adjoint / assistant de groupe | Encadrement de branche |
| --- | --- | --- | --- | --- |
| Tableau de bord | profil ADMIN | DIRECTION | EQUIPE_GROUPE | BRANCHE (sa branche) |
| Scouts, réunions, activités, présences, programmes, cotisations, documents, calendrier, maîtrise (lecture), équipes (lecture), progression (lecture) | — | ✓ | ✓ | ✓ (sa branche) |
| Profil public de la maîtrise | API ✓ | ✓ | — | — |
| Équipes (écriture) | — | ✓ | — | Responsable / adjoint, sa branche |
| Référentiel de progression (écriture) | — | ✓ | — | Responsable / adjoint, sa branche |
| Comptes de la maîtrise | — | ✓ | — | — |
| Rapports | ✓ | ✓ | — | — |
| Comptes (tous rôles), identité et configuration | ✓ | — | — | — |
| Contenus publics (publications, galerie, histoire, branches) | permission `editeurContenu` | | | |
| Demandes d’adhésion | ✓ | ✓ | ✓ | — |
| Journal d’audit | ✓ | ✓ | — | — |

## 10. Vérifications

| Contrôle | Résultat |
| --- | --- |
| `tsc --noEmit` (web) | Réussi |
| ESLint `--max-warnings 0` (web) | Réussi |
| Vitest web | 18 tests réussis (dont 5 du nouveau contrat de tableau de bord) |
| Vitest API `site-public` | 4 tests réussis |
| Captures automatiques publiques (11 routes × 375/768/1366/1920) | 0 erreur HTTP, 0 débordement, 0 erreur console, 0 lien de navigation sur deux lignes, 0 nom tronqué |
| Captures privées (23 routes, rôles chef de groupe, responsable de branche, administrateur) | 0 page en 404 ; débordement des activités corrigé ; libellés tronqués corrigés |
| Parcours réel profil public → page « La maîtrise » | Vérifié sur la base locale de démonstration, puis état restauré |
| Connexion réelle par l’interface | Vérifiée (succès → `/dashboard`, échec → message) |
| Build de production `apps/web` (Webpack) | Réussi, toutes les routes compilées (dont les 8 nouvelles). Sous WSL, Node n’atteint Google Fonts qu’avec `NODE_OPTIONS=--dns-result-order=ipv4first` (problème réseau de l’environnement, Source Sans 3 comprise) |
| Captures sur le serveur de production (11 routes publiques × 4 largeurs, 10 routes privées × 2 largeurs) | Aucun débordement, aucune erreur HTTP ni console ; troncatures mobiles des tableaux corrigées |
| Playwright (suite réécrite, bureau + mobile, `--workers=1`) | 28 réussis, 2 ignorés par conception (scénarios propres au bureau ou au mobile) |
| Vitest `@scout/shared` et `@scout/api` (suites complètes) | 59 et 542 tests réussis |

Non exécutés : Lighthouse (installation impossible dans l’environnement : téléchargement npm bloqué ; aucun score n’est avancé), audit automatique axe, lecteur d’écran manuel, tests sur données réelles.

## 11. Captures

Dans `docs/captures/refonte-ux/` (Chromium headless ; « avant » sur `main`, « après » sur le build de production) :

| Avant | Après |
| --- | --- |
| `avant-galerie-1366.png` — navbar sur deux lignes, nom tronqué, écran presque vide | `apres-galerie-1366.png`, `apres-galerie-375.png` |
| `avant-accueil-1366.png` — six cartes vides identiques | `apres-accueil-1366.png` |
| `avant-tableau-de-bord-1366.png` — « Impossible de charger le tableau de bord » | `apres-tableau-de-bord-1366.png` |
| `avant-connexion-1366.png` — connexion refusée | `apres-connexion-1366.png` |
| — (pages inexistantes) | `apres-nous-rejoindre-1366.png`, `apres-maitrise-1366.png`, `apres-comptes-admin-1366.png` |
| | `apres-notre-histoire-1366.png`, `apres-nos-branches-1366.png`, `apres-menu-mobile-375.png` |

## 12. Problèmes non résolus et recommandations

1. `docs/rapport-refonte.md`, cité par le README et `modernisation.md`, n’existe pas : à rédiger ou retirer du README.
2. Le texte « Données personnelles » doit être validé par la direction du groupe (et, si nécessaire, au regard des obligations ARTCI) ; aucune durée de conservation n’y est affirmée.
3. Un membre n’a qu’un rôle en base : plusieurs fonctions se saisissent dans « Fonction affichée ». Un modèle de fonctions multiples demanderait une migration.
4. Les écrans des espaces familles (fermés) et plusieurs formulaires anciens (réunions, passage de branche, import) n’ont reçu que l’harmonisation des couleurs.
5. Le site public est mis en cache 60 s : une publication apparaît avec ce délai.
6. Photo d’accueil : l’illustration par défaut est signalée comme telle ; remplacer par une photo authentique du groupe via l’administration.
7. L’année 1956 provient de la configuration ; le rang historique n’est publié qu’une fois confirmé par une source.
8. À faire : Lighthouse sur un build de production, recette au lecteur d’écran, exécution du job e2e de la CI distante (non lancée ici).
9. Avertissement Next.js préexistant sur le logo (`width`/`height` modifiés par le préflight Tailwind) : sans effet visible, à traiter avec `h-auto`/`w-auto` explicites.
