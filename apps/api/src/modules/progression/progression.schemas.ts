import { BrancheTypeSchema } from '@scout/shared'
import { z } from 'zod'
import { texteFacultatif, texteRequis } from '../../common/lib/schemas-contenus'

// Étape du référentiel pédagogique d'une branche (modèle Badge). Le contenu
// est saisi par le groupe à partir de ses documents officiels : aucun
// référentiel n'est fourni par défaut.
export const SchemaEtape = z.object(
  {
    brancheType: BrancheTypeSchema,
    nom: texteRequis('nom', 120),
    description: texteFacultatif('description', 2000),
    ordre: z.number().int().min(0).max(1000).optional(),
  },
  { error: 'Données invalides' },
)

export const SchemaModificationEtape = z.object(
  {
    nom: texteRequis('nom', 120).optional(),
    description: texteFacultatif('description', 2000),
    ordre: z.number().int().min(0).max(1000).optional(),
  },
  { error: 'Données invalides' },
)

export type CorpsEtape = z.infer<typeof SchemaEtape>
export type CorpsModificationEtape = z.infer<typeof SchemaModificationEtape>
