import { z } from 'zod'

// Variables d'environnement de l'API, validées au démarrage : un secret
// manquant ou trop court doit empêcher le lancement, pas faire échouer la
// première requête en production.
// Une ligne « CLE= » du .env vaut absence de valeur, pas chaîne vide à valider.
const videEnAbsent = (valeur: unknown) => (typeof valeur === 'string' && valeur.trim() === '' ? undefined : valeur)

const SchemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // Docker exige une écoute sur l'interface du conteneur ; PM2 sur l'hôte
  // impose 127.0.0.1 dans ses fichiers ecosystem.
  HOST: z.enum(['0.0.0.0', '127.0.0.1', '::', '::1']).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),

  // Secret de signature des jetons d'accès (HS256). Distinct de tout autre
  // secret, au moins 32 caractères.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères'),
  // Durées de vie : jeton d'accès court (le rôle et le statut actif sont
  // relus en base à chaque rafraîchissement), session totale de 12 h.
  JWT_ACCESS_TTL_SECONDES: z.coerce.number().int().min(60).max(3600).default(300),

  // Identifiant de cette installation (ex. « district-abidjan »,
  // « paroisse-wiradjuri ») : émetteur (iss) des jetons qu'elle signe.
  INSTALLATION_ID: z
    .string()
    .regex(/^[a-z0-9-]{3,40}$/, 'minuscules, chiffres et tirets uniquement (3 à 40 caractères)')
    .default('scout-ascci-api'),
  // Administrateur plateforme unique pour plusieurs installations :
  // - l'installation qui HÉBERGE le compte (district) signe ses jetons avec
  //   une clé privée ECDSA P-256 (ADMIN_CLE_PRIVEE_FICHIER) ;
  // - les installations qu'il ADMINISTRE (paroisse) n'ont que la clé publique
  //   correspondante et l'identifiant de l'émetteur : elles vérifient ces
  //   jetons sans pouvoir en fabriquer, et seulement pour ADMIN_PLATEFORME.
  ADMIN_CLE_PRIVEE_FICHIER: z.string().optional(),
  ADMIN_EMETTEUR_CONFIANCE: z.string().optional(),
  ADMIN_CLE_PUBLIQUE_FICHIER: z.string().optional(),
  // URL fixe de /api/auth/session sur l'installation émettrice. Aucun hôte
  // n'est dérivé d'un jeton ou d'une entrée utilisateur.
  ADMIN_URL_VERIFICATION_SESSION: z.preprocess(videEnAbsent, z.string().url().optional()),
  SESSION_TTL_SECONDES: z.coerce
    .number()
    .int()
    .min(600)
    .max(7 * 24 * 3600)
    .default(12 * 3600),

  // Origines autorisées à appeler l'API avec des cookies (frontends des
  // différentes plateformes), séparées par des virgules. Vide = aucune
  // requête cross-origin (cas du frontend paroissial, qui passe par son
  // propre proxy /api et reste donc same-origin).
  CORS_ORIGINES: z.string().default(''),
  // Domaine des cookies de session (ex. ".scout-ascci.ci" pour partager la
  // session entre sous-domaines). Vide = cookie limité à l'hôte appelant.
  COOKIE_DOMAINE: z.string().optional(),
  // URL publique du frontend paroissial : utilisée dans les liens envoyés par
  // e-mail (réinitialisation de mot de passe).
  URL_FRONTEND_PAROISSE: z.string().url().default('http://localhost:3000'),

  // Proxys de confiance devant l'API (Nginx, puis le proxy Next.js) pour lire
  // la véritable IP client dans X-Forwarded-For : un nombre de sauts, ou une
  // valeur nommée d'Express ("loopback" quand tout tourne sur la même machine).
  TRUST_PROXY: z
    .string()
    .default('loopback')
    .transform((v) => (/^\d+$/.test(v) ? Number(v) : v)),
  SWAGGER_ACTIF: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  CRON_SECRET: z.string().min(16).optional(),

  // Durées de conservation (loi n° 2013-450), en jours, appliquées par la
  // tâche quotidienne POST /api/cron/purge. Non définies = rien n'est supprimé :
  // ces durées relèvent d'une décision de l'association, pas d'un défaut technique.
  RETENTION_AUDIT_JOURS: z.preprocess(videEnAbsent, z.coerce.number().int().min(365).optional()),
  ANONYMISATION_SCOUTS_INACTIFS_JOURS: z.preprocess(videEnAbsent, z.coerce.number().int().min(365).optional()),
  // Redis facultatif : limitation de débit partagée entre plusieurs instances.
  // Sans REDIS_URL, compteurs en mémoire (une seule instance de l'API).
  REDIS_URL: z.preprocess(videEnAbsent, z.string().url().optional()),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Stockage : S3 compatible (Cloudflare R2 en production) si STORAGE_S3_BUCKET
  // est défini, disque local sinon (développement uniquement, voir plus bas).
  STORAGE_DOSSIER_LOCAL: z.string().optional(),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_BUCKET_PUBLIC: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_S3_FORCE_PATH_STYLE: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL_BASE: z.string().optional(),
})

