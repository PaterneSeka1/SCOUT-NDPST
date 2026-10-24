import { z } from 'zod'

const schemaDashboard = z.object({
  kpis: z.record(z.string(), z.union([z.number().finite(), z.string()])),
  activitesRecentes: z.array(z.object({
    id: z.string(), titre: z.string(), dateDebut: z.string(), type: z.string(),
    brancheType: z.string().nullable(), lieu: z.string().nullable(),
    _count: z.object({ presences: z.number().int().nonnegative() }),
  })),
})

export type DonneesDashboard = z.infer<typeof schemaDashboard>
export type ActiviteRecente = DonneesDashboard['activitesRecentes'][number]

export async function lireDashboard(reponse: Response): Promise<DonneesDashboard> {
  if (!reponse.ok) {
    if (reponse.status === 401) throw new Error('Votre session a expiré. Reconnectez-vous.')
    if (reponse.status === 403) throw new Error('Vous ne disposez pas des droits nécessaires pour consulter ce tableau de bord.')
    throw new Error('Impossible de charger le tableau de bord. Réessayez dans quelques instants.')
  }
  const resultat = schemaDashboard.safeParse(await reponse.json())
  if (!resultat.success) throw new Error('Les données du tableau de bord sont incomplètes. Réessayez dans quelques instants.')
  return resultat.data
}
