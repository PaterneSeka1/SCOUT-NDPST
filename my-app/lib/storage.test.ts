import { describe, it, expect, afterEach } from 'vitest'
import { cleFichierPublic, cleFichierPrive, urlPubliqueBase } from './storage'

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
