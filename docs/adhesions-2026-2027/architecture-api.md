# Architecture et contrats — adhésions nationales

## Modèle retenu

Le nouveau module `apps/api/src/modules/adhesions-nationales` complète les cotisations historiques ; il ne réintroduit aucune organisation multiparoisse.

- `PersonneAdhesion` porte au plus un Scout et un Utilisateur. Les fiches restent séparées. Un lien existant ou un matricule concordant permet de partager l'identité financière ; une contradiction ou un homonyme non rapproché bloque la création.
- `AdhesionAnnuelle` est unique par personne/année. Le montant dû, la catégorie et la branche sont figés à la création. Un changement de barème n'est pas rétroactif.
- `BaremeAdhesion` distingue SCOUT/CHEF, année, branche éventuelle et validité. La modification d'un tarif passe par un nouveau barème ; l'ancien peut être désactivé.
- `EncaissementAdhesion` contient chaque réception séparée et une clé d'idempotence globale. `AnnulationEncaissement` compense une écriture avec motif sans la modifier. Une reprise sans date réelle connue garde `encaisseLe = null` ; le formulaire courant exige une date.
- `LotReversementNational` et ses lignes réservent les adhésions intégralement encaissées. Une seule ligne engagée par adhésion est garantie par index SQL partiel. La préparation ne déclare aucun paiement.
- `ConfirmationNationale` est une action distincte après déclaration du versement. `CorrectionConfirmation` invalide une confirmation sans effacer l'original.
- `RepriseCotisation` conserve le lien unique à la cotisation source et ses montants.

Le solde matérialisé `montantEncaisse` est mis à jour dans la transaction de chaque écriture. Une contrainte SQL impose `0 <= montantEncaisse <= montantDu` ; la synthèse relit aussi le journal des encaissements. Le FCFA utilise des entiers PostgreSQL, sans nombre décimal. Les calculs agrégés retournent des montants séparés des effectifs.

## États indépendants

| Axe         | Source de vérité                                | États présentés                                                                                            |
| ----------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Local       | Montant dû, écritures non annulées, exonération | NON_PAYE, PARTIELLEMENT_PAYE, ENCAISSE_LOCALEMENT, EXONERE                                                 |
| Reversement | Ligne engagée et lot                            | NON_ELIGIBLE, EN_ATTENTE_REVERSEMENT, PREPARE, DECLARE, PARTIELLEMENT_CONFIRME, CONFIRME, ANOMALIE, ANNULE |
| National    | Confirmation sans correction                    | NON_CONFIRME, CONFIRMATION_NATIONALE_EN_ATTENTE, COTISANT_CONFIRME ; A_VERIFIER si rapprochement requis    |

Les anciens booléens `cotisant` du module `/cotisations` désignent uniquement le suivi local historique. L'interface le précise ; ils ne pilotent jamais le statut national du nouveau module.

Une adhésion reprise est bloquée pour les nouveaux encaissements et lots jusqu'à examen des montants locaux. L'examen local ne confirme jamais le national. Une exonération est locale : elle n'invente pas d'adhésion nationale.

## Transactions et corrections

L'identité est résolue sous verrou consultatif transactionnel ; les paiements verrouillent la ligne adhésion (`FOR UPDATE`). Les lots verrouillent les adhésions dans un ordre stable. Déclaration, confirmation et anomalie verrouillent le lot. Les écritures et leur audit sont validés ensemble, ou entièrement annulés.

Un renvoi de la même clé d'encaissement avec le même auteur et le même contenu renvoie l'écriture originale. La réutilisation avec un autre contenu produit 409. Une concurrence sur une unicité SQL ou une sérialisation produit 409 ; le client recharge et réutilise sa clé, sans en générer une nouvelle pour une opération incertaine.

Un lot PREPARE annulé libère ses lignes. Un lot déjà déclaré devient ANOMALIE, conserve les fonds engagés et invalide ses confirmations par de nouvelles écritures. Sa résolution financière exige un rapprochement externe : aucun remboursement national n'est supposé. L'interface et l'API ne permettent pas d'effacer les écritures financières.

## Matrice des habilitations

