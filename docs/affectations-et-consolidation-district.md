# Affectations et préparation du district

## Modèle conservé

Les champs `Utilisateur.roleDistrict`, `fonctionDistrict` et `brancheTypeDistrict` restent la projection utilisée par les autorisations existantes. Le rôle paroissial reste indépendant. `AffectationDistrict` conserve responsable, structure, rôle, fonction/branche, dates, auteur, motif et auteur/motif de révocation. Les acteurs peuvent provenir d'une autre installation : leurs identifiants sont conservés sans clé étrangère locale, comme dans l'audit existant. Les responsables et districts référencés ne peuvent pas être supprimés physiquement tant que cet historique existe.

Les nominations administrateur, remplacements de commissaire, modifications et retraits d'équipe ferment le mandat précédent, créent le suivant et révoquent les sessions dans la même transaction que la projection. Un verrou de ligne sur le district sérialise les nominations de commissaires. Une affectation inchangée ne crée pas de mandat supplémentaire. L'audit métier reste complémentaire à l'historique transactionnel.

L'ordre des verrous est **district, puis utilisateur, puis sessions**. Le helper historique verrouille le responsable avant de lire sa projection et avant toute révocation. La nomination administrative acquiert également ce verrou lorsque seul le rôle paroissial change, même si l'historique district n'est pas modifié. Les opérations d'authentification et de réinitialisation prennent le verrou utilisateur avant de créer ou révoquer les sessions : l'ordre cohérent évite une inversion de verrous entre réinitialisation et affectation concurrentes.

Un changement de district de paroisse est refusé avec HTTP 409 tant qu'un de ses comptes conserve `roleDistrict`, y compris si ce compte est inactif. Le périmètre des droits découle de la paroisse d'ancrage : un déplacement ne peut donc pas transférer implicitement une responsabilité vers une autre structure. L'administrateur doit retirer explicitement les mandats, déplacer la paroisse, puis effectuer toute nouvelle nomination séparément. Il s'agit d'une protection conservatrice dans l'attente d'une éventuelle règle métier de transfert, et non d'une révocation ou nomination automatique. L'historique reste attaché au district initial. Un déplacement autorisé verrouille les deux districts dans l'ordre de leurs identifiants, la paroisse puis ses utilisateurs, et modifie le rattachement avec révocation de leurs sessions dans la même transaction. L'événement d'audit conserve uniquement les identifiants des structures.

`POST /api/district/utilisateurs` et `PUT /api/district/utilisateurs/:id` acceptent un `motif` optionnel (500 caractères maximum). Ces routes restent hors V1. `GET /api/admin/districts/:id/affectations?page=1&limite=25` expose l'historique à l'administrateur plateforme, au maximum 100 éléments par page, avec responsable, dates, acteurs, motifs et indicateur `reprise`.

## Migration et reprise

La migration `20261023120000_historique_affectations_district` ajoute une table, des index et des contraintes ; elle ne modifie aucune affectation courante. Elle reprend chaque `roleDistrict` existant via sa paroisse d'ancrage. `reprise=true` indique que `debutLe` est la date d'observation, et que l'auteur et le véritable début de mandat sont inconnus. Ne pas interpréter cette date comme une date de nomination historique.

Avant application autorisée sur une base réelle : sauvegarde vérifiée, répétition sur une copie PostgreSQL isolée, comparaison du nombre de projections non nulles avec celui des reprises et contrôle des doublons de commissaires existants. Toute affectation sans paroisse valide doit être examinée avant la migration ; ne pas inventer de rattachement. La migration doit précéder le démarrage de la nouvelle API. Arrêter brièvement les écritures d'affectations pendant la bascule évite les divergences entre anciennes et nouvelles releases. Un mécanisme de reprise au prochain changement conserve également une ancienne projection sans historique.

Le rollback applicatif conserve la table. Une ancienne release peut mettre à jour une projection sans alimenter l'historique : après un tel rollback, suspendre les affectations ou prévoir une réconciliation explicite avant reprise. Ne jamais supprimer l'historique pour effectuer un rollback. Aucune migration n'est exécutée automatiquement par ce document.

### Test de reprise reproductible

`apps/api/test/migrations/reprise.sql` reconstruit la version antérieure par inclusions relatives des migrations réelles, insère trois comptes entièrement synthétiques (commissaire, assistant de branche et personne sans mandat), applique la migration historique puis vérifie conservation des comptes/projections, reprise sans auteur inventé, branche, unicité du mandat actif, rôles autorisés, dates et protection du responsable référencé. Il s'exécute indépendamment des tests sur une base vide, et refuse une base contenant déjà des tables.

Le helper `reprise.sh` ne charge aucun `.env` et ne crée, ne supprime ni ne vide de base. Il exige PostgreSQL en loopback et un nom `ci_reprise` ou `scout_test_reprise_*`. Les variables héritées `PGHOSTADDR`, `PGSERVICE` et `PGSERVICEFILE` sont retirées avant `psql` afin de préserver cette cible. En CI, le job `test` crée `ci_reprise` dans son service PostgreSQL jetable, puis lance ce scénario après les migrations ordinaires. Aucun secret ni accès de production n'est nécessaire.

