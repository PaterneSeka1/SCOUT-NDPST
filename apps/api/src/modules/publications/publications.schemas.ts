import { z } from 'zod'
import { dateFacultative, texteFacultatif, texteRequis, urlImagePublique } from '../../common/lib/schemas-contenus'

const champs = {
  titre: texteRequis('titre', 200),
  slug: texteFacultatif('slug', 80),
  resume: texteFacultatif('resume', 400),
  contenu: z.string({ error: 'Le contenu est obligatoire' }).trim().min(1, 'Le contenu est obligatoire').max(50000),
  imageCouverture: urlImagePublique('imageCouverture'),
  imageAlt: texteFacultatif('imageAlt', 200),
  categorieId: texteFacultatif('categorieId', 40),
  seoTitre: texteFacultatif('seoTitre', 70),
  seoDescription: texteFacultatif('seoDescription', 160),
}

export const SchemaCreationPublication = z.object(champs, { error: 'Données invalides' })
export const SchemaModificationPublication = z.object(
  { ...champs, titre: champs.titre.optional(), contenu: champs.contenu.optional() },
  { error: 'Données invalides' },
)
export const SchemaPublier = z.object({ datePublication: dateFacultative('datePublication') }, { error: 'Données invalides' })

export const SchemaCategorie = z.object(
  { nom: texteRequis('nom', 80), slug: texteFacultatif('slug', 80) },
  { error: 'Données invalides' },
)

export type CorpsCreationPublication = z.infer<typeof SchemaCreationPublication>
export type CorpsModificationPublication = z.infer<typeof SchemaModificationPublication>
export type CorpsCategorie = z.infer<typeof SchemaCategorie>
