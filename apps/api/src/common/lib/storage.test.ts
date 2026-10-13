import { describe, it, expect, afterEach, vi } from 'vitest'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { cleFichierPublic, cleFichierPrive, sauvegarderFichierPublic, urlPubliqueBase } from './storage'

describe('cleFichierPublic / cleFichierPrive', () => {
  it('construit des clés d\'objet S3 stables et prévisibles', () => {
    expect(cleFichierPublic('logo-123.png')).toBe('public/logo-123.png')
    expect(cleFichierPrive('paroisse-1', 'doc-456.pdf')).toBe('prive/paroisse-1/doc-456.pdf')
  })
})

describe('urlPubliqueBase', () => {
  const original = { ...process.env }
  afterEach(() => {
    process.env = { ...original }
  })

  it('renvoie null quand aucun bucket S3 n\'est configuré (mode disque local)', () => {
    delete process.env.STORAGE_S3_BUCKET
    delete process.env.STORAGE_PUBLIC_URL_BASE
    expect(urlPubliqueBase()).toBeNull()
  })

  it('renvoie null si un bucket est configuré mais sans URL publique de base', () => {
    process.env.STORAGE_S3_BUCKET = 'mon-bucket'
    delete process.env.STORAGE_PUBLIC_URL_BASE
    expect(urlPubliqueBase()).toBeNull()
  })

  it('renvoie l\'URL de base sans slash final quand S3 est actif', () => {
    process.env.STORAGE_S3_BUCKET = 'mon-bucket'
    process.env.STORAGE_PUBLIC_URL_BASE = 'https://cdn.example.com/'
    expect(urlPubliqueBase()).toBe('https://cdn.example.com')
  })
})

describe('sauvegarderFichierPublic (S3)', () => {
  const variables = ['STORAGE_S3_BUCKET', 'STORAGE_S3_BUCKET_PUBLIC', 'STORAGE_PUBLIC_URL_BASE'] as const
  const sauvegarde = Object.fromEntries(variables.map((v) => [v, process.env[v]]))

  afterEach(() => {
    vi.restoreAllMocks()
    for (const v of variables) {
      if (sauvegarde[v] === undefined) delete process.env[v]
      else process.env[v] = sauvegarde[v]
    }
  })

  it('n’envoie pas d’ACL vers un bucket public dédié (Cloudflare R2) et renvoie l’URL publique', async () => {
    process.env.STORAGE_S3_BUCKET = 'scout-prive'
    process.env.STORAGE_S3_BUCKET_PUBLIC = 'scout-public'
    process.env.STORAGE_PUBLIC_URL_BASE = 'https://fichiers.exemple.ci/'
    const envoi = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never)

    const url = await sauvegarderFichierPublic('logo.png', Buffer.from('x'), 'image/png')

    const commande = envoi.mock.calls[0][0] as PutObjectCommand
    expect(commande.input).toMatchObject({ Bucket: 'scout-public', Key: 'public/logo.png' })
    expect(commande.input.ACL).toBeUndefined()
    expect(url).toBe('https://fichiers.exemple.ci/public/logo.png')
  })

  it('garde l’ACL public-read avec un bucket unique (AWS S3)', async () => {
    process.env.STORAGE_S3_BUCKET = 'bucket-unique'
    delete process.env.STORAGE_S3_BUCKET_PUBLIC
    process.env.STORAGE_PUBLIC_URL_BASE = 'https://cdn.exemple.ci'
    const envoi = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never)

    await sauvegarderFichierPublic('logo.png', Buffer.from('x'), 'image/png')

    expect((envoi.mock.calls[0][0] as PutObjectCommand).input.ACL).toBe('public-read')
  })
})
