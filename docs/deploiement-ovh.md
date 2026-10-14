# Déploiement sur le VPS OVH

Procédure complète pour remplacer l'ancienne installation (application Next.js unique `scout-ndpst`) par la nouvelle **installation paroisse**, en **repartant d'une base vide**. Elle sert aussi de référence pour les mises à jour suivantes (section 10). L'installation district, autonome (autre clone, autre base), est décrite à la section 13.

## Ce qui sera en place

| Élément                | Où                       | Rôle                                                                    |
| ---------------------- | ------------------------ | ----------------------------------------------------------------------- |
| PostgreSQL 16          | Docker, `127.0.0.1:5434` | Seule donnée conservée sur le VPS, sauvegardée chaque nuit hors du VPS  |
| `scout-api`            | pm2, `127.0.0.1:4000`    | API NestJS, seule à accéder à la base                                   |
| `scout-web`            | pm2, `127.0.0.1:3002`    | Espace paroisse — `https://paroisse.example.ci`                         |
| Fichiers téléversés    | Cloudflare R2            | Photos, fiches médicales, autorisations, logos : **rien sur le VPS**    |
| Sauvegardes de la base | Cloudflare R2            | Chiffrées sur le VPS avant envoi, chaque nuit et avant chaque migration |
| Nginx + Let's Encrypt  | VPS                      | HTTPS vers l'espace paroisse ; l'API n'est pas exposée                  |

L'administrateur plateforme n'a **pas de compte dans cette installation** : son compte unique vivra dans l'installation district, d'où il administrera aussi la paroisse (section 13). L'installation paroisse fait confiance à sa clé publique dès maintenant (étape 2.10).

Dans tout ce document, remplacez `paroisse.example.ci` et `fichiers.example.ci` par vos domaines réels, et `/chemin/ancienne-installation` par le dossier actuel de l'application sur le VPS.

> **Règle de prudence.** Rien n'est supprimé définitivement avant que la nouvelle installation ait été validée (section 9). Jusque-là, l'ancienne installation reste restaurable (section 11).

---

## 1. Préparer les domaines

Chez le gestionnaire DNS, créer deux enregistrements :

1. `paroisse.example.ci` → adresse IP du VPS (enregistrement A) ;
2. `fichiers.example.ci` → **configuré depuis Cloudflare** à l'étape 2.3 (pas vers le VPS).

Vérifier la propagation avant l'étape 7 : `dig +short paroisse.example.ci`.

## 2. Préparer Cloudflare R2

1. Dans le tableau de bord Cloudflare, ouvrir **R2** et créer trois buckets :
   - `scout-prive` : photos des scouts, fiches médicales, autorisations ;
   - `scout-public` : logos et image d'accueil ;
   - `scout-sauvegardes` : sauvegardes chiffrées de la base.
2. Sur `scout-prive` et `scout-sauvegardes` : **ne jamais activer l'accès public**.
3. Sur `scout-public` : **Settings → Public access → Custom domain**, puis ajouter `fichiers.example.ci`.
4. Vérifier que le domaine personnalisé est actif (statut « Active »).
5. Sur `scout-sauvegardes` : **Settings → Object lifecycle rules**, ajouter une règle qui supprime les objets après 60 jours (durée de conservation des sauvegardes, à ajuster).
6. **R2 → Manage API tokens → Create API token** :
   - permission : _Object Read & Write_ ;
   - portée : uniquement les buckets `scout-prive` et `scout-public`.
