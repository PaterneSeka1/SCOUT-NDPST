import { z } from 'zod'
import { dateFacultative, texteFacultatif, texteRequis, urlImagePublique } from '../../common/lib/schemas-contenus'

const TYPES = ['ORIGINE', 'FONDATION', 'CHEF_DE_GROUPE', 'CAMP', 'ETAPE', 'TEMOIGNAGE', 'ARCHIVE'] as const

const champs = {
  annee: z
    .number({ error: "L'année est obligatoire" })
    .int()
    .min(1900, 'Année invalide')
    .max(new Date().getFullYear() + 1, 'Année invalide'),
  date: dateFacultative('date'),
  titre: texteRequis('titre', 200),
  description: texteFacultatif('description', 10000),
  type: z.enum(TYPES, { error: 'Type invalide' }).optional(),
  auteurTemoignage: texteFacultatif('auteurTemoignage', 150),
  imageUrl: urlImagePublique('imageUrl'),
  imageAlt: texteFacultatif('imageAlt', 200),
  documentUrl: urlImagePublique('documentUrl'),
  source: texteFacultatif('source', 1000),
  statutValidation: z.enum(['A_VERIFIER', 'VALIDE'], { error: 'Statut de validation invalide' }).optional(),
  publie: z.boolean().optional(),
  ordre: z.number().int().min(0).max(10000).optional(),
}

// Un fait marqué « validé » doit citer sa source.
function sourceSiValide(corps: { statutValidation?: string; source?: string | null }) {
  return corps.statutValidation !== 'VALIDE' || !!corps.source
}

export const SchemaEvenement = z
  .object(champs, { error: 'Données invalides' })
  .refine(sourceSiValide, { message: 'Indiquez la source qui confirme cet événement', path: ['source'] })

export const SchemaModificationEvenement = z.object(
  { ...champs, annee: champs.annee.optional(), titre: champs.titre.optional() },
  { error: 'Données invalides' },
)

export type CorpsEvenement = z.infer<typeof SchemaEvenement>
export type CorpsModificationEvenement = z.infer<typeof SchemaModificationEvenement>
