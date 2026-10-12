import { describe, it, expect } from 'vitest'
import { PERIMETRE_V1, apiHorsPerimetreV1, pageHorsPerimetreV1 } from './perimetreV1'

// Garde-fou du périmètre V1 : proxy.ts s'appuie sur ces fonctions pour bloquer
// côté serveur. Une erreur de motif masquerait le cœur de l'application ou, à
// l'inverse, laisserait passer une fonctionnalité censée être masquée.
describe.runIf(PERIMETRE_V1)('périmètre V1', () => {
  it('masque les pages hors périmètre', () => {
    for (const chemin of [
      '/district',
      '/district/equipe',
      '/dashboard/parents',
      '/dashboard/parents/abc/modifier',
      '/dashboard/documents',
      '/dashboard/programmes/nouveau',
      '/dashboard/rapports',
      '/dashboard/mes-enfants',
      '/dashboard/ma-progression',
      '/dashboard/scouts/abc/carte',
      '/admin/rapports',
      '/admin/apparence',
    ]) {
      expect(pageHorsPerimetreV1(chemin), chemin).toBe(true)
    }
  })

  it('laisse accessibles les pages du cœur', () => {
    for (const chemin of [
      '/dashboard',
      '/dashboard/scouts',
      '/dashboard/scouts/abc',
      '/dashboard/scouts/abc/modifier',
      '/dashboard/cotisations',
      '/dashboard/activites/abc/presences',
      '/dashboard/reunions',
      '/dashboard/ma-branche',
      '/dashboard/utilisateurs',
      '/dashboard/paroisse',
      '/admin',
      '/admin/paroisses',
      '/admin/districts',
      '/admin/utilisateurs',
      '/admin/audit',
      '/districts-inexistant',
    ]) {
      expect(pageHorsPerimetreV1(chemin), chemin).toBe(false)
    }
  })

  it('bloque les routes API hors périmètre', () => {
    for (const chemin of [
      '/api/district/apercu',
      '/api/programmes',
      '/api/programmes/abc/lignes',
      '/api/ma-progression',
      '/api/scouts/abc/progressions',
      '/api/scouts/abc/documents/def',
      '/api/scouts/abc/compte',
      '/api/documents/expirations',
      '/api/cron/rappels-documents',
      '/api/activites/abc/autorisations',
      '/api/mes-enfants/abc/consentement-image',
      '/api/calendrier/ics',
      '/api/rapports',
      '/api/admin/rapports/export',
      '/api/cotisations',
      '/api/cotisations/',
      '/api/cotisations/abc',
    ]) {
      expect(apiHorsPerimetreV1(chemin), chemin).toBe(true)
    }
  })

  it('laisse passer les routes API du cœur', () => {
    for (const chemin of [
      '/api/auth/session',
      '/api/scouts',
      '/api/scouts/abc',
      '/api/scouts/abc/contacts',
      '/api/scouts/abc/matricule',
      '/api/activites/abc/presences',
      '/api/reunions/abc/presences',
      '/api/cotisations/statuts',
      '/api/dashboard/kpis',
      '/api/admin/rapports',
      '/api/utilisateurs',
    ]) {
      expect(apiHorsPerimetreV1(chemin), chemin).toBe(false)
    }
  })
})