7. Créer un second jeton, de même permission, limité au seul bucket `scout-sauvegardes`.
8. Noter l'**Account ID** et, pour chaque jeton, l'**Access Key ID** et le **Secret Access Key**. Les secrets ne sont affichés qu'une fois : les conserver dans un gestionnaire de mots de passe, jamais dans un courriel ni dans le dépôt.
9. Choisir une **phrase secrète de sauvegarde** (au moins 20 caractères) et l'enregistrer dans le gestionnaire de mots de passe. Elle chiffre les sauvegardes : **sans elle, aucune sauvegarde ne peut être relue**, y compris après la perte du VPS.
10. Générer, **une seule fois et sur votre poste** (pas sur le VPS), la paire de clés de l'administrateur plateforme :

    ```bash
    openssl ecparam -name prime256v1 -genkey -noout -out admin-prive.pem
    openssl ec -in admin-prive.pem -pubout -out admin-public.pem
    ```

    - `admin-prive.pem` : à conserver dans le gestionnaire de mots de passe. Elle ne servira qu'à l'installation district (section 13) et ne doit **jamais** être copiée sur l'installation paroisse.
    - `admin-public.pem` : à copier sur le VPS à l'étape 6.2. Elle ne permet que de vérifier les jetons de l'administrateur, pas d'en fabriquer.

## 3. Sauvegarder l'ancienne production

Même en repartant de zéro, on garde une archive complète de l'ancienne production, au cas où une donnée serait réclamée plus tard.

Sur le VPS :

```bash
cd /chemin/ancienne-installation
ARCHIVE=~/archive-scout-$(date +%Y%m%d)
mkdir -p "$ARCHIVE"

# Base de données (format compressé, restaurable avec pg_restore)
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db \
  pg_dump -U scout -Fc scout_db > "$ARCHIVE/base.dump"

# Fichiers téléversés et configuration
tar czf "$ARCHIVE/fichiers.tar.gz" my-app/uploads-prives my-app/uploads-publiques my-app/public/uploads 2>/dev/null
cp .env.prod my-app/.env "$ARCHIVE/" 2>/dev/null
sudo cp /etc/nginx/sites-available/* "$ARCHIVE/" 2>/dev/null

# Contrôle : la sauvegarde de la base ne doit pas être vide
ls -lh "$ARCHIVE"
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db pg_restore --list < "$ARCHIVE/base.dump" | head
```

Copier ensuite l'archive **hors du VPS**, depuis votre poste :

```bash
scp -r utilisateur@ip-du-vps:~/archive-scout-AAAAMMJJ .
```

L'archive contient des données personnelles (mineurs, fiches médicales) : la stocker chiffrée, avec un accès restreint.

## 4. Retirer l'ancienne production

```bash
# 4.1 Arrêter l'application
pm2 delete scout-ndpst
pm2 save

# 4.2 Désactiver son site Nginx (nom du fichier à adapter)
ls /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/<ancien-site>
sudo nginx -t && sudo systemctl reload nginx

# 4.3 Arrêter l'ancienne base (libère le conteneur scout_db et le port 5434).
#     SANS -v : le volume de données est conservé jusqu'à la section 12.
cd /chemin/ancienne-installation
docker compose --env-file .env.prod -f docker-compose.prod.yml down

# 4.4 Mettre l'ancien dossier de côté
mv /chemin/ancienne-installation /chemin/ancienne-installation.ancien
```

## 5. Préparer le serveur

```bash
node -v                     # 22.12 ou plus récent ; sinon installer Node.js 22 (NodeSource ou nvm)
npm -v                      # 10 ou plus récent (fourni avec Node.js)
pm2 -v || sudo npm install -g pm2
docker compose version
sudo nginx -v
certbot --version || sudo apt install certbot python3-certbot-nginx

# Pare-feu : seuls SSH, HTTP et HTTPS sont ouverts
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
sudo ufw status
```

## 6. Installer la nouvelle version

### 6.1 Récupérer le code

```bash
sudo mkdir -p /srv/scout-ascci && sudo chown "$USER" /srv/scout-ascci
git clone <url-du-depot> /srv/scout-ascci
cd /srv/scout-ascci
git checkout <tag-ou-commit-a-deployer>    # une version précise, pas « ce qu'il y a sur main »
```

### 6.2 Fichiers d'environnement

