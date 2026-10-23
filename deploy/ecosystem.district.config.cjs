// Processus PM2 de production de l'installation DISTRICT (VPS OVH), dans son
// propre clone (par exemple /srv/scout-district) : API, base et buckets
// distincts de l'installation paroisse. Voir docs/deploiement-ovh.md, section 13.
//
// Ports choisis pour cohabiter avec la paroisse sur le même VPS :
//   - API district : 127.0.0.1:4100 (paroisse : 4000) ;
//   - frontend district : 127.0.0.1:3004 (paroisse : 3002).
//
// Les secrets ne sont jamais ici : chaque application lit son propre fichier
// .env (apps/api/.env, apps/web-district/.env) du clone district.
//
// Usage, depuis la racine du clone district :
//   pm2 startOrReload deploy/ecosystem.district.config.cjs --env production && pm2 save
const path = require('path')

const RACINE = path.join(__dirname, '..')

module.exports = {
  apps: [
    {
      // Une seule instance (fork) : la limitation de débit est en mémoire.
      name: 'scout-district-api',
      cwd: path.join(RACINE, 'apps/api'),
      script: 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      listen_timeout: 15000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 4100,
        HOST: '127.0.0.1',
      },
    },
    {
      // Console district Next.js : relaie /api/* vers scout-district-api, ou
      // vers l'API d'une installation administrée (INSTALLATIONS_GEREES).
      name: 'scout-district-web',
      cwd: path.join(RACINE, 'apps/web-district'),
      // Workspaces npm : next est remonté à la racine du dépôt.
      script: require.resolve('next/dist/bin/next', { paths: [path.join(RACINE, 'apps/web-district')] }),
      args: 'start -p 3004 -H 127.0.0.1',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: 'production',
        API_URL_INTERNE: 'http://127.0.0.1:4100',
      },
    },
  ],
}
