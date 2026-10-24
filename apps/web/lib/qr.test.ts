import { describe, it, expect } from 'vitest'
import { encoderQrScout, decoderQrScout } from './qr'

describe('encoderQrScout / decoderQrScout', () => {
  it('encode puis décode le même id', () => {
    const contenu = encoderQrScout('abc123')
    expect(decoderQrScout(contenu)).toBe('abc123')
  })

  it('renvoie null pour un contenu sans le bon préfixe', () => {
    expect(decoderQrScout('https://example.com')).toBeNull()
    expect(decoderQrScout('abc123')).toBeNull()
  })

  it('renvoie null si l\'id est vide après le préfixe', () => {
    expect(decoderQrScout('SCOUT-ASCCI:scout:')).toBeNull()
  })
})