```bash
cp .env.prod.example .env.prod
cp apps/api/.env.example apps/api/.env
cp apps/web-paroisse/.env.example apps/web-paroisse/.env
chmod 600 .env.prod apps/api/.env apps/web-paroisse/.env

# Clé PUBLIQUE de l'administrateur plateforme (étape 2.10), depuis votre poste :
#   scp admin-public.pem utilisateur@ip-du-vps:/tmp/
sudo mkdir -p /etc/scout-ascci
sudo mv /tmp/admin-public.pem /etc/scout-ascci/admin-public.pem
sudo chmod 644 /etc/scout-ascci/admin-public.pem

# Secrets à générer (une valeur différente pour chacun)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Valeurs à renseigner :

| Fichier                  | Variable                                                         | Valeur                                                                                                  |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `.env.prod`              | `INSTALLATION`                                                   | `paroisse`                                                                                              |
|                          | `POSTGRES_PASSWORD`                                              | secret généré                                                                                           |
| `apps/api/.env`          | `NODE_ENV`                                                       | `production`                                                                                            |
|                          | `DATABASE_URL`                                                   | `postgresql://scout:<POSTGRES_PASSWORD>@127.0.0.1:5434/scout_db`                                        |
|                          | `JWT_ACCESS_SECRET`                                              | secret généré, propre à cette installation                                                              |
|                          | `INSTALLATION_ID`                                                | `paroisse-wiradjuri`                                                                                    |
|                          | `ADMIN_EMETTEUR_CONFIANCE`                                       | `district-abidjan` (identifiant que portera l'installation district)                                    |
|                          | `ADMIN_CLE_PUBLIQUE_FICHIER`                                     | `/etc/scout-ascci/admin-public.pem`                                                                     |
|                          | `URL_FRONTEND_PAROISSE`                                          | `https://paroisse.example.ci`                                                                           |
|                          | `TRUST_PROXY`                                                    | `loopback`                                                                                              |
|                          | `SWAGGER_ACTIF`                                                  | `false`                                                                                                 |
|                          | `CRON_SECRET`                                                    | secret généré (obligatoire)                                                                             |
|                          | `SMTP_*`                                                         | compte d'envoi des courriels (mot de passe oublié, bienvenue) ; `SMTP_HOST` et `SMTP_FROM` obligatoires |
|                          | `STORAGE_S3_BUCKET`                                              | `scout-prive`                                                                                           |
|                          | `STORAGE_S3_BUCKET_PUBLIC`                                       | `scout-public`                                                                                          |
|                          | `STORAGE_S3_REGION`                                              | `auto`                                                                                                  |
|                          | `STORAGE_S3_ENDPOINT`                                            | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`                                                         |
|                          | `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`       | premier jeton R2 (étape 2.6)                                                                            |
|                          | `SAUVEGARDE_S3_BUCKET`                                           | `scout-sauvegardes`                                                                                     |
|                          | `SAUVEGARDE_S3_ACCESS_KEY_ID`, `SAUVEGARDE_S3_SECRET_ACCESS_KEY` | second jeton R2 (étape 2.7)                                                                             |
|                          | `SAUVEGARDE_PHRASE`                                              | phrase secrète de l'étape 2.9                                                                           |
|                          | `SAUVEGARDE_ALERTE_EMAIL`                                        | adresse prévenue par courriel si une sauvegarde échoue                                                  |
|                          | `STORAGE_PUBLIC_URL_BASE`                                        | `https://fichiers.example.ci`                                                                           |
|                          | `STORAGE_DOSSIER_LOCAL`                                          | supprimer la ligne (inutilisé en production)                                                            |
| `apps/web-paroisse/.env` | `API_URL_INTERNE`                                                | `http://127.0.0.1:4000`                                                                                 |
|                          | `NEXT_PUBLIC_SITE_URL`                                           | `https://paroisse.example.ci`                                                                           |
|                          | `STORAGE_PUBLIC_URL_BASE`                                        | `https://fichiers.example.ci`                                                                           |

L'API vérifie cette configuration au démarrage. Une valeur manquante (R2 incomplet, secret trop court…) l'empêche de démarrer, avec un message qui nomme la variable en cause.

### 6.3 Déployer

```bash
./deploy-ovh.sh
```

Le script contrôle les fichiers d’environnement, la configuration R2 et celle des sauvegardes, démarre la base, installe les dépendances, compile l'API et l'espace paroisse, envoie une sauvegarde chiffrée de la base dans R2, applique les migrations, puis démarre `scout-api` et `scout-web`. Il s'arrête au premier problème avec un message explicite.

### 6.4 Initialiser la plateforme (une seule fois)

```bash
cd /srv/scout-ascci/apps/api
npm run initialiser -- --sans-admin
```

`--sans-admin` : aucun compte administrateur n'est créé ici, il sera hébergé par l'installation district. Le script demande, dans le terminal :

- le **district** et la **paroisse** ;
- le **Chef de Groupe** : il se connecte à `paroisse.example.ci` et gère la paroisse (membres, branches, logo et couleurs de la paroisse).

Les mots de passe sont saisis sans affichage (8 caractères minimum, avec une lettre et un chiffre). Le script refuse de s'exécuter si la base contient déjà des comptes.

## 7. Nginx et HTTPS

```bash
cd /srv/scout-ascci
sudo cp deploy/nginx-scout.conf /etc/nginx/sites-available/scout-ascci
sudo sed -i 's/paroisse\.example\.ci/VOTRE-DOMAINE/g' /etc/nginx/sites-available/scout-ascci

# Certificat (avant d'activer le site, qui y fait référence)
sudo certbot certonly --nginx -d VOTRE-DOMAINE
# En cas d'échec (« Could not automatically find a matching server block ») :
#   sudo systemctl stop nginx
#   sudo certbot certonly --standalone -d VOTRE-DOMAINE
#   sudo systemctl start nginx
# puis adapter les chemins ssl_certificate de la configuration au dossier créé
# (sudo certbot certificates les affiche).

sudo ln -s /etc/nginx/sites-available/scout-ascci /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --dry-run      # le renouvellement automatique fonctionne
```

## 8. Persistance et journaux

```bash
pm2 startup          # exécuter la commande affichée, une seule fois
pm2 save
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
```

### 8.1 Sauvegarde quotidienne de la base

Programmer la sauvegarde chiffrée chaque nuit à 2 h 30 (heure du serveur) :

```bash
crontab -e
```

Ajouter la ligne suivante (une seule ligne) :

```text
30 2 * * * cd /srv/scout-ascci/apps/api && /usr/bin/env npm run sauvegarder >> "$HOME/sauvegarde-scout.log" 2>&1
```

Deux conditions pour que la tâche fonctionne sous cron :

- l'utilisateur appartient au groupe `docker` (`groups` doit l'afficher), car la sauvegarde lit la base dans son conteneur ;
- `npm` est accessible avec le PATH minimal de cron. Si Node.js est installé avec nvm, remplacer `/usr/bin/env npm` par le chemin complet donné par `which npm`.

