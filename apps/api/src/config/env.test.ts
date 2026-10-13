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

const charger = (valeurs: Record<string, string>) => () => chargerEnv(valeurs as NodeJS.ProcessEnv)

describe('chargerEnv — stockage', () => {
  it('refuse la production sans stockage externe', () => {
    expect(charger({ ...BASE, NODE_ENV: 'production' })).toThrow(/STORAGE_S3_BUCKET/)
  })

  it('accepte la production avec Cloudflare R2 complet', () => {
    expect(charger({ ...BASE, ...R2, NODE_ENV: 'production' })).not.toThrow()
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
