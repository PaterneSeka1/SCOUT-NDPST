import { z } from 'zod'

// Contrat de GET /api/tableau-de-bord (apps/api/src/modules/tableau-de-bord).
// Le profil dépend du rôle ; les blocs absents d'un profil restent facultatifs.
// Une réponse mal formée est refusée plutôt qu'affichée comme « vide ».

const indicateur = z.object({
  cle: z.string(),
  libelle: z.string(),
  valeur: z.union([z.number().finite(), z.string()]),
  detail: z.string().optional(),
})

const alerte = z.object({
  niveau: z.enum(['info', 'attention', 'critique']),
  message: z.string(),
  lien: z.string().optional(),
})

const action = z.object({ libelle: z.string(), lien: z.string(), nombre: z.number().int().nonnegative().optional() })

const activite = z.object({
  id: z.string(),
  titre: z.string(),
  dateDebut: z.string(),
  dateFin: z.string().nullable(),
  type: z.string(),
  brancheType: z.string().nullable(),
  lieu: z.string().nullable(),
  statut: z.string(),
})

const reunion = z.object({
  id: z.string(),
  titre: z.string().nullable(),
  dateHeure: z.string(),
  brancheType: z.string().nullable(),
  lieu: z.string().nullable(),
  statut: z.string(),
})

const schemaDashboard = z.object({
  profil: z.enum(['ADMIN', 'DIRECTION', 'EQUIPE_GROUPE', 'BRANCHE', 'FAMILLE']),
  brancheType: z.string().nullable().optional(),
  indicateurs: z.array(indicateur),
  alertes: z.array(alerte),
  actions: z.array(action),
  activitesAVenir: z.array(activite).optional(),
  reunionsAVenir: z.array(reunion).optional(),
  presencesRecentes: z.array(reunion.extend({ presents: z.number().int(), total: z.number().int() })).optional(),
  repartitionBranches: z.array(z.object({ brancheType: z.string(), effectif: z.number().int() })).optional(),
  evolutionEffectifs: z.array(z.object({ mois: z.string(), effectif: z.number().int() })).optional(),
  cotisations: z
    .object({ anneeScolaire: z.string(), montantDu: z.number(), montantPaye: z.number(), aJour: z.number().int(), total: z.number().int() })
    .optional(),
  comptesParRole: z.array(z.object({ role: z.string(), nombre: z.number().int() })).optional(),
  journal: z
    .array(
      z.object({
        id: z.string(),
        action: z.string(),
        entite: z.string().nullable(),
        createdAt: z.string(),
        acteur: z.object({ prenom: z.string(), nom: z.string() }).nullable(),
      }),
    )
    .optional(),
  services: z.object({ baseDeDonnees: z.boolean(), stockage: z.string(), email: z.boolean() }).optional(),
})

export type DonneesDashboard = z.infer<typeof schemaDashboard>
export type AlerteDashboard = z.infer<typeof alerte>
export type ActiviteDashboard = z.infer<typeof activite>
export type ReunionDashboard = z.infer<typeof reunion>

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