Lancer une fois la commande à la main pour vérifier, puis le lendemain contrôler le journal. Le journal `~/sauvegarde-scout.log` contient une ligne par sauvegarde : `sauvegarde.terminee` en cas de succès, `sauvegarde.echec` avec la cause sinon. Le consulter régulièrement (`tail ~/sauvegarde-scout.log`).

### 8.2 Purge quotidienne des données expirées

Les sessions de connexion et les liens de réinitialisation expirés depuis plus de 7 jours sont supprimés par la tâche `POST /api/cron/purge`, protégée par `CRON_SECRET`. Dans le même `crontab -e`, ajouter (une seule ligne, `<CRON_SECRET>` étant la valeur de `apps/api/.env`) :

```text
15 3 * * * curl -fsS -X POST -H "x-cron-secret: <CRON_SECRET>" http://127.0.0.1:4000/api/cron/purge >> "$HOME/purge-scout.log" 2>&1
```

La crontab est lisible par le seul utilisateur qui la possède : le secret n'y est pas exposé aux autres comptes du serveur. Chaque exécution ajoute au journal une ligne `{"sessions":…,"jetonsReinitialisation":…}`.

### 8.3 Durées de conservation (loi n° 2013-450)

La même tâche `POST /api/cron/purge` applique, **si elles sont renseignées** dans `apps/api/.env`, les durées de conservation fixées par l'association (en jours, 365 minimum) :

