import { z } from 'zod'
import { texteFacultatif, urlImagePublique } from '../../common/lib/schemas-contenus'

// Présentation institutionnelle d'une branche : textes fournis par le groupe.
export const SchemaBranche = z.object(
  {
    presentation: texteFacultatif('presentation', 5000),
    identite: texteFacultatif('identite', 3000),
    objectifs: texteFacultatif('objectifs', 5000),
    pedagogie: texteFacultatif('pedagogie', 5000),
    activitesTypes: texteFacultatif('activitesTypes', 5000),
    imageUrl: urlImagePublique('imageUrl'),
    imageAlt: texteFacultatif('imageAlt', 200),
    active: z.boolean().optional(),
    publiee: z.boolean().optional(),
    ordre: z.number().int().min(0).max(100).optional(),
  },
  { error: 'Données invalides' },
)

export type CorpsBranche = z.infer<typeof SchemaBranche>