Pour reproduire depuis la racine du dépôt avec Docker (identifiant exclusivement de test, aucun port publié) :

```bash
docker run --detach --rm --name scout-reprise-validation \
  --env POSTGRES_PASSWORD=secret_test_uniquement \
  --env POSTGRES_DB=scout_test_reprise_validation \
  --mount "type=bind,source=$PWD/apps/api,target=/workspace/api,readonly" \
  postgres:16-alpine
docker exec scout-reprise-validation pg_isready -U postgres -d scout_test_reprise_validation
# Attendre le statut « accepting connections » avant la commande suivante.
docker exec --env PGHOST=127.0.0.1 --env PGUSER=postgres \
  --env PGPASSWORD=secret_test_uniquement \
  --env PGDATABASE=scout_test_reprise_validation \
  scout-reprise-validation bash /workspace/api/test/migrations/reprise.sh
docker stop scout-reprise-validation
```

Les assertions doivent toutes produire `OK` et le processus terminer avec le code 0. Le conteneur et ses données éphémères sont supprimés à son arrêt grâce à `--rm`. Une seconde exécution sur la même base est volontairement refusée ; recréer le conteneur pour un nouveau test.

## Consolidation entre installations : préparation uniquement

L'API locale ne voit que sa propre base. Aucun accès SQL inter-installations ni collecte distante n'est ajouté. `modules/district/consolidation.ts` fournit un contrat versionné strict et un assembleur pur, sans contrôleur, sans transport réseau et sans activation publique. `PERIMETRE_V1` reste à `true`.

Le contrat ne transporte que deux agrégats (`scoutsActifs`, `activitesTerminees`), la période mensuelle, la date de calcul et les identifiants de structure/source. Il rejette les champs supplémentaires, les nombres négatifs et les sources incohérentes. Les sources absentes, dupliquées, invalides ou refusées produisent `totaux=null` avec un statut explicite, jamais un zéro fictif. Une installation non autorisée ne contribue pas au résultat.

Avant branchement du transport, valider les éléments suivants :

- Registre serveur des installations et rattachements territoriaux autorisés ; aucun hôte arbitraire issu d'une requête utilisateur.
- Authentification mutuelle entre services (mTLS ou jetons courts signés avec audience, émetteur, expiration et protection contre le rejeu), rotation et révocation des identités.
- Identité authentifiée fournie à l'assembleur par le transport vérifié ; le champ JSON `installationId` ne prouve jamais l'identité.
- Autorisation explicite installation/district/période, limitation de débit, délais, fraîcheur maximale, reprise après indisponibilité et audit minimal des échanges sans données nominatives.
- Validation des règles de confidentialité des petits effectifs, de rétention et des rôles autorisés à consulter les agrégats.
- Tableau de bord distinguant sources complètes, partielles, anciennes et indisponibles, puis tests d'intégration multi-installations et d'isolement territorial.

Les vues nominatives, données de santé et documents des mineurs ne font pas partie de ce contrat. Leur éventuel accès nécessite une règle métier et une validation de confidentialité dédiées. La réactivation de l'espace commissaire reste une décision distincte.

## Préparation de la page commissaire

`apps/web-district/app/district/page.tsx` prépare un rendu serveur des seuls agrégats de `GET /api/district/apercu`, relatifs à l'installation locale. La page appelle immédiatement `notFound()` lorsque `PERIMETRE_V1` est actif, avant toute lecture de session ou de données. Le proxy reste inchangé et aucun lien de navigation public n'est ajouté.

Les futurs parcours contrôlent session, changement obligatoire du mot de passe et appartenance à `ROLES_DISTRICT`. Cette constante n'autorise actuellement que `COMMISSAIRE_DISTRICT` : aucun droit supplémentaire n'est accordé à l'adjoint. Le schéma partagé `SchemaApercuDistrict` contrôle les nombres, la cohérence des totaux et l'unicité des paroisses, puis retire les champs supplémentaires de la projection avant le rendu. Aucun nom de mineur ni contact nominatif n'est affiché.

Les états session expirée, accès interdit, fonctionnalité désactivée, erreur de service, réseau et données incohérentes sont distincts. Les erreurs ne génèrent aucun indicateur à zéro. Les états transitoires proposent une nouvelle lecture de la page. Des tests Vitest vérifient le rendu serveur, les rôles, la validation des réponses, les états vides et l'inaccessibilité effective en V1 ; les scénarios hors V1 utilisent exclusivement un drapeau simulé dans les tests. Aucun échange inter-installations n'est branché sur cette page.

L'inspection en lecture seule des modèles CMG `UserRole` et `CommunityLeadership` a confirmé l'intérêt d'une fin de mandat explicite (`revokedAt`). Aucun fichier CMG n'a été modifié et leurs suppressions en cascade n'ont pas été reprises pour cet historique.