| Variable                              | Effet                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RETENTION_AUDIT_JOURS`               | supprime les entrées du journal d'audit plus anciennes                                                                                                                                                                                                                                                  |
| `ANONYMISATION_SCOUTS_INACTIFS_JOURS` | anonymise les scouts inactifs depuis plus longtemps : nom, matricule, photo, données de santé, contacts, liens parents, documents et fichiers disparaissent ; restent la branche, le sexe, l'année de naissance, les présences, progressions et cotisations (sans commentaire libre). **Irréversible.** |

Vides, ces variables ne suppriment rien. Avant de les renseigner, faire valider les durées par l'association et vérifier qu'une sauvegarde récente existe.

### 8.4 Surveillance de disponibilité

Une sonde **extérieure au VPS** (un VPS arrêté ne peut pas signaler sa propre panne) doit interroger régulièrement, par exemple toutes les 5 minutes avec alerte par courriel :

- `https://paroisse.example.ci/api/sante` et `https://district.example.ci/api/sante` : réponse `{"statut":"ok"}` (API et base joignables) ;
- `https://paroisse.example.ci/login` et `https://district.example.ci/login` : code 200 (frontend en ligne).

Tout service de surveillance HTTP convient (offres gratuites suffisantes). Ajouter aussi une alerte d'expiration des certificats si le service la propose.

### 8.5 Redis (facultatif)

Les compteurs de tentatives (connexion, mot de passe oublié) sont en mémoire : c'est suffisant tant que chaque API tourne en **une seule instance** pm2, ce qui est la configuration fournie. Pour passer une API en plusieurs instances, installer Redis sur le VPS (`sudo apt install redis-server`, écoute sur `127.0.0.1` uniquement) et renseigner `REDIS_URL="redis://127.0.0.1:6379"` dans son `apps/api/.env`. Les clés sont préfixées par `INSTALLATION_ID` : paroisse et district peuvent partager le même Redis. Si Redis devient injoignable, l'API repasse d'elle-même sur les compteurs en mémoire.

## 9. Vérifier

| Contrôle         | Commande ou action                                                                              | Attendu                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Processus        | `pm2 ls`                                                                                        | `scout-api` et `scout-web` `online`, compteur de redémarrages stable après 5 minutes |
| API              | `curl -fsS http://127.0.0.1:4000/api/sante`                                                     | `{"statut":"ok"}`                                                                    |
| Journaux         | `pm2 logs --lines 50`                                                                           | aucune erreur au démarrage                                                           |
| Espace paroisse  | connexion du Chef de Groupe sur `https://paroisse.example.ci`                                   | tableau de bord affiché                                                              |
| Fichiers publics | téléverser le logo depuis la fiche de la paroisse                                               | logo affiché, adresse en `https://fichiers.example.ci/public/…`                      |
| Fichiers privés  | ajouter la photo d'un scout                                                                     | photo affichée ; objet visible dans `scout-prive` sur Cloudflare                     |
| Rien sur le VPS  | `ls /srv/scout-ascci/apps/api/uploads-* 2>&1`                                                   | « No such file or directory »                                                        |
| Certificat       | `sudo certbot certificates`                                                                     | certificat valide pour `paroisse.example.ci`                                         |
| Sauvegarde       | `cd apps/api && npm run sauvegarder`                                                            | ligne `sauvegarde.terminee`                                                          |
| Relecture        | `npm run restaurer-sauvegarde -- --derniere --sortie /tmp/essai.dump` puis `rm /tmp/essai.dump` | « empreinte vérifiée » : la phrase secrète et la sauvegarde sont bonnes              |

## 10. Mises à jour suivantes

```bash
cd /srv/scout-ascci
git fetch --tags && git checkout <nouveau-tag>
./deploy-ovh.sh
```

Le script envoie une sauvegarde chiffrée de la base dans R2 avant chaque migration ; sans sauvegarde réussie, la migration n'est pas appliquée.

## 10 bis. Restaurer une sauvegarde de la base

