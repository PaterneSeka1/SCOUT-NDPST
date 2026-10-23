import { z } from 'zod'

// Contrat préparatoire, sans route ni transport activé. Aucun identifiant de
// mineur, contact, document ou information de santé ne traverse ce contrat.
export const SchemaIndicateursInstallation = z.object({
  version: z.literal(1),
  installationId: z.string().min(1),
  districtId: z.string().min(1),
  periode: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  calculeLe: z.iso.datetime(),
  scoutsActifs: z.number().int().nonnegative().safe(),
  activitesTerminees: z.number().int().nonnegative().safe(),
}).strict()

export interface SourceConsolidation {
  installationId: string
  // Identité issue du transport authentifié, jamais du JSON reçu seul.
  identiteAuthentifiee: string
  donnees?: unknown
}

export function consoliderIndicateurs(
  districtId: string,
  periode: string,
  installationsAutorisees: readonly string[],
  sources: readonly SourceConsolidation[],
) {
  const installations = [...new Set(installationsAutorisees)]
  const resultats = installations.map((installationId) => {
    const candidates = sources.filter((source) => source.installationId === installationId)
    if (candidates.length !== 1) return { installationId, statut: 'indisponible' as const, indicateurs: null }
    const source = candidates[0]!
    if (source.identiteAuthentifiee !== installationId) return { installationId, statut: 'refusee' as const, indicateurs: null }
    const lecture = SchemaIndicateursInstallation.safeParse(source.donnees)
    if (!lecture.success || lecture.data.installationId !== installationId || lecture.data.districtId !== districtId || lecture.data.periode !== periode) {
      return { installationId, statut: 'invalide' as const, indicateurs: null }
    }
    return { installationId, statut: 'disponible' as const, indicateurs: lecture.data }
  })
  const complet = installations.length > 0 && resultats.every((source) => source.statut === 'disponible')
  // Un total incomplet n'est jamais présenté comme un résultat métier exact.
  const totaux = complet ? resultats.reduce((total, source) => ({
    scoutsActifs: total.scoutsActifs + source.indicateurs!.scoutsActifs,
    activitesTerminees: total.activitesTerminees + source.indicateurs!.activitesTerminees,
  }), { scoutsActifs: 0, activitesTerminees: 0 }) : null
  return { districtId, periode, complet, sources: resultats, totaux }
}
