// Formats d'affichage (français, Côte d'Ivoire).

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const DATE_HEURE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const JOUR_MOIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

function versDate(valeur: string | Date | null | undefined): Date | null {
  if (!valeur) return null
  const date = valeur instanceof Date ? valeur : new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}

export function dateLongue(valeur: string | Date | null | undefined): string {
  const date = versDate(valeur)
  return date ? DATE_LONGUE.format(date) : '—'
}

export function dateCourte(valeur: string | Date | null | undefined): string {
  const date = versDate(valeur)
  return date ? DATE_COURTE.format(date) : '—'
}

export function dateHeure(valeur: string | Date | null | undefined): string {
  const date = versDate(valeur)
  return date ? DATE_HEURE.format(date) : '—'
}

export function jourMois(valeur: string | Date | null | undefined): { jour: string; mois: string } {
  const date = versDate(valeur)
  if (!date) return { jour: '—', mois: '' }
  const [jour, mois] = JOUR_MOIS.format(date).split(' ')
  return { jour, mois: mois?.replace('.', '') ?? '' }
}

/** Valeur pour un champ <input type="date"> (AAAA-MM-JJ). */
export function valeurChampDate(valeur: string | Date | null | undefined): string {
  const date = versDate(valeur)
  return date ? date.toISOString().slice(0, 10) : ''
}

/** Valeur pour un champ <input type="datetime-local"> (heure locale). */
export function valeurChampDateHeure(valeur: string | Date | null | undefined): string {
  const date = versDate(valeur)
  if (!date) return ''
  const decale = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return decale.toISOString().slice(0, 16)
}