À faire posément : une restauration remplace les données présentes dans la base cible. Restaurer d'abord dans une base de vérification, jamais directement en production sans l'avoir contrôlée.

```bash
cd /srv/scout-ascci/apps/api
npm run restaurer-sauvegarde -- --lister
npm run restaurer-sauvegarde -- --cle <clé choisie> --sortie /tmp/base.dump

# Vérification dans une base séparée
docker exec scout_db psql -U scout -d scout_db -c "create database scout_verification"
docker exec -i scout_db pg_restore -U scout -d scout_verification --no-owner < /tmp/base.dump
docker exec scout_db psql -U scout -d scout_verification -c 'select count(*) from "Utilisateur"'

# Une fois le contenu validé, et seulement alors : arrêter l'API, restaurer en production, redémarrer
pm2 stop scout-api
docker exec -i scout_db pg_restore -U scout -d scout_db --clean --if-exists --no-owner < /tmp/base.dump
pm2 start scout-api

# Nettoyage : le vidage contient des données personnelles
docker exec scout_db psql -U scout -d scout_db -c "drop database scout_verification"
rm /tmp/base.dump
```

Sur un nouveau serveur (VPS perdu), suivre les sections 5 et 6 sans l'étape 6.4, puis restaurer la dernière sauvegarde : il suffit de la configuration R2 et de la phrase secrète, conservées dans le gestionnaire de mots de passe.

Tester une restauration complète au moins une fois par trimestre : une sauvegarde jamais relue n'est pas une sauvegarde.

## 11. Retour arrière (avant la section 12 uniquement)

Si la nouvelle installation ne fonctionne pas et que l'ancienne doit être remise en ligne :

```bash
pm2 delete scout-api scout-web && pm2 save
cd /srv/scout-ascci && docker compose --env-file .env.prod -f docker-compose.prod.yml down
sudo rm /etc/nginx/sites-enabled/scout-ascci

mv /chemin/ancienne-installation.ancien /chemin/ancienne-installation
cd /chemin/ancienne-installation
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d db
cd my-app && pm2 start npm --name scout-ndpst --cwd "$PWD" -- run start -- -p 3002 && pm2 save
sudo ln -s /etc/nginx/sites-available/<ancien-site> /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 12. Nettoyage définitif de l'ancienne installation

**Après validation complète** de la nouvelle installation (au moins une semaine d'utilisation réelle), et une fois l'archive de la section 3 vérifiée hors du VPS :

```bash
# Repérer l'ancien volume : surtout PAS scout-ascci_postgres_data (nouvelle base)
docker volume ls | grep postgres_data
docker volume rm <ancien-volume>
rm -rf /chemin/ancienne-installation.ancien
rm -rf ~/archive-scout-AAAAMMJJ        # la copie hors VPS fait foi
```

Ces commandes sont irréversibles.

## 13. Installation district

L'application district (`apps/web-district`) est une **installation autonome** sur le même VPS : même code que l'API, mais son propre clone, sa propre base, ses propres buckets et ses propres secrets. Elle héberge le compte unique de l'administrateur plateforme, qui y règle l'apparence et administre aussi l'installation paroisse depuis la même console.

| Élément                  | Paroisse                                           | District                                                    |
| ------------------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| Dossier                  | `/srv/scout-ascci`                                 | `/srv/scout-district`                                       |
| Base PostgreSQL (Docker) | `scout_db`, `127.0.0.1:5434`                       | `scout_district_db`, `127.0.0.1:5436`                       |
| API (pm2)                | `scout-api`, `127.0.0.1:4000`                      | `scout-district-api`, `127.0.0.1:4100`                      |
| Frontend (pm2)           | `scout-web`, `127.0.0.1:3002`                      | `scout-district-web`, `127.0.0.1:3004`                      |
| Domaine                  | `paroisse.example.ci`                              | `district.example.ci`                                       |
| Buckets R2               | `scout-prive`, `scout-public`, `scout-sauvegardes` | `district-prive`, `district-public`, `district-sauvegardes` |
| Clé de l'administrateur  | publique seulement                                 | **privée** (`admin-prive.pem`)                              |

`deploy-ovh.sh` refuse de déployer un district qui viserait la base, le conteneur ou l'API de la paroisse, et refuse une clé privée d'administrateur sur la paroisse.

### 13.1 Domaine et Cloudflare R2

1. DNS : `district.example.ci` → adresse IP du VPS (enregistrement A), et un domaine public pour ses fichiers (par exemple `fichiers-district.example.ci`), configuré depuis Cloudflare.
2. R2 : refaire les étapes 2.1 à 2.8 avec les buckets `district-prive`, `district-public` et `district-sauvegardes`, et **deux nouveaux jetons** limités à ces buckets. Ne jamais réutiliser les jetons de la paroisse.
3. Choisir une phrase secrète de sauvegarde propre au district et l'enregistrer dans le gestionnaire de mots de passe.

### 13.2 Code et fichiers d'environnement

```bash
sudo mkdir -p /srv/scout-district && sudo chown "$USER" /srv/scout-district
git clone <url-du-depot> /srv/scout-district
cd /srv/scout-district
git checkout <tag-ou-commit-a-deployer>      # le même que la paroisse