`HabilitationAdhesion` est attribuée et révoquée explicitement par l'administration technique, avec motif et audit. Une permission limitée à une branche ne couvre aucune autre branche ni un chef hors de cette branche. Toute habilitation inclut la lecture de son propre périmètre, sans accorder d'autres mutations.

| Permission | Opérations                                                           | Périmètre                         |
| ---------- | -------------------------------------------------------------------- | --------------------------------- |
| LIRE       | Listes, dossiers, indicateurs, CSV, barèmes et recherche des membres | Groupe ou branche ; lots : groupe |
| CREER      | Adhésion annuelle scout ou chef                                      | Groupe ou branche du membre       |
| ENCAISSER  | Réception de fonds                                                   | Groupe ou branche de l'adhésion   |
| REVERSER   | Préparer et déclarer les lots                                        | Groupe uniquement                 |
| CONFIRMER  | Confirmer explicitement un sous-ensemble de lignes d'un lot déclaré  | Groupe uniquement                 |
| CORRIGER   | Annuler un encaissement, examiner/exonérer, annuler/signaler un lot  | Groupe ou branche ; lots : groupe |
| BAREMES    | Nouveau tarif, désactivation                                         | Groupe ou branche du tarif        |

Le rôle ADMINISTRATEUR ne donne aucun droit financier implicite. Il permet uniquement d'attribuer les habilitations, y compris à son propre compte : cette attribution est explicite, nominative et auditée. Une politique de double approbation n'est pas mise en place.

## Mandats et espaces

Les mandats courants se cumulent par fonction/périmètre. Les index empêchent deux fonctions ouvertes identiques pour une personne, deux chefs de groupe ouverts ou deux responsables ouverts d'une même branche. Les nominations prennent effet immédiatement ; les nominations futures ne sont pas exposées.

`AuthGuard` relit compte, sessions, mandats et habilitations à chaque requête. `scout_espace` est une préférence d'affichage non secrète et non autoritaire : sa valeur est rapprochée des mandats actifs côté serveur. Un choix expiré/inconnu retombe sur un espace encore autorisé. Le rôle technique est conservé séparément de la fonction effective. Les contrôleurs historiques utilisent la fonction sélectionnée et les services de périmètre utilisent sa branche vérifiée. Changer d'espace recharge l'application et ses caches, sans changer de compte.

Le changement du poste principal ne ferme que son mandat ; une désactivation du compte ferme tous ses mandats. La clôture individuelle conserve les autres responsabilités et les sessions demeurent utilisables avec les droits restants.

## API

Préfixe `/api`, session locale requise pour toutes les routes. Corps strictement validés par Zod ; erreurs `{ erreur }` : 400 validation, 401 session, 403 habilitation/périmètre, 404 absence, 409 conflit métier/concurrence. Les réponses sont privées et `no-store`.

