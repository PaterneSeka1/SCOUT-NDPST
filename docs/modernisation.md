# Modernisation SCOUT-NDPST — 23 octobre 2026

## Périmètre et architecture

Branche de travail : `feat/scout-quality-security-v2`, créée depuis `459cac6`. Arbre initial propre. Monorepo npm conservé : API NestJS/Prisma, deux Next.js, règles partagées, installations et bases indépendantes. Aucun push, merge, déploiement ou changement de base réelle. CMG consulté uniquement en lecture.

`PERIMETRE_V1` reste à `true`, ses motifs sont inchangés. Le prototype `/district` ajoute une barrière serveur `notFound()` avant toute session ou lecture API. Les routes API existantes restent protégées par authentification, rôle et territoire ; le filtrage produit des anciennes routes hors V1 repose toujours sur les proxies Next. Les API PM2 sont désormais liées à `127.0.0.1`, tandis que Docker conserve son écoute sur l’interface du conteneur. Vérifier aussi le pare-feu réel avant production.

## Réalisations

| Lot | Changements et fichiers principaux |
| --- | --- |
| A — stabilisation | Installation initiale par `npm ci`, versions Node 22.23.4/npm 10.9.9 fixées, comparaison avec un snapshot Git initial. Builds frontend explicites avec Webpack, compilateur Next supporté : Turbopack échoue ici lors de la création de ports de workers. Aucun type ou contrôle lint désactivé pour masquer une erreur applicative. |
| B — sécurité | `apps/api/src/auth`, `common/guards/auth.guard.ts`, services de comptes : JWT lié à `SessionUtilisateur.id` par `sid`, vérification session/compte/paroisse à chaque requête, rejet d’un ancien rôle/territoire, révocation après rôle/branche/affectation, désactivation, déconnexion ou mot de passe. Rotation conditionnelle atomique pour deux rafraîchissements concurrents. Connexion verrouillée sur le compte et relecture du hash avant création de session ; changement personnel, profil et réinitialisation ferment les sessions dans la transaction du nouveau secret. |
| B — activation | Création staff/chef : secret aléatoire de 192 bits, haché bcrypt, retourné une seule fois à l’acteur habilité, remise en personne. Ancien champ client `password` ignoré pour ces créations. `doitChangerMotDePasse` imposé par le guard ; seuls session, changement personnel et routes publiques restent accessibles. Réinitialisations administratives imposent aussi le changement. Comptes scouts hors V1 et chef de l’initialiseur utilisent désormais un secret initial à remplacer. |
| B — historique | `modules/district/affectations.ts` et services district/admin : fermeture/création des mandats et révocation dans la transaction ; verrou de district pour les nominations concurrentes ; historique admin paginé. Deux requêtes constantes remplacent le N+1 de la liste des districts. Déplacer une paroisse vers un autre district exige le retrait explicite de ses affectations district ; le changement de rattachement sans mandat et la révocation des sessions sont transactionnels. Les nominations recontrôlent les transferts concurrents. |
| B — données sensibles | Origine des déclarations santé/image distinguée entre saisie administrative, compte parent lié, retrait et reprise non vérifiée. Auteur, date et méthode tracés sans contenu médical ni secret. Aucun chiffrement massif ou délai de purge activé. |
| C — administration | Erreurs HTTP et réponses statistiques incomplètes refusées, chargement/vide/erreur distingués, action Réessayer ; une seule requête d’agrégats remplace les requêtes redondantes. Confirmations avant désactivation, changement de rôle, nomination et réinitialisation. Formulaires de création sans mot de passe permanent choisi par l’admin. |
| D — interfaces | Parcours `/changer-mot-de-passe` dans les deux apps, redirections selon la session ; dialogues natifs et boucle clavier, retour du focus, labels/erreurs associés, visibilité de mot de passe accessible, navigation active et mobile, réduction des animations. Dashboard paroissial : erreurs et reprise explicites ; pointage accessible. |
| E — district | Schéma partagé de l’aperçu, composant d’agrégats locaux et tests du prototype commissaire bloqué en V1. Contrat pur de consolidation minimisé, sources autorisées et identité de transport vérifiée par contrat, total nul si incomplet. Aucun transport inter-installations ni donnée nominative de mineur ajouté. |
| F — exploitation | Releases indépendantes `releases/<version>`, liens `current/previous/pending`, sauvegarde avant migration et rollback applicatif explicite ; sondes HTTP, fraîcheur R2, restauration jetable et supervision disque/RAM/charge CPU préparées. TLS 1.2/1.3 et timeouts Nginx. |
| F — CI | Versions fixes, actions épinglées, permissions lecture, PostgreSQL temporaire, validation/migrations Prisma, lint/types/tests/builds, audit npm bloquant, images Docker et job Playwright mobile/bureau avec API synthétique. Aucun déploiement automatique. |

