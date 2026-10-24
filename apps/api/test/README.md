# Vérifications API

`npm test -w @scout/api` lance les tests unitaires et les scénarios HTTP avec Prisma simulé. La suite PostgreSQL est séparée : elle exige une base **nouvelle, dédiée, migrée et vide de données applicatives**, sur loopback. Aucun `.env` n'est chargé par son point d'entrée.

## PostgreSQL réel

```bash
# Créer préalablement un PostgreSQL jetable autorisé, sans volume persistant.
# Valeur synthétique : ne jamais remplacer par une URL de production.
export DATABASE_URL=postgresql://postgres:scout_test_only@127.0.0.1:55449/scout_test_integration_exercice
npm run prisma:deploy -w @scout/api
SCOUT_TEST_DATABASE_URL="$DATABASE_URL" npm run test:integration -w @scout/api
```

La commande de migration est un outil normal d'exploitation : sa cible doit être vérifiée avant exécution. La garde de sécurité de la suite s'applique au lancement de `test:integration`, pas à une commande Prisma lancée séparément.

Avant tout constructeur Prisma/connexion, la suite refuse une URL sans utilisateur, un hôte hors `localhost`/`127.0.0.1`/`::1`, une option de requête ou un fragment, et tout nom autre que `ci_integration` ou `scout_test_integration_[a-z0-9_]+`. Elle ignore les options libpq susceptibles de détourner la configuration et ne réutilise pas implicitement `DATABASE_URL`. Après connexion, elle refuse une base contenant des utilisateurs ou des scouts. Cette protection ne remplace pas la création d'un environnement jetable : ne jamais renommer une base existante pour contourner la garde.

La suite utilise les vrais `PrismaService`, `AuthService`, `MotDePasseService` et `AuthGuard`, avec des comptes synthétiques. Elle couvre cinq scénarios :

1. Même JWT refusé après retrait de rôle, puis après révocation persistée.
2. Compte temporaire bloqué sur le métier; changement personnel et fermeture de l'ancienne session.
3. Connexion ayant réellement lu l'ancien hash suspendue par une barrière, remplacement du secret, puis refus de créer une session tardive. Le Proxy retarde la remise d'un résultat PostgreSQL réel sans remplacer ses données.
4. Deux rafraîchissements parallèles et une seule rotation opaque conservée.
5. Erreur synthétique PostgreSQL pendant l'UPDATE des sessions : rollback effectif du nouveau hash et du flag dans le changement personnel.

Les fixtures sont supprimées par leurs seuls identifiants, jamais par `TRUNCATE` ou nettoyage global. Le trigger et la fonction synthétiques sont retirés en `finally`. Détruire le conteneur éphémère après le test, même en cas d'échec; la suite ne crée ni ne supprime elle-même de base. Aucune garantie de journalisation, de latence, de montée en charge ou de révocation d'une requête déjà engagée n'est déduite de ces tests. La fédération réseau reste testée séparément avec un émetteur simulé; cette suite n'appelle aucun service distant.

La CI crée `ci_integration`, y applique les migrations puis lance cette commande. Elle conserve `ci` pour les validations usuelles et `ci_reprise` pour les tests de reprise des affectations : aucun mélange de données entre ces trois bases temporaires.