| Méthode et route                                                       | Contrat / permission                                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET `/adhesions-nationales`                                            | `annee` obligatoire, `branche`, `categorie`, `recherche`, `aReverser=true`, `page`, `limite<=100`, `tri=createdAt                 | montantDu`, `ordre=asc                                                                          | desc`. Retour `{ adhesions, pagination }`, LIRE               |
| POST `/adhesions-nationales`                                           | `{annee,baremeId,scoutId}` OU `{annee,baremeId,utilisateurId}`. Retour adhésion ; CREER                                           |
| GET `/adhesions-nationales/:id`                                        | Identité minimale, barème, écritures/annulations, confirmations/corrections et trois situations ; LIRE                            |
| GET `/adhesions-nationales/indicateurs`                                | `annee`, `branche` éventuelle ; attendus, encaissés, restants, non reversés, déclarés, confirmés et effectifs ; LIRE              |
| GET `/adhesions-nationales/export`                                     | Mêmes filtres que la liste, CSV neutralisant les formules, limite 10 000 lignes explicite ; LIRE                                  |
| GET `/adhesions-nationales/membres`                                    | `categorie=SCOUT                                                                                                                  | CHEF`, `recherche` ; 50 premiers membres actifs du périmètre, champs d'identité minimaux ; LIRE |
| POST `/adhesions-nationales/:id/encaissements`                         | `{montant,mode,encaisseLe,idempotence,reference?,note?}` ; FCFA entier positif, date ISO passée, UUID ; ENCAISSER                 |
| POST `/adhesions-nationales/:id/encaissements/:encaissementId/annuler` | `{motif}` de 5 à 1000 caractères ; refuse tant qu'un lot engage les fonds ; CORRIGER                                              |
| POST `/adhesions-nationales/:id/examen`                                | `{decision:RAPPROCHER_LOCAL                                                                                                       | EXONERER                                                                                        | ANNULER_EXONERATION,motif}` ; aucun effet national ; CORRIGER |
| GET/POST `/adhesions-nationales/baremes`                               | GET `annee` ; POST `{annee,categorie,brancheType?,montant,libelle,debutValidite,finValidite?}` ; LIRE/BAREMES                     |
| POST `/adhesions-nationales/baremes/:id/desactiver`                    | Aucun effet rétroactif ; BAREMES                                                                                                  |
| GET/POST `/adhesions-nationales/lots-reversement`                      | GET `annee`, `recherche`, `page`, `limite`, `ordre` ; POST `{annee,adhesionIds}` (1 à 100 distinctes). Lecture globale / REVERSER |
| GET `/adhesions-nationales/lots-reversement/:id`                       | Détail des lignes et dossiers ; lecture globale                                                                                   |
| POST `/adhesions-nationales/lots-reversement/:id/declarer`             | `{verseLe,reference,justification?}` ; date réelle passée et référence obligatoires ; REVERSER                                    |
| POST `/adhesions-nationales/lots-reversement/:id/confirmer`            | `{adhesionIds,reference?,commentaire?}` ; sous-ensemble explicite, chaque ligne non confirmée d'un lot déclaré ; CONFIRMER        |
| POST `/adhesions-nationales/lots-reversement/:id/anomalie`             | `{motif}` ; annule seulement si jamais déclaré, sinon bloque pour rapprochement ; CORRIGER                                        |
| GET/POST `/adhesions-nationales/habilitations`                         | Administration technique ; POST `{utilisateurId,permission,brancheType?,motif}`                                                   |
| POST `/adhesions-nationales/habilitations/:id/revoquer`                | Administration technique ; `{motif}`                                                                                              |
| GET `/mandats`                                                         | Maîtrise et administrateur, filtres `utilisateurId`, `recherche`, `statut=actif                                                   | clos`, pagination et ordre par date                                                             |
| GET `/comptes-mandats`                                                 | Administrateur ou chef de groupe ; recherche de 50 comptes actifs, identité minimale                                              |
| POST `/utilisateurs/:id/mandats`                                       | Administrateur ou chef de groupe ; `{role,brancheType?,motif}` ; nomination immédiate                                             |
| PATCH `/mandats/:id`                                                   | Administrateur ou chef de groupe ; `{motif}` ; clôture individuelle immédiate                                                     |

Les dates API sont sérialisées en ISO. Les barèmes ne contiennent aucun montant métier codé en dur. Le mode de paiement accepte une valeur textuelle validée, permettant espèces, mobile money, virement et un mode local supplémentaire.

Le journal financier est protégé par trigger contre les modifications et suppressions, y compris lors de la purge ordinaire. Les cotisations sources reprises sont référencées par clé étrangère restrictive. La détection des homonymes réutilise la normalisation de l'inscription des scouts (casse, accents, espaces et inversion nom/prénom).

À partir de 2026–2027, l'ancienne API refuse la création d'adhésions annuelles et la bascule de statut local : le nouveau circuit devient obligatoire. Les cotisations d'activité et les lectures historiques sont conservées. Les annuelles historiques de ces années doivent être reprises avant correction.

L'organigramme privé et les présentations publiques utilisent également les mandats actifs ; l'accord `profilPublic` reste indispensable pour toute apparition publique. Plusieurs fonctions d'une même personne ne multiplient pas l'effectif public des personnes.

Les listes de lots et de mandats sont paginées (`page`, `limite<=100`), recherchables et triables par date (`ordre`). La liste des mandats propose aussi le filtre `statut=actif|clos`.
