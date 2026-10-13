import { describe, it, expect } from 'vitest'
import { envoyerNotification } from './notifications'

describe('envoyerNotification', () => {
  it('renvoie un statut non configuré pour le canal SMS, sans lever d\'exception', async () => {
    const resultat = await envoyerNotification({ canal: 'sms', destinataire: '0700000000', message: 'Test' })
    expect(resultat).toEqual({ ok: false, mode: 'sms_non_configure' })
  })

  it('délègue le canal email à envoyerEmailBrut (mode console sans SMTP configuré)', async () => {
    const resultat = await envoyerNotification({
      canal: 'email',
      destinataire: 'test@example.com',
      sujet: 'Sujet',
      html: '<p>Corps</p>',
    })
    expect(resultat.ok).toBe(true)
    expect(resultat.mode).toBe('console')
  })
})
