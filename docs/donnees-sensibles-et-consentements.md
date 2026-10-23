# Données sensibles et provenance des déclarations

## Ce que l'application enregistre

Les indicateurs image/santé constituent un état opérationnel. Leur provenance est distincte d'une preuve d'autorité parentale juridiquement vérifiée :

| Origine | Signification technique |
| --- | --- |
| `NON_VERIFIE` | Accord déjà présent avant cette migration; sa provenance ne peut être déduite |
| `SAISIE_ADMINISTRATIVE` | Déclaration saisie par un utilisateur autorisé via la gestion des scouts |
| `COMPTE_PARENT_LIE` | Déclaration reçue depuis un compte authentifié ayant un `LienParentScout` dans la paroisse |
| `RETIRE` | État retiré explicitement ou supprimé lors de l'anonymisation |
| `null` | Aucun accord historique documenté; ne signifie pas une preuve de refus |

Les champs `consentementImageOrigine` et `consentementSanteOrigine` sont calculés côté serveur, jamais acceptés depuis le corps d'une modification. La migration ajoute deux colonnes facultatives et qualifie uniquement les booléens historiques vrais en `NON_VERIFIE`; aucune preuve n'est fabriquée. Une saisie administrative ne devient pas une déclaration du compte parent.

Lors d'un retrait, les champs date/auteur de l'accord **actif** sont remis à null. L'événement `SCOUT_CONSENTEMENT_*_MODIFIE` conserve l'auteur dans `acteurId`, la date serveur dans `JournalAudit.createdAt`, ainsi que `source` et `methode` (`INTERFACE_ADMINISTRATIVE` ou `INTERFACE_PARENT`). Aucun nom, contenu médical ou justificatif n'est copié dans ses détails. La purge existante des journaux borne cette traçabilité : coordonner sa durée avec la politique de conservation retenue.

Le journal actuel est applicatif et son écriture reste « best effort » : une erreur est journalisée sans annuler l'action métier. Il n'est ni scellé, ni un registre de preuve garanti. Avant d'exiger une preuve opposable ou une piste exhaustive, décider d'une journalisation transactionnelle, d'une politique d'accès et d'archivage adaptée, puis tester les scénarios d'échec. Un lien de compte à un enfant n'atteste pas à lui seul l'identité du représentant ou son autorité juridique. Aucun contrôle documentaire de cette autorité n'est introduit ici.

## Étude du chiffrement des colonnes — décision à valider

Les champs libres `allergies` et `traitementsMedicaux` restent actuellement lisibles par l'application et ses rôles autorisés. Le chiffrement des sauvegardes et le stockage privé ne sont pas un chiffrement applicatif de ces colonnes. Aucun backfill cryptographique massif ni nouvelle clé n'est activé par cette livraison.

Une évolution ciblée pourrait introduire une enveloppe versionnée pour ces deux champs : chiffrement authentifié avec nonce unique, identifiant/version de clé et données associées liant l'installation, le scout et la finalité. Employer une bibliothèque cryptographique éprouvée et faire revoir le format et ses tests avant utilisation. Stocker le matériel de clé hors de PostgreSQL, du dépôt, des journaux et des sauvegardes de données; préférer un gestionnaire de clés avec droits distincts de l'accès SQL. Une séparation de clés entre installations limite le périmètre d'une compromission. Ne jamais réutiliser les secrets JWT ou la phrase de sauvegarde comme clé des colonnes.

Plan de transition proposé, à valider avant développement :

1. Inventorier précisément toutes les lectures/écritures, exports autorisés, pièces médicales R2 et usages urgents hors ligne; définir le modèle de menace et les accès réellement nécessaires.
2. Ajouter des colonnes chiffrées facultatives et une version de format sans retirer les colonnes existantes. Isoler chiffrement/déchiffrement dans une couche dédiée du service, après contrôle d'accès, sans injecter de logique cryptographique implicite dans toutes les requêtes Prisma.
3. Tester les lectures ancien/nouveau format et les écritures atomiques sous feature flag. Une clé indisponible doit donner un état d'erreur explicite, jamais transformer silencieusement une donnée en champ vide. Aucun texte clair dans erreurs, traces ou réponses non autorisées.
4. Préparer une migration par lots reprenable avec mesures de progression ne contenant pas les données, contrôle des écritures concurrentes et vérification cryptographique des lots. Tester la montée en charge sur des données synthétiques; aucune opération massive en production sans fenêtre et autorisation.
5. Après validation et sauvegarde restaurable, désactiver les lectures du texte clair puis purger celui-ci dans une migration séparée. Revoir le rollback : un ancien binaire ne sachant pas déchiffrer ne peut pas être réactivé après la purge.

### Recherche et Prisma

Un texte chiffré aléatoirement ne permet plus les filtres `contains`, le tri lexical, l'index plein texte ni les agrégations sur son contenu. Privilégier les filtres sur des métadonnées non sensibles autorisées (paroisse, identifiant du scout) et déchiffrer uniquement les dossiers nécessaires après contrôle d'accès. Ne pas télécharger toute la base pour filtrer en mémoire. Tout index aveugle ou chiffrement déterministe révèle des égalités et doit faire l'objet d'une analyse séparée; aucune recherche médicale de ce type n'est ajoutée. Les types Prisma ne protègent pas contre le retour accidentel du chiffré ou du texte clair : tester les sélections et DTO de chaque route concernée.

### Rotation, perte de clé et restauration

Distinguer rotation de clé d'enveloppe et rechiffrement des données. Conserver l'identifiant de version dans chaque enveloppe, lire les versions anciennes autorisées et n'écrire qu'avec la version courante. Exécuter la rotation progressivement avec reprise, suivi d'erreurs et contrôle des droits. L'effacement d'une clé rend les données correspondantes irrécupérables, y compris dans les sauvegardes : ne pas supprimer une version tant que les sauvegardes concernées doivent rester restaurables.

L'exercice de restauration doit associer dump chiffré, clés historiques dans un canal séparé et binaire compatible, puis vérifier des lectures autorisées sans exposer les valeurs dans le rapport. Tester aussi clé absente, mauvaise clé, ciphertext altéré, version inconnue et mélange de données entre installations. Prévoir la perte/compromission du gestionnaire de clés et le fonctionnement opérationnel des urgences; ne jamais créer une sortie de secours non authentifiée. Les RPO/RTO ne sont pas établis tant que cet exercice n'a pas été chronométré.

## Questions de validation avec l'association et, si nécessaire, l'ARTCI

Ces points sont une liste de décisions à obtenir, sans conclusion juridique :

- Qui décide des finalités et des accès, et qui porte les traitements entre paroisse, district, hébergeur et prestataires ?
- Quels éléments permettent d'établir la qualité du représentant, son autorité et les cas de plusieurs représentants ou de retrait contesté ? Une déclaration du compte lié suffit-elle pour chaque usage envisagé ?
- Quelles notices et versions de formulaires sont nécessaires pour distinguer image, publication publique, santé, urgences et partage entre structures ?
- Quelles formalités, garanties et modalités de contrôle faut-il confirmer avec l'association et l'ARTCI pour ces catégories de données, les mineurs, les prestataires et les lieux d'hébergement ?
- Quelles durées retenir pour dossiers actifs/inactifs, retraits, journaux, pièces justificatives et sauvegardes, et comment traiter les demandes d'accès, rectification ou suppression ?
- Qui doit pouvoir accéder aux informations médicales en activité, comment tracer ces accès et quels contrôles organisationnels complètent le chiffrement ?
- Quels incidents déclenchent quelles escalades, auprès de quels responsables, et comment tester restauration et continuité sans exposer des données réelles ?
