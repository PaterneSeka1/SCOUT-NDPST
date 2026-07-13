import { describe, it, expect } from 'vitest'
import { detecterTypeFichier } from './fileSignature'

describe('detecterTypeFichier', () => {
  it('reconnaît un PNG à partir de sa signature réelle', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
    expect(detecterTypeFichier(png)).toEqual({ mime: 'image/png', ext: 'png' })
  })

  it('reconnaît un JPEG', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
    expect(detecterTypeFichier(jpeg)).toEqual({ mime: 'image/jpeg', ext: 'jpg' })
  })

  it('reconnaît un PDF', () => {
    const pdf = Buffer.from('%PDF-1.4\n...', 'latin1')
    expect(detecterTypeFichier(pdf)).toEqual({ mime: 'application/pdf', ext: 'pdf' })
  })

  it('reconnaît un WebP', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF', 'latin1'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP', 'latin1'),
    ])
    expect(detecterTypeFichier(webp)).toEqual({ mime: 'image/webp', ext: 'webp' })
  })

  it("rejette un SVG déguisé en .png (Content-Type déclaré usurpé, octets réels non image)", () => {
    const svgDeguise = Buffer.from('<svg onload="alert(1)"></svg>', 'utf-8')
    expect(detecterTypeFichier(svgDeguise)).toBeNull()
  })

  it('rejette un fichier vide ou trop court', () => {
    expect(detecterTypeFichier(Buffer.alloc(0))).toBeNull()
  })
})