La mutualisation des primitives UI a été examinée : les composants restent pour l’instant dans les deux apps afin de limiter la migration de packaging pendant le changement des accès. Aucun `packages/ui` créé. Les contrats réellement communs de l’aperçu district sont dans `packages/shared/src/district.ts`. Ce choix évite une extraction générale sans validation de tous les consommateurs ; la duplication des autres primitives reste une dette identifiée.

## Contrats et compatibilité

- `POST /api/auth/connexion`, `GET /api/auth/session` : l’utilisateur expose `doitChangerMotDePasse`.
- `POST /api/auth/changer-mot-de-passe` : `{ motDePasseActuel, nouveauMotDePasse }`. Vérifie l’ancien secret et sa différence avec le nouveau ; changement, fermeture de toutes les sessions et consommation des liens de réinitialisation dans une transaction. Les cookies sont effacés ; reconnexion obligatoire.
- Routes métier d’un compte en activation : HTTP 403 avec code `CHANGEMENT_MOT_DE_PASSE_REQUIS`.
- Créations staff et chef : `{ ...utilisateur, motDePasseTemporaire }`, sans persistance en clair ni cache de réponse HTTP. L’email de bienvenue ne contient pas ce secret. Les mutations React Query ne conservent pas une copie durable dans le cache des listes.
- Administration externe : nouvelle variable `ADMIN_URL_VERIFICATION_SESSION` vers `/api/auth/session` de l’émetteur district. Vérification systématique sans cache, délai 3 s, refus sur absence de configuration ou indisponibilité. L’URL vient de la configuration serveur, jamais du JWT. Voir le runbook pour la topologie et la recette.
- Anciens JWT sans `sid` refusés après bascule ; leur session opaque peut servir au rafraîchissement si encore valide. Prévoir une reconnexion des clients concernés.
- Les historiques ne sont pas une preuve juridique de consentement. Un lien parent-compte ne vérifie pas à lui seul la qualité de représentant légal.

## Migrations additives

| Migration | Effet et reprise |
| --- | --- |
| `20261023090000_activation_mot_de_passe` | Booléen par défaut `false` pour préserver les comptes existants ; les nouveaux parcours définissent `true`. |
| `20261023120000_historique_affectations_district` | Table/index/contraintes, reprise des projections existantes marquée `reprise`. La date d’observation ne prétend pas être la date historique inconnue du mandat. |
| `20261023200000_consentements_origine` | Deux origines facultatives ; accords historiques marqués `NON_VERIFIE`, sans inventer une preuve parentale. |

Toutes les migrations ont été appliquées sur un PostgreSQL 16 éphémère. Une seconde base synthétique a vérifié la reprise des affectations, la conservation des projections et les contraintes de dates/rôle/unicité/FK. Le conteneur a été supprimé. Aucune base réelle n’a reçu de migration.

## Vérifications avant et après

État initial reconstitué par `git archive 459cac6` sous `/tmp`, car l’installation initiale dans le bac à sable a échoué. Le snapshot utilise les dépendances installées de cette session, le client Prisma additif et les règles partagées existantes inchangées pour la comparaison initiale. Il ne constitue donc pas une réinstallation indépendante du lockfile historique.

| Vérification | Code initial | Code modifié |
| --- | --- | --- |
| Installation | Absente au départ ; `npm ci` réussit hors bac à sable | Lockfile enrichi uniquement de Playwright et métadonnées de versions |
| Lint | Réussi | Réussi avec les caches générés exclus ; aucune règle applicative assouplie |
| Types | Réussi | Réussi sur les quatre workspaces |
| Tests Vitest | 550 tests, 52 fichiers | 670 tests, 67 fichiers : shared 57, API 503, district 95, paroisse 15 |
| HTTP Nest | Scénarios existants | 4 nouveaux tests AuthController + guards/filtre globaux, transport HTTP réel et Prisma simulé |
| Authentification PostgreSQL réelle | Pas de suite dédiée | 5 tests réussis : ancien JWT, activation, course connexion/changement, rotation parallèle, rollback effectif du hash et des sessions sur erreur PostgreSQL |
| Playwright | Pas de suite dédiée | 32 scénarios distincts validés : 24 lors du run complet, 6 repris après correction des sélecteurs, puis 2 nouveaux cas dashboard et revalidation des 2 cas dashboard/déconnexion existants ; bureau et mobile, API synthétique |
| Builds | shared/API réussis ; deux frontends Webpack réussis | `API_URL_INTERNE=http://127.0.0.1:4000 NEXT_PUBLIC_SITE_URL=https://ci.example.invalid npm run build` réussi, shared/API et deux frontends Webpack |
| Migrations | Non appliquées sur base réelle | 25 migrations sur PostgreSQL temporaire ; reprise/contraintes vérifiées |
| Releases/restauration | Pas de simulation dédiée | 5 scénarios releases et 3 restauration avec services simulés réussis ; syntaxes Bash/Node et tests RAM/charge/indisponibilité sur fixtures vérifiés |
| Dépendances | Pas de conclusion disponible | `npm audit --omit=dev --audit-level=high` et variante `--package-lock-only` échouent : registre HTTP 400 « Invalid package tree ». Aucune conclusion d’absence de vulnérabilité ; contrôle CI maintenu bloquant. |

