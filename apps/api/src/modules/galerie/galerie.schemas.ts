import { z } from 'zod'
import { dateFacultative, texteFacultatif, texteRequis } from '../../common/lib/schemas-contenus'

const champsAlbum = {
  titre: texteRequis('titre', 150),
  slug: texteFacultatif('slug', 80),
  description: texteFacultatif('description', 2000),
  categorie: texteFacultatif('categorie', 80),
  dateEvenement: dateFacultative('dateEvenement'),
  activiteId: texteFacultatif('activiteId', 40),
  publie: z.boolean().optional(),
}

export const SchemaAlbum = z.object(champsAlbum, { error: 'Données invalides' })
export const SchemaModificationAlbum = z.object(
  { ...champsAlbum, titre: champsAlbum.titre.optional() },
  { error: 'Données invalides' },
)

export const SchemaAjoutMedia = z.object(
  {
    url: z.string({ error: 'Photo manquante' }).max(300),
    legende: texteFacultatif('legende', 300),
    texteAlt: texteFacultatif('texteAlt', 200),
    // Par prudence, une photo est présumée montrer des mineurs.
    contientMineurs: z.boolean().default(true),
    consentementVerifie: z.boolean().default(false),
  },
  { error: 'Données invalides' },
)

export const SchemaModificationMedia = z.object(
  {
    legende: texteFacultatif('legende', 300),
    texteAlt: texteFacultatif('texteAlt', 200),
    ordre: z.number().int().min(0).max(10000).optional(),
    publie: z.boolean().optional(),
    contientMineurs: z.boolean().optional(),
    consentementVerifie: z.boolean().optional(),
  },
  { error: 'Données invalides' },
)

export type CorpsAlbum = z.infer<typeof SchemaAlbum>
export type CorpsModificationAlbum = z.infer<typeof SchemaModificationAlbum>
export type CorpsAjoutMedia = z.infer<typeof SchemaAjoutMedia>
export type CorpsModificationMedia = z.infer<typeof SchemaModificationMedia>
