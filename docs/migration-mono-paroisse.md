# Migration vers la plateforme mono-paroissiale

Cette procédure concerne une base **existante** créée avant la simplification (modèles `Paroisse`, `District`, `AffectationDistrict`, `ConfigurationPlateforme`, colonnes `paroisseId`, rôles district). Une installation neuve n'est pas concernée : `npm run db:deploy` puis `npm run initialiser` suffisent.

## Ce que fait la migration `20261024100000_mono_paroisse`

Elle s'exécute dans **une seule transaction** : en cas d'erreur, rien n'est appliqué.

1. **Garde-fou bloquant.** La migration s'arrête si la base contient plus d'une paroisse, plus d'un district, ou un compte dont le rôle principal est un rôle district. Aucun changement n'est alors appliqué (voir « Arbitrage » ci-dessous).
2. **Archivage sans perte.** Avant toute suppression, sont copiés en JSON dans la table `ArchiveDonnees` (colonnes `source`, `sourceId`, `donnees`, `motif`) :
   - la ligne `District` et la ligne `Paroisse` ;
   - l'historique `AffectationDistrict` ;
   - la `ConfigurationPlateforme` ;
   - pour chaque compte concerné, ses anciennes colonnes `paroisseId`, `roleDistrict`, `fonctionDistrict`, `brancheTypeDistrict`.
3. **Reprise de l'identité.** La paroisse devient la configuration unique `ConfigurationInstallation` (id `installation`) : nom, ville, diocèse, adresse, téléphone, e-mail, logo, couleurs (les couleurs personnalisées sont conservées, les anciennes valeurs par défaut cèdent la place à la nouvelle charte), textes d'accueil. L'année historique est initialisée à **1956** ; la mention « deuxième paroisse de Côte d'Ivoire à accueillir le scoutisme » est enregistrée comme **non validée** et n'est jamais publiée tant qu'une source ne la confirme pas (Administration › Identité et configuration › Histoire).
4. **Rôles.** `ADMIN_PLATEFORME` devient `ADMINISTRATEUR` ; les valeurs district disparaissent de l'énumération. Les index d'unicité « un seul Chef de Groupe actif » et « un seul Responsable actif par branche » sont recréés sans `paroisseId`.
5. **Simplification.** Suppression des colonnes `paroisseId` (Scout, Utilisateur, Activite, JourReunion, Programme, Cotisation, ConfigReunionBranche, JournalAudit) et des tables `District`, `Paroisse`, `AffectationDistrict`, `ConfigurationPlateforme`.
6. **Nouveaux éléments.** Branches du référentiel (six lignes, présentations vides à compléter), équipes, mandats (un mandat ouvert est repris pour chaque compte actif de la maîtrise, avec la mention « date de début réelle inconnue »), barèmes de cotisation, publications, galerie, histoire, demandes d'adhésion. Les activités passées reçoivent le statut « Terminée » ; aucune activité n'est rendue publique.

Les fichiers privés déjà téléversés gardent leur URL (`/api/fichiers/<ancien identifiant de paroisse>/<nom>`) : ils restent lisibles. Les nouveaux fichiers sont rangés dans le dossier `groupe` (et `galerie` pour les photos d'albums).

## Procédure

1. **Sauvegarde vérifiée** (obligatoire) :
   ```bash
   cd apps/api
   npm run sauvegarder
   npm run restaurer-sauvegarde -- --derniere --sortie /tmp/avant-mono.dump   # relecture de contrôle
   ```
   Conserver ce fichier hors du VPS le temps de la validation, puis le supprimer (données personnelles).
2. **Répétition sur une copie** : restaurer la sauvegarde dans une base jetable, y appliquer `npm run db:deploy`, vérifier les contrôles ci-dessous. Ne jamais utiliser `prisma migrate reset` ni `prisma migrate dev` sur une base à conserver.
3. **Fenêtre de maintenance** : prévenir les utilisateurs ; toutes les sessions devront être rouvertes.
4. **Déploiement** de la release (le script prend une sauvegarde chiffrée avant `migrate deploy`). Renommer au préalable `shared/web-paroisse.env` en `shared/web.env` et retirer les variables `ADMIN_EMETTEUR_CONFIANCE`, `ADMIN_CLE_PUBLIQUE_FICHIER`, `ADMIN_URL_VERIFICATION_SESSION` de `shared/api.env`.
5. **Créer un administrateur local** (l'ancien administrateur plateforme vivait dans l'installation district) :
   ```bash
   cd current/apps/api && npm run initialiser -- --admin
   ```
6. **Compléter l'identité** dans Administration › Identité et configuration, puis la présentation des branches, l'histoire et les profils publics.

## Contrôles après migration

```sql
SELECT source, count(*) FROM "ArchiveDonnees" GROUP BY source;      -- District 1, Paroisse 1, …
SELECT "nomParoisse", "anneeHistorique", "rangHistoriqueValide" FROM "ConfigurationInstallation";
SELECT role, count(*) FROM "Utilisateur" GROUP BY role;              -- plus aucun ADMIN_PLATEFORME
SELECT count(*) FROM "Mandat" WHERE "finLe" IS NULL;                 -- comptes actifs de la maîtrise
```

Les effectifs (scouts, cotisations, présences, documents, journal d'audit) doivent être identiques avant et après.

## Arbitrage en cas de blocage

Si la base contient **plusieurs paroisses ou districts** (par exemple l'ancienne installation district ou un jeu de démonstration), la migration refuse de s'appliquer. Aucune suppression automatique n'est faite. Il faut décider, avec les responsables :

- quelle paroisse correspond à cette installation ;
- ce que deviennent les données des autres paroisses (export, autre installation indépendante, ou suppression explicitement validée).

Une fois la base réduite à une seule paroisse et un seul district (opération manuelle, après sauvegarde), relancer le déploiement. Pour une base de développement, recréer simplement une base vide puis `npm run db:deploy && npm run db:seed`.

Message renvoyé par PostgreSQL : `Migration mono-paroisse bloquée : N paroisses en base. Arbitrage requis`. Prisma peut afficher à la place « current transaction is aborted » : consulter alors les journaux PostgreSQL. La migration est marquée en échec dans `_prisma_migrations` ; après arbitrage, la marquer comme annulée avant de relancer :

```bash
npx prisma migrate resolve --rolled-back 20261024100000_mono_paroisse
```

## Retour arrière

La migration supprime des tables et des colonnes : **une release antérieure ne peut pas fonctionner sur le schéma migré**. Le seul retour arrière est la restauration de la sauvegarde prise à l'étape 1 (voir `docs/deploiement-ovh.md`, section « Restaurer une sauvegarde »). Les données archivées restent consultables dans `ArchiveDonnees` en cas de besoin d'audit.

## Vérifications effectuées pendant la refonte

- Base de démonstration à trois paroisses et deux districts : migration refusée, aucune modification (table `ArchiveDonnees` absente, trois paroisses toujours présentes).
- Base représentative à une paroisse : archivage (5 sources), identité reprise, rôles convertis, mandats ouverts, statut des activités passées, schéma identique au schéma Prisma (`prisma migrate diff` vide).
- Base neuve : 26 migrations appliquées, seed de démonstration idempotent.
- Test SQL `apps/api/test/migrations/reprise.sql` (CI) : reprise complète sans perte de compte, scout ni cotisation, aucune colonne `paroisseId`/`roleDistrict` ni rôle district restants.
