import { describe, expect, it } from 'vitest'
import { chargerEnv } from './env'

const BASE = {
  DATABASE_URL: 'postgresql://test',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
}

const R2 = {
  STORAGE_S3_BUCKET: 'scout-prive',
  STORAGE_S3_BUCKET_PUBLIC: 'scout-public',
  STORAGE_S3_ENDPOINT: 'https://compte.r2.cloudflarestorage.com',
  STORAGE_S3_ACCESS_KEY_ID: 'cle',
  STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
  STORAGE_PUBLIC_URL_BASE: 'https://fichiers.exemple.ci',
}

// Réglages obligatoires en production, hors stockage.
const PROD = {
  NODE_ENV: 'production',
  URL_FRONTEND_PAROISSE: 'https://paroisse.exemple.ci',
  SMTP_HOST: 'smtp.exemple.ci',
  SMTP_FROM: 'noreply@exemple.ci',
  CRON_SECRET: 'c'.repeat(20),
}

const charger = (valeurs: Record<string, string>) => () => chargerEnv(valeurs as NodeJS.ProcessEnv)

describe('chargerEnv — stockage', () => {
  it('refuse la production sans stockage externe', () => {
    expect(charger({ ...BASE, ...PROD })).toThrow(/STORAGE_S3_BUCKET/)
  })

  it('accepte la production avec Cloudflare R2 complet', () => {
    expect(charger({ ...BASE, ...R2, ...PROD })).not.toThrow()
  })

  it('accepte le disque local en développement', () => {
    expect(charger({ ...BASE, NODE_ENV: 'development' })).not.toThrow()
  })

  it('exige les clés d’accès et l’URL publique dès qu’un bucket est configuré', () => {
    const { STORAGE_S3_SECRET_ACCESS_KEY: _secret, STORAGE_PUBLIC_URL_BASE: _url, ...incomplet } = R2
    expect(charger({ ...BASE, ...incomplet })).toThrow(/STORAGE_S3_SECRET_ACCESS_KEY[\s\S]*STORAGE_PUBLIC_URL_BASE/)
  })

  it('refuse un bucket public identique au bucket privé', () => {
    expect(charger({ ...BASE, ...R2, STORAGE_S3_BUCKET_PUBLIC: 'scout-prive' })).toThrow(/distinct/)
  })
})

describe('chargerEnv — production', () => {
  it("refuse des liens d'e-mail vers localhost ou en http", () => {
    expect(charger({ ...BASE, ...R2, ...PROD, URL_FRONTEND_PAROISSE: 'http://localhost:3000' })).toThrow(
      /URL_FRONTEND_PAROISSE/,
    )
    const { URL_FRONTEND_PAROISSE: _url, ...sansUrl } = PROD
    expect(charger({ ...BASE, ...R2, ...sansUrl })).toThrow(/URL_FRONTEND_PAROISSE/)
  })

  it('exige le SMTP et le secret des tâches planifiées', () => {
    const { SMTP_HOST: _h, SMTP_FROM: _f, CRON_SECRET: _c, ...incomplet } = PROD
    expect(charger({ ...BASE, ...R2, ...incomplet })).toThrow(/SMTP_HOST[\s\S]*SMTP_FROM[\s\S]*CRON_SECRET/)
  })

  it('laisse ces réglages facultatifs en développement', () => {
    expect(charger({ ...BASE, NODE_ENV: 'development' })).not.toThrow()
  })
})

describe('chargerEnv — écoute et vérification fédérée', () => {
  it('préserve Docker et autorise le loopback imposé par PM2', () => {
    expect(chargerEnv(BASE).HOST).toBe('0.0.0.0')
    expect(chargerEnv({ ...BASE, HOST: '127.0.0.1' }).HOST).toBe('127.0.0.1')
    expect(charger({ ...BASE, HOST: 'hote-inattendu' })).toThrow(/HOST/)
  })

  it.each(['https://district.example.ci/api/auth/session', 'http://127.0.0.1:4100/api/auth/session'])(
    'accepte une cible de confiance fixe %s',
    (url) => {
      expect(chargerEnv({ ...BASE, ADMIN_URL_VERIFICATION_SESSION: url }).ADMIN_URL_VERIFICATION_SESSION).toBe(url)
    },
  )

  it.each([
    'http://district.example.ci/api/auth/session',
    'https://user:secret@district.example.ci/api/auth/session',
    'https://district.example.ci/api/auth/session?token=x',
  ])('refuse une cible non chiffrée ou contenant un secret %s', (url) => {
    expect(charger({ ...BASE, ADMIN_URL_VERIFICATION_SESSION: url })).toThrow(/ADMIN_URL_VERIFICATION_SESSION/)
  })
})


describe('configuration fédérée en production', () => {
  it('empêche la bascule sans URL de revalidation de l’émetteur', () => {
    expect(charger({
      ...BASE, ...R2, ...PROD,
      ADMIN_EMETTEUR_CONFIANCE: 'district-test',
      ADMIN_CLE_PUBLIQUE_FICHIER: '/tmp/cle-fictive.pem',
    })).toThrow(/ADMIN_URL_VERIFICATION_SESSION/)
  })
})