Les premiers essais ont aussi détecté et corrigé : effets React synchrones, assertions de schémas obsolètes, caches `.next-e2e` pris pour du code source et sortie clavier des dialogues. Le chargement natif SWC impose les tests hors bac à sable dans cet environnement. Les builds ont besoin des deux variables ci-dessus et du téléchargement des polices Google configurées à l’origine.

Les tests navigateur utilisent les vraies applications et une API locale synthétique, sans Nest ni base ; ils ne prouvent pas l’intégration complète navigateur/API/PostgreSQL. Les 5 tests PostgreSQL séparés utilisent les vrais services et le vrai guard, ainsi que des comptes synthétiques dans une base migrée vide. Le conteneur en tmpfs a été supprimé après validation. Voir [la procédure API](../apps/api/test/README.md) et [la recette navigateur](../e2e/README.md). Les contrôles du dashboard vérifient une requête partagée page/widget, une requête de reprise et l’absence d’erreurs d’hydratation ou JavaScript.

## Exploitation, validations et risques ouverts

Lire [le runbook releases](exploitation-releases.md), [les affectations et la consolidation](affectations-et-consolidation-district.md) et [les données sensibles/consentements](donnees-sensibles-et-consentements.md).

Avant production :

1. Revoir les migrations, répéter la reprise sur une copie autorisée et vérifier les sauvegardes chiffrées et leur restauration réelle. Aucun test R2 réel ou de restauration d’une sauvegarde de production n’a été exécuté ici.
2. Rétablir un audit de dépendances exploitable et faire passer les jobs CI distants, y compris les builds des trois images Docker. La CI distante et les images Docker complètes ne sont pas validées par les tests locaux.
3. Valider juridiquement la collecte, les représentants habilités, les preuves de consentement, la confidentialité des petits effectifs, les durées de conservation et les démarches applicables auprès de l’ARTCI. Ne pas activer la purge sans durées approuvées. Décider d’une gestion des clés avant tout chiffrement de colonnes.
4. Recetter les installations et rôles réels sur staging : changement/retrait de rôle avec ancien JWT, activation, fichiers privés, erreurs, fédération, affectations et parcours scouts/présences. Les scénarios synthétiques ne remplacent pas cette recette.
5. Préparer les répertoires et secrets `shared`, la release initiale de secours et la fenêtre PM2. Valider URL de revalidation fédérée, ports/pare-feu, HTTPS/HSTS, certificats, ordonnanceur, destinataires et silence des sondes. Aucun service tiers de supervision activé.
6. Attester la compatibilité de schéma avant bascule/rollback. Une ancienne release n’écrit pas l’historique des affectations et ne connaît pas la politique d’activation : suspendre ces opérations pendant le rollback ou préparer une release de secours conservant les correctifs de sécurité. Un rollback applicatif ne restaure jamais la base.

Le transport de consolidation, sa protection contre le rejeu, les règles de fraîcheur, les seuils de confidentialité et la réactivation du commissaire restent à valider. L’espace n’est pas ouvert en production. Les actions sensibles déjà en cours peuvent finir avant une révocation ; les requêtes suivantes relisent l’état courant sans cache. L’audit existant est en meilleur effort et non scellé. Le secret temporaire doit être remis par un canal sûr ; l’association doit valider sa politique de durée d’utilisation avant généralisation. La requête session en base augmente le coût de l’authentification : mesurer la charge réelle avant de chercher un cache qui retarderait la révocation.

## Fichiers et commits

L’inventaire exhaustif est dans [fichiers-modernisation.txt](fichiers-modernisation.txt). Les sources des deux projets CMG sont absentes de cet inventaire. Les fichiers `AGENTS.md`/`CLAUDE.md` des deux frontends sont générés par Next.js lors de `next dev` et conservés avec ses consignes locales.

Les commits locaux sont organisés par backend, frontends, tests/outillage, exploitation/CI et documentation. Consulter `git log --oneline main..feat/scout-quality-security-v2` pour leurs références exactes. Aucun push effectué.

Cette livraison ne constitue pas une déclaration « prêt pour la production ».
