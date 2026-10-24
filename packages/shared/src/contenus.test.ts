import { describe, expect, it } from 'vitest'
import { analyserContenu, estUrlHttps, mediaVisiblePublic, resumeAutomatique, slugifier, SLUG_REGEX } from './contenus'

describe('slugifier', () => {
  it('produit un slug ASCII sans accents', () => {
    expect(slugifier("Camp d'été 2026 : Éclaireurs à Grand-Bassam !")).toBe('camp-d-ete-2026-eclaireurs-a-grand-bassam')
    expect(SLUG_REGEX.test(slugifier('  Fête   de la Saint-Georges  '))).toBe(true)
  })
  it('renvoie une chaîne vide pour un texte sans caractère utile', () => {
    expect(slugifier('!!!')).toBe('')
  })
})

describe('analyserContenu', () => {
  it('découpe titres, paragraphes, listes et citations', () => {
    const blocs = analyserContenu('## Programme\nLigne 1\nsuite\n\n- un\n- deux\n> parole\n### Fin')
    expect(blocs).toEqual([
      { type: 'titre', niveau: 2, texte: 'Programme' },
      { type: 'paragraphe', texte: 'Ligne 1 suite' },
      { type: 'liste', elements: ['un', 'deux'] },
      { type: 'citation', texte: 'parole' },
      { type: 'titre', niveau: 3, texte: 'Fin' },
    ])
  })
  it("n'interprète jamais de HTML (le texte reste brut)", () => {
    expect(analyserContenu('<script>alert(1)</script>')).toEqual([{ type: 'paragraphe', texte: '<script>alert(1)</script>' }])
  })
})

describe('resumeAutomatique', () => {
  it('coupe proprement sur un mot', () => {
    expect(resumeAutomatique('mot '.repeat(100), 20).endsWith('…')).toBe(true)
  })
})

describe('mediaVisiblePublic', () => {
  const base = { publie: true, contientMineurs: true, consentementVerifie: false, album: { publie: true } }
  it('refuse une photo de mineurs sans consentement vérifié', () => {
    expect(mediaVisiblePublic(base)).toBe(false)
    expect(mediaVisiblePublic({ ...base, consentementVerifie: true })).toBe(true)
  })
  it('refuse une photo non publiée ou dans un album non publié', () => {
    expect(mediaVisiblePublic({ ...base, contientMineurs: false, publie: false })).toBe(false)
    expect(mediaVisiblePublic({ ...base, contientMineurs: false, album: { publie: false } })).toBe(false)
  })
})

describe('estUrlHttps', () => {
  it('n’accepte que https sans identifiants', () => {
    expect(estUrlHttps('https://facebook.com/groupe')).toBe(true)
    expect(estUrlHttps('http://facebook.com')).toBe(false)
    expect(estUrlHttps('javascript:alert(1)')).toBe(false)
    expect(estUrlHttps('https://a:b@x.com')).toBe(false)
  })
})