cp .env.prod.example .env.prod
cp apps/api/.env.example apps/api/.env
cp apps/web-district/.env.example apps/web-district/.env
chmod 600 .env.prod apps/api/.env apps/web-district/.env

# Clé PRIVÉE de l'administrateur plateforme (étape 2.10), depuis votre poste :
#   scp admin-prive.pem utilisateur@ip-du-vps:/tmp/
sudo mv /tmp/admin-prive.pem /etc/scout-ascci/admin-prive.pem
sudo chown "$USER" /etc/scout-ascci/admin-prive.pem
sudo chmod 600 /etc/scout-ascci/admin-prive.pem
```

Valeurs à renseigner (celles qui ne figurent pas ici suivent le tableau de la section 6.2, avec les buckets et jetons du district) :

| Fichier                  | Variable                                                 | Valeur                                                                                                           |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.env.prod`              | `INSTALLATION`                                           | `district`                                                                                                       |
|                          | `POSTGRES_PASSWORD`                                      | secret généré, **différent** de celui de la paroisse                                                             |
|                          | `COMPOSE_PROJET`                                         | `scout-district`                                                                                                 |
|                          | `CONTENEUR_DB`                                           | `scout_district_db`                                                                                              |
|                          | `PORT_DB`                                                | `5436`                                                                                                           |
| `apps/api/.env`          | `DATABASE_URL`                                           | `postgresql://scout:<POSTGRES_PASSWORD>@127.0.0.1:5436/scout_db`                                                 |
|                          | `JWT_ACCESS_SECRET`                                      | secret généré, **différent** : une session paroisse ne doit jamais être acceptée par le district, et inversement |
|                          | `INSTALLATION_ID`                                        | `district-abidjan` (la valeur de `ADMIN_EMETTEUR_CONFIANCE` côté paroisse)                                       |
|                          | `ADMIN_CLE_PRIVEE_FICHIER`                               | `/etc/scout-ascci/admin-prive.pem`                                                                               |
|                          | `ADMIN_EMETTEUR_CONFIANCE`, `ADMIN_CLE_PUBLIQUE_FICHIER` | supprimer les lignes (le district émet les jetons, il ne fait confiance à aucune autre installation)             |
|                          | `URL_FRONTEND_PAROISSE`                                  | `https://district.example.ci`                                                                                    |
|                          | `CRON_SECRET`                                            | secret généré, propre au district                                                                                |
|                          | `STORAGE_S3_*`, `STORAGE_PUBLIC_URL_BASE`                | buckets, jetons et domaine public du district                                                                    |
|                          | `SAUVEGARDE_S3_*`, `SAUVEGARDE_PHRASE`                   | bucket, jeton et phrase du district                                                                              |
|                          | `SAUVEGARDE_CONTENEUR`                                   | `scout_district_db`                                                                                              |
| `apps/web-district/.env` | `API_URL_INTERNE`                                        | `http://127.0.0.1:4100`                                                                                          |
|                          | `NEXT_PUBLIC_SITE_URL`                                   | `https://district.example.ci`                                                                                    |
|                          | `STORAGE_PUBLIC_URL_BASE`                                | domaine public des fichiers du district                                                                          |
|                          | `INSTALLATIONS_GEREES`                                   | `'[{"id":"paroisse-wiradjuri","nom":"Paroisse Wiradjuri","api":"http://127.0.0.1:4000"}]'`                       |

