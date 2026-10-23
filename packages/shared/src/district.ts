import { z } from 'zod'

const effectif = z.number().int().nonnegative().safe()

// Projection locale de GET /api/district/apercu. Les champs nominaux
// supplémentaires de l'API sont retirés avant transmission à la vue.
export const SchemaApercuDistrict = z.object({
  nomDistrict: z.string().trim().min(1),
  totaux: z.object({
    paroisses: effectif,
    paroissesActives: effectif,
    scouts: effectif,
    utilisateurs: effectif,
    activitesMois: effectif,
  }),
  paroisses: z.array(z.object({
    id: z.string().min(1),
    nom: z.string().trim().min(1),
    ville: z.string(),
    actif: z.boolean(),
    scouts: effectif,
    utilisateurs: effectif,
  })),
}).refine(({ totaux, paroisses }) => (
  totaux.paroisses === paroisses.length &&
  totaux.paroissesActives === paroisses.filter((paroisse) => paroisse.actif).length &&
  totaux.scouts === paroisses.reduce((total, paroisse) => total + paroisse.scouts, 0) &&
  totaux.utilisateurs === paroisses.reduce((total, paroisse) => total + paroisse.utilisateurs, 0) &&
  new Set(paroisses.map((paroisse) => paroisse.id)).size === paroisses.length
), 'Les indicateurs du district sont incohérents')

export type ApercuDistrict = z.infer<typeof SchemaApercuDistrict>
