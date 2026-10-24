import { describe, it, expect } from 'vitest'
import { ESPACES_FAMILLES_ACTIFS, apiHorsPerimetre, pageHorsPerimetre } from './perimetre'

// Garde-fou du périmètre : proxy.ts s'appuie sur ces fonctions pour bloquer
// côté serveur. Une erreur de motif masquerait le cœur de l'application ou, à
// l'inverse, ouvrirait un espace famille encore fermé.
describe.runIf(!ESPACES_FAMILLES_ACTIFS)('périmètre (espaces familles fermés)', () => {
  it('masque les pages des espaces parent et scout', () => {
    for (const chemin of [
      '/dashboard/parents',
      '/dashboard/parents/abc/modifier',
      '/dashboard/mes-enfants',
      '/dashboard/ma-progression',
    ]) {
      expect(pageHorsPerimetre(chemin), chemin).toBe(true)
    }
  })

  it('laisse accessibles les pages de gestion du groupe', () => {
    for (const chemin of [
      '/dashboard',
      '/dashboard/scouts',
      '/dashboard/scouts/abc/carte',
      '/dashboard/documents',
      '/dashboard/programmes/nouveau',
      '/dashboard/progression',
      '/dashboard/rapports',
      '/dashboard/cotisations',
      '/admin',
      '/admin/publications',
      '/dashboard/parentsx',
    ]) {
      expect(pageHorsPerimetre(chemin), chemin).toBe(false)
    }
  })

  it('bloque les routes API des espaces familles', () => {
    for (const chemin of [
      '/api/ma-progression',
      '/api/mes-enfants/abc/consentement-image',
      '/api/scouts/abc/compte',
      '/api/cron/rappels-documents',
    ]) {
      expect(apiHorsPerimetre(chemin), chemin).toBe(true)
    }
  })

  it('laisse passer les routes API de gestion', () => {
    for (const chemin of [
      '/api/auth/session',
      '/api/scouts',
      '/api/scouts/abc/progressions',
      '/api/scouts/abc/documents/def',
      '/api/programmes',
      '/api/cotisations',
      '/api/calendrier/ics',
      '/api/rapports',
      '/api/dashboard/kpis',
      '/api/public/publications',
    ]) {
      expect(apiHorsPerimetre(chemin), chemin).toBe(false)
    }
  })
})
