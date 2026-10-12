import { describe, it, expect } from 'vitest'
import { champCsv, contentDispositionTelechargement } from './csv'

describe('champCsv', () => {
  it('entoure de guillemets et double les guillemets internes', () => {
    expect(champCsv('Kouassi "Jo"')).toBe('"Kouassi ""Jo"""')
    expect(champCsv(null)).toBe('""')
    expect(champCsv(undefined)).toBe('""')
  })

  it('neutralise les valeurs interprétées comme des formules', () => {
    expect(champCsv('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"')
    expect(champCsv('+1+1')).toBe('"\'+1+1"')
    expect(champCsv('-2+3')).toBe('"\'-2+3"')
    expect(champCsv('@SOMME(A1)')).toBe('"\'@SOMME(A1)"')
    expect(champCsv('\t=1')).toBe('"\'\t=1"')
  })

  it('conserve les numéros de téléphone et nombres signés', () => {
    expect(champCsv('+225 07 08 09 10 11')).toBe('"+225 07 08 09 10 11"')
    expect(champCsv('-5')).toBe('"-5"')
    expect(champCsv('Konan')).toBe('"Konan"')
  })
})

describe('contentDispositionTelechargement', () => {
  it('fournit un repli ASCII et la forme encodée UTF-8', () => {
    expect(contentDispositionTelechargement('présence.csv')).toBe(
      "attachment; filename=\"presence.csv\"; filename*=UTF-8''pr%C3%A9sence.csv",
    )
  })

  it('remplace dans le repli les caractères hors ASCII, guillemets et barres obliques inverses', () => {
    const entete = contentDispositionTelechargement('réunion — "spéciale" \\ 🎉.csv')
    const repli = entete.match(/filename="([^"]*)"/)?.[1]
    expect(repli).toBe('reunion _ _speciale_ _ __.csv')
    // L'en-tête complet doit être constructible (octets ≤ 0xFF uniquement).
    expect(() => new Headers({ 'Content-Disposition': entete })).not.toThrow()
  })

  it("encode ' ( ) * dans la forme filename*", () => {
    expect(contentDispositionTelechargement("l'activité (1).csv")).toContain(
      "filename*=UTF-8''l%27activit%C3%A9%20%281%29.csv",
    )
  })
})
