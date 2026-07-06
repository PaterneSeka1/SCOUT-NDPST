// Génération de flux iCalendar (RFC 5545) pour les activités et réunions.

export interface EvenementICS {
  uid: string
  debut: Date
  fin?: Date | null
  titre: string
  lieu?: string | null
  description?: string | null
}

function formatDateICS(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function echapperICS(texte: string): string {
  return texte.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
}

export function genererICS(nomCalendrier: string, evenements: EvenementICS[]): string {
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SCOUT ASCCI//Calendrier//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapperICS(nomCalendrier)}`,
  ]

  const maintenant = formatDateICS(new Date())

  for (const e of evenements) {
    lignes.push('BEGIN:VEVENT')
    lignes.push(`UID:${e.uid}@scout-ascci`)
    lignes.push(`DTSTAMP:${maintenant}`)
    lignes.push(`DTSTART:${formatDateICS(e.debut)}`)
    lignes.push(`DTEND:${formatDateICS(e.fin ?? new Date(e.debut.getTime() + 60 * 60 * 1000))}`)
    lignes.push(`SUMMARY:${echapperICS(e.titre)}`)
    if (e.lieu) lignes.push(`LOCATION:${echapperICS(e.lieu)}`)
    if (e.description) lignes.push(`DESCRIPTION:${echapperICS(e.description)}`)
    lignes.push('END:VEVENT')
  }

  lignes.push('END:VCALENDAR')
  return lignes.join('\r\n')
}