### 13.3 Déployer, initialiser, publier

```bash
cd /srv/scout-district
./deploy-ovh.sh

cd apps/api
npm run initialiser                # AVEC l'administrateur plateforme, cette fois

cd /srv/scout-district
sudo cp deploy/nginx-district.conf /etc/nginx/sites-available/scout-district
sudo sed -i 's/district\.example\.ci/VOTRE-DOMAINE-DISTRICT/g' /etc/nginx/sites-available/scout-district
sudo certbot certonly --nginx -d VOTRE-DOMAINE-DISTRICT
sudo ln -s /etc/nginx/sites-available/scout-district /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Tâches planifiées du district, dans la même crontab que celles de la paroisse :

```text
45 2 * * * cd /srv/scout-district/apps/api && /usr/bin/env npm run sauvegarder >> "$HOME/sauvegarde-district.log" 2>&1
20 3 * * * curl -fsS -X POST -H "x-cron-secret: <CRON_SECRET du district>" http://127.0.0.1:4100/api/cron/purge >> "$HOME/purge-district.log" 2>&1
```

### 13.4 Vérifier

| Contrôle                      | Commande ou action                                              | Attendu                                                        |
| ----------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| Processus                     | `pm2 ls`                                                        | les quatre processus `online`                                  |
| API district                  | `curl -fsS http://127.0.0.1:4100/api/sante`                     | `{"statut":"ok"}`                                              |
| Bases distinctes              | `docker ps --format '{{.Names}} {{.Ports}}'`                    | `scout_db` sur 5434 **et** `scout_district_db` sur 5436        |
| Console                       | connexion de l'administrateur sur `https://district.example.ci` | console d'administration affichée                              |
| Administration de la paroisse | choisir « Paroisse Wiradjuri » dans le menu                     | bandeau affiché ; les membres de la paroisse apparaissent      |
| Sauvegarde                    | `cd apps/api && npm run sauvegarder`                            | ligne `sauvegarde.terminee`, objet dans `district-sauvegardes` |

Une fois connecté à la console district, l'administrateur choisit « Paroisse Wiradjuri » dans le menu : les écrans d'administration agissent alors sur la base de la paroisse, et un bandeau le rappelle en permanence. Ses actions y sont journalisées comme celles d'un acteur externe (`acteurExterneId` dans le journal d'audit de la paroisse).

Mises à jour : déployer **les deux clones sur le même tag**, la paroisse d'abord (`cd /srv/scout-ascci && ./deploy-ovh.sh`), puis le district (`cd /srv/scout-district && ./deploy-ovh.sh`).

## Points ouverts

- **Durées de conservation à décider.** Le mécanisme est en place (section 8.3) mais désactivé : l'association doit fixer les durées, puis les renseigner.
- **Déclaration à l'ARTCI.** Le traitement de données de mineurs, dont des données de santé, relève de la loi n° 2013-450 : la déclaration ou la demande d'autorisation auprès de l'ARTCI est à faire par l'association, hors du code.
- **Sonde de disponibilité.** À créer chez un service de surveillance (section 8.4).
- **Rappels de documents.** La tâche planifiée `POST /api/cron/rappels-documents` (en-tête `x-cron-secret`) est hors du périmètre V1 et n'est pas programmée. Chaque document n'est rappelé qu'une fois : elle pourra être lancée chaque jour le moment venu.
- **Anciennes images de `apps/web-paroisse/public/uploads/`.** À supprimer du dépôt une fois leur reprise dans R2 confirmée (`npm run fichiers:migrer-r2`).
