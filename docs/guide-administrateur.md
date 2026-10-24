# Guide de l'administrateur

Ce guide s'adresse à la personne chargée de l'**administration technique** de la plateforme du groupe scout. Il complète le rôle du **Chef de Groupe**, qui dirige l'organisation scoute (scouts, branches, maîtrise, activités).

| Rôle | Responsabilités |
| --- | --- |
| Administrateur | Comptes et permissions, identité et configuration, contenus publics, demandes d'adhésion, journal d'audit, paramètres |
| Chef de Groupe | Direction du groupe : maîtrise, scouts, branches, activités, réunions, cotisations, rapports, demandes d'adhésion |
| Adjoint / Assistant de Groupe | Appui à la direction du groupe, selon les droits prévus |
| Responsable / Adjoint / Assistant de Branche | Gestion de sa branche (scouts, réunions, présences, progression) |
| Parent, Scout | Espaces personnels, **fermés** tant que le groupe ne les a pas validés |

La plateforme appartient à **une seule paroisse** : il n'existe ni création, ni liste, ni suppression de paroisses. Toutes les permissions sont vérifiées par le serveur ; masquer un bouton n'est jamais une protection.

## 1. Première connexion

1. Ouvrez `/connexion` et saisissez votre matricule et votre mot de passe.
2. Un compte créé avec un mot de passe temporaire doit définir un mot de passe personnel avant tout accès.
3. Créez **un second compte administrateur** de secours (le tableau de bord le rappelle tant qu'il n'existe pas). Le dernier administrateur actif ne peut jamais être désactivé.

## 2. Identité et configuration

**Administration › Identité et configuration.** Cette configuration est unique : elle se met à jour, elle ne se crée ni ne se supprime.

- **Identité** : nom officiel de la paroisse, nom du groupe, ville, diocèse, présentation, message de bienvenue.
- **Histoire** : année historique (1956), mention complémentaire de rang historique. Cette mention n'est publiée **que si** vous cochez « confirmée par une source » et indiquez la source (archives, registre…).
- **Accueil** : titre, sous-titre et photo du bandeau de la page d'accueil, avec un texte alternatif décrivant l'image.
- **Apparence** : logo et couleurs (vert scout, terracotta, profond, survol). Le bouton « Revenir à la charte » restaure les couleurs d'origine.
- **Contact et réseaux** : adresse, téléphone, e-mail (il reçoit aussi l'alerte « nouvelle demande »), horaires, liens https des réseaux sociaux.
- **Site public** : ouverture ou fermeture des inscriptions en ligne.

N'inventez aucune information officielle : laissez un champ vide plutôt que d'y mettre une valeur non vérifiée.

## 3. Comptes et permissions

**Administration › Utilisateurs.**

- **Créer un compte** : nom, prénom, matricule (ou téléphone), rôle, branche pour les rôles de branche. Un **mot de passe temporaire** s'affiche **une seule fois** : remettez-le en main propre, jamais par un canal non sécurisé. La personne devra le remplacer à sa première connexion.
- **Droit « éditeur de contenus »** : autorise un compte (par exemple un membre de la maîtrise chargé de la communication) à gérer actualités, galerie, histoire et présentations des branches. Il prend effet immédiatement et se retire de la même manière.
- **Profil public** : n'activez « profil public » qu'avec l'accord de la personne. Seuls la photo, la fonction publique et la biographie choisies apparaissent sur la page « Notre équipe » ; jamais le téléphone ni l'e-mail.
- **Changer un rôle** : les sessions de la personne sont fermées ; l'historique des responsabilités (mandats) est conservé. Un seul Chef de Groupe actif et un seul Responsable actif par branche sont acceptés.
- **Réinitialiser un mot de passe** : un nouveau secret temporaire est imposé.
- **Désactiver** : aucun compte n'est supprimé physiquement.

Le Chef de Groupe gère lui-même les comptes de la maîtrise (**Gestion du groupe › Comptes de la maîtrise**) ; il ne peut pas créer d'administrateur.

## 4. Contenus publics

### Actualités (Administration › Publications)
1. **Nouvelle publication** : titre (l'adresse « slug » se remplit automatiquement), résumé, catégorie, image de couverture et son texte alternatif, contenu.
2. Mise en forme du contenu : `## Titre`, `### Sous-titre`, `- élément de liste`, `> citation`, une ligne vide entre deux paragraphes. Aucun code HTML n'est interprété.
3. Renseignez le titre et la description pour les moteurs de recherche (70 et 160 caractères au plus).
4. **Enregistrer** garde un brouillon ; **Publier** met en ligne (date de publication facultative) ; **Dépublier** retire du site ; **Archiver** conserve sans afficher. Une publication en ligne ne peut pas être supprimée sans être retirée d'abord.

### Galerie (Administration › Galerie)
- Créez un album, puis ajoutez des photos. Toute photo est **présumée montrer des mineurs** et n'est **jamais publiée automatiquement**.
- Pour publier une photo de mineurs, vérifiez d'abord que **les consentements à l'image de tous les jeunes visibles** sont enregistrés, cochez « consentements vérifiés », puis « publiée ». Le serveur refuse toute publication sans cette vérification.
- Une photo non publiée reste privée : elle n'est accessible qu'aux gestionnaires de contenus.

### Histoire du groupe (Administration › Histoire du groupe)
- Chaque événement porte une année, un titre, une description, un type (origines, fondation, chef de groupe, camp, étape, témoignage, document d'archive), une image ou un document facultatifs et une **source**.
- Un fait « validé » doit citer sa source. Un fait « à vérifier » publié porte sur le site la mention « À confirmer par les archives ».

### Présentation des branches (Administration › Présentation des branches)
Utilisez uniquement les textes officiels validés par le groupe. Une branche inactive ou non publiée n'apparaît pas sur le site.

## 5. Demandes d'adhésion

**Administration › Demandes d'adhésion** (administrateur et équipe de groupe). Les formulaires « Nous rejoindre » et « Contact » créent une demande ; **aucun compte n'est jamais créé automatiquement**. Changez le statut (nouvelle, en cours, acceptée, refusée, archivée) et notez le suivi en interne. Les demandes contiennent des données personnelles, parfois de mineurs : archivez-les une fois traitées.

Protection anti-spam : limitation par adresse IP, champ piège et délai minimal de saisie.

## 6. Journal d'audit

**Administration › Journal d'audit** (administrateur et Chef de Groupe) : création et modification de comptes, changements de rôle, consultation de documents sensibles, modifications de configuration et de contenus, exports. Filtrez par action, entité ou date. Le journal ne contient ni mot de passe ni donnée médicale.

## 7. Paramètres et exploitation

**Administration › Paramètres** : état de la base, du stockage des fichiers et de l'envoi d'e-mails ; exports CSV (scouts, comptes, activités, cotisations), journalisés.

Rappels d'exploitation (voir `docs/deploiement-ovh.md`) : sauvegarde chiffrée quotidienne et avant chaque migration, test de restauration régulier, durées de conservation fixées par l'association avant toute purge automatique, surveillance extérieure de `/api/sante`.

## 8. Données personnelles

- Les fiches des scouts, les listes internes, les contacts et les données de santé ne sont **jamais** visibles sur le site public.
- L'encadrement de branche ne voit que les scouts de sa branche ; la consultation d'un document sensible est journalisée.
- Les consentements (image, santé) sont enregistrés avec leur date et leur origine ; ils ne constituent pas à eux seuls une preuve juridique (voir `docs/donnees-sensibles-et-consentements.md`).
- Les durées de conservation et les démarches auprès de l'ARTCI relèvent d'une validation par l'association.