// Valeur renseignée et non vide (une ligne « CLE="" » du .env compte comme absente).
const renseigne = (valeur: string | undefined) => !!valeur?.trim()

const SchemaEnvValide = SchemaEnv.superRefine((cfg, ctx) => {
  const manque = (cle: keyof typeof cfg, message: string) => ctx.addIssue({ code: 'custom', path: [cle], message })

  // Production : aucun fichier sur le serveur. Les documents (photos, fiches
  // médicales, autorisations) vivent dans le stockage externe, pour qu'un
  // VPS perdu ou réinstallé ne fasse perdre aucun document.
  if (cfg.NODE_ENV === 'production' && !renseigne(cfg.STORAGE_S3_BUCKET)) {
    manque('STORAGE_S3_BUCKET', 'stockage externe obligatoire en production (aucun fichier sur le serveur)')
  }

  // Production : ce qui, mal réglé, échouerait sans bruit. Liens des e-mails
  // pointant vers localhost, réinitialisation de mot de passe impossible faute
  // de SMTP, tâches planifiées appelables sans secret.
  if (cfg.NODE_ENV === 'production') {
    if (!cfg.URL_FRONTEND_PAROISSE.startsWith('https://') || /localhost|127.0.0.1/.test(cfg.URL_FRONTEND_PAROISSE)) {
      manque('URL_FRONTEND_PAROISSE', 'URL publique en https obligatoire en production (liens des e-mails)')
    }
    if (!renseigne(cfg.SMTP_HOST))
      manque('SMTP_HOST', 'serveur SMTP obligatoire en production (réinitialisation du mot de passe)')
    if (!renseigne(cfg.SMTP_FROM)) manque('SMTP_FROM', "adresse d'expédition obligatoire en production")
    if (!renseigne(cfg.CRON_SECRET)) manque('CRON_SECRET', 'secret des tâches planifiées obligatoire en production')
  }

  if (renseigne(cfg.ADMIN_EMETTEUR_CONFIANCE) !== renseigne(cfg.ADMIN_CLE_PUBLIQUE_FICHIER)) {
    manque('ADMIN_CLE_PUBLIQUE_FICHIER', 'ADMIN_EMETTEUR_CONFIANCE et ADMIN_CLE_PUBLIQUE_FICHIER vont ensemble')
  }
  if (renseigne(cfg.ADMIN_EMETTEUR_CONFIANCE) && cfg.ADMIN_EMETTEUR_CONFIANCE === cfg.INSTALLATION_ID) {
    manque('ADMIN_EMETTEUR_CONFIANCE', 'doit désigner une AUTRE installation que celle-ci')
  }
  if (cfg.NODE_ENV === 'production' && renseigne(cfg.ADMIN_EMETTEUR_CONFIANCE) && !cfg.ADMIN_URL_VERIFICATION_SESSION) {
    manque('ADMIN_URL_VERIFICATION_SESSION', 'URL de revalidation de l’émetteur obligatoire avec un administrateur externe')
  }
  if (cfg.ADMIN_URL_VERIFICATION_SESSION) {
    const url = new URL(cfg.ADMIN_URL_VERIFICATION_SESSION)
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    ) {
      manque('ADMIN_URL_VERIFICATION_SESSION', 'HTTPS ou HTTP loopback requis, sans identifiants ni paramètres')
    }
  }

  if (renseigne(cfg.STORAGE_S3_BUCKET)) {
    if (!renseigne(cfg.STORAGE_S3_ACCESS_KEY_ID)) manque('STORAGE_S3_ACCESS_KEY_ID', 'requis avec STORAGE_S3_BUCKET')
    if (!renseigne(cfg.STORAGE_S3_SECRET_ACCESS_KEY)) {
      manque('STORAGE_S3_SECRET_ACCESS_KEY', 'requis avec STORAGE_S3_BUCKET')
    }
    // Sans URL publique, les logos et images d'accueil téléversés seraient
    // enregistrés avec une adresse que le navigateur ne peut pas ouvrir.
    if (!renseigne(cfg.STORAGE_PUBLIC_URL_BASE) || !URL.canParse(cfg.STORAGE_PUBLIC_URL_BASE!)) {
      manque('STORAGE_PUBLIC_URL_BASE', 'URL publique du bucket des fichiers publics requise avec STORAGE_S3_BUCKET')
    }
    if (renseigne(cfg.STORAGE_S3_BUCKET_PUBLIC) && cfg.STORAGE_S3_BUCKET_PUBLIC === cfg.STORAGE_S3_BUCKET) {
      manque('STORAGE_S3_BUCKET_PUBLIC', 'doit être distinct du bucket privé (documents des scouts)')
    }
  }
})

export type Env = z.infer<typeof SchemaEnv>

let envValidee: Env | null = null

export function chargerEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const resultat = SchemaEnvValide.safeParse(source)
  if (!resultat.success) {
    const details = resultat.error.issues.map((i) => `  - ${i.path.join('.')} : ${i.message}`).join('\n')
    throw new Error(`Configuration invalide :\n${details}`)
  }
  envValidee = resultat.data
  return envValidee
}

// Accès typé à la configuration déjà validée (chargée une fois dans main.ts).
export function env(): Env {
  return envValidee ?? chargerEnv()
}
