import { describe, it, expect, afterEach, vi } from 'vitest'
import { echapperHtml, envoyerEmailReinitialisation } from './email'

describe('echapperHtml', () => {
  it('échappe les caractères HTML spéciaux pour éviter une injection dans un email', () => {
    expect(echapperHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(echapperHtml(`O'Brien & Fils "Test"`)).toBe('O&#39;Brien &amp; Fils &quot;Test&quot;')
  })
})

describe('envoyerEmailReinitialisation sans SMTP configuré', () => {
  const smtpHostOriginal = process.env.SMTP_HOST
  afterEach(() => {
    process.env.SMTP_HOST = smtpHostOriginal
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('affiche le lien en console en développement (comportement de confort)', async () => {
    delete process.env.SMTP_HOST
    vi.stubEnv('NODE_ENV', 'development')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const resultat = await envoyerEmailReinitialisation('a@b.com', 'Jean', 'https://x/reset?token=abc')

    expect(resultat).toEqual({ ok: true, mode: 'console' })
    expect(spy).toHaveBeenCalled()
  })

  it('échoue explicitement sans jamais journaliser le token en production', async () => {
    delete process.env.SMTP_HOST
    vi.stubEnv('NODE_ENV', 'production')
    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    const resultat = await envoyerEmailReinitialisation('a@b.com', 'Jean', 'https://x/reset?token=secret-token')

    expect(resultat).toEqual({ ok: false, mode: 'erreur' })
    expect(spyLog).not.toHaveBeenCalled()
  })
})
