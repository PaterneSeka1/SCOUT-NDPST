// Processus PM2 de production de l'installation PAROISSE (VPS OVH).
// L'application district aura sa propre installation (API, base et buckets
// distincts) : voir docs/deploiement-ovh.md, « Installation district ».
//
// Les secrets ne sont jamais ici : chaque application lit son propre fichier
// .env (apps/api/.env, apps/web-paroisse/.env), lisible uniquement par
// l'utilisateur système de l'application.
//
// Usage, depuis la racine du dépôt :
//   pm2 startOrReload deploy/ecosystem.config.cjs --env production && pm2 save
const path = require('path')

const RACINE = path.join(__dirname, '..')

module.exports = {
  apps: [
    {
      // API NestJS : une seule instance (fork). La limitation de débit
      // (connexion, mot de passe oublié) est en mémoire : plusieurs instances
      // multiplieraient les tentatives autorisées. Passer à Redis avant de
      // monter en cluster.
      name: 'scout-api',
      cwd: path.join(RACINE, 'apps/api'),
      script: 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      listen_timeout: 15000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
    {
      // Frontend paroissial Next.js : relaie /api/* vers scout-api.
      name: 'scout-web',
      cwd: path.join(RACINE, 'apps/web-paroisse'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002 -H 127.0.0.1',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: 'production',
        API_URL_INTERNE: 'http://127.0.0.1:4000',
      },
    },
  ],
}
