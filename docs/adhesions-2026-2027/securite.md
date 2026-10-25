# Revue de sécurité et intégrité

## Contrôles mis en place

- Session locale persistée vérifiée avant chaque route ; le rôle, les mandats actifs et les habilitations sont relus en base, jamais acceptés du navigateur.
- Le choix d'espace ne peut inventer un mandat. Les services historiques reçoivent la branche du mandat sélectionné, vérifiée par AuthGuard. Un mandat clos/expiré disparaît de la session suivante.
- Les opérations financières exigent des habilitations explicites indépendantes de l'administration et de la hiérarchie scoute ; chaque dossier est contrôlé au niveau objet et les listes/exports appliquent le même périmètre.
- Corps Zod stricts, FCFA entiers, bornes PostgreSQL, dates de réception distinctes des dates de saisie, années consécutives, sous-ensembles de lots contrôlés et listes bornées.
- Requêtes paramétrées, y compris la recherche normalisée des identités ; aucune donnée client n'est interpolée en identifiant SQL. Les DDL bruts des tests sont constants et limités à la base jetable.
- Verrouillage transactionnel des identités, des adhésions et des lots ; index uniques pour l'unicité annuelle et les engagements de lots ; encaissement idempotent et refus des dépassements de solde.
- Audit financier bloquant dans la transaction ; écritures et confirmations protégées contre UPDATE/DELETE ; corrections séparées et justifiées. La purge ordinaire exclut le journal financier, également protégé en SQL.
- Provenance unique et clé étrangère restrictive vers les cotisations reprises ; aucune confirmation nationale fabriquée ; dossiers repris à contrôler avant nouvelle opération financière.
- CSV avec échappement et neutralisation des formules ; identités limitées aux champs nécessaires ; absence de données de santé/contact dans le nouveau module.
- Les erreurs Prisma passent par le filtre existant, sans SQL ni trace renvoyés au navigateur. Les réponses restent privées et non mises en cache.

## Limites et décisions d'exploitation

L'administrateur technique peut attribuer explicitement une permission financière à son propre compte ; ce pouvoir est audité. La double approbation et la séparation entre préparateur et confirmateur ne sont pas imposées, car elles n'ont pas été définies comme règles métier.

Une opération déjà engagée peut se terminer si une habilitation est révoquée simultanément après son contrôle transactionnel. Les requêtes suivantes relisent les droits. La protection ne prétend pas fournir une révocation rétroactive des transactions engagées.

Un lot déclaré en anomalie conserve son engagement. La résolution d'un remboursement/rejet national exige une preuve et une décision de rapprochement ; l'application ne libère pas silencieusement les fonds. Les rapprochements d'identités contradictoires ou les homonymes sans preuve ne sont jamais fusionnés automatiquement.

Les recherches de membres sont bornées à 50 résultats ; les listes des lots, des mandats et des adhésions disposent d'une pagination serveur et les CSV sont limités à 10 000 adhésions. Aucune mesure de charge à grande échelle n'est revendiquée.

Les présentations de la maîtrise utilisent les mandats actifs et conservent le consentement public. Les notifications et abonnements calendaires historiques restent à examiner lors de la recette métier d'un compte à plusieurs responsabilités. Le nouveau circuit financier et les contrôles de périmètre des API privées disposent de leur couverture dédiée.

La sauvegarde de données réelles, la restauration vérifiée, les montants officiels et la recette du groupe restent des préalables à la mise en service. Aucune homologation, conformité juridique ou sécurité exhaustive n'est déduite des tests exécutés.
