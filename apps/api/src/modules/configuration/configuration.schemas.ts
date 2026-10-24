import { RESEAUX_SOCIAUX, estCouleurHexValide, estUrlHttps } from '@scout/shared'
import { z } from 'zod'
import { texteFacultatif, urlImagePublique } from '../../common/lib/schemas-contenus'

const couleur = (cle: string) =>
  z
    .string({ error: `${cle} est invalide` })
    .refine(estCouleurHexValide, `${cle} doit être une couleur hexadécimale (#RRGGBB)`)
    .optional()

const reseaux = z
  .record(z.string(), z.string().nullable())
  .refine(
    (objet) => Object.keys(objet).every((cle) => (RESEAUX_SOCIAUX as readonly string[]).includes(cle)),
    'Réseau social inconnu',
  )
  .refine(
    (objet) => Object.values(objet).every((url) => url === null || url === '' || estUrlHttps(url)),
    'Les liens des réseaux sociaux doivent être des adresses https',
  )
  .transform((objet) =>
    Object.fromEntries(Object.entries(objet).filter(([, url]) => !!url)) as Record<string, string>,
  )

// PUT /admin/configuration — mise à jour partielle de l'identité de
// l'installation (une clé absente reste inchangée). La configuration est
// unique : ni création multiple ni suppression ne sont possibles.
export const SchemaConfiguration = z.object(
  {
    nomParoisse: z.string().trim().min(2, 'Nom officiel de la paroisse requis').max(150).optional(),
    nomGroupe: z.string().trim().max(150).optional(),
    ville: texteFacultatif('ville', 100),
    diocese: texteFacultatif('diocese', 150),
    presentation: texteFacultatif('presentation', 5000),
    messageBienvenue: texteFacultatif('messageBienvenue', 2000),
    anneeHistorique: z
      .number({ error: "L'année historique doit être un nombre" })
      .int()
      .min(1900, 'Année historique invalide')
      .max(new Date().getFullYear(), 'Année historique dans le futur')
      .nullish(),
    rangHistorique: texteFacultatif('rangHistorique', 300),
    rangHistoriqueValide: z.boolean().optional(),
    sourceHistorique: texteFacultatif('sourceHistorique', 1000),
    adresse: texteFacultatif('adresse', 300),
    telephone: texteFacultatif('telephone', 40),
    email: z
      .string()
      .trim()
      .max(200)
      .refine((v) => v === '' || z.email().safeParse(v).success, 'Adresse e-mail invalide')
      .nullish()
      .transform((v) => (v === undefined ? undefined : v || null)),
    horaires: texteFacultatif('horaires', 500),
    logoUrl: urlImagePublique('logoUrl'),
    heroTitre: texteFacultatif('heroTitre', 150),
    heroSousTitre: texteFacultatif('heroSousTitre', 400),
    heroImageUrl: urlImagePublique('heroImageUrl'),
    heroImageAlt: texteFacultatif('heroImageAlt', 200),
    couleurPrimaire: couleur('couleurPrimaire'),
    couleurAccent: couleur('couleurAccent'),
    couleurFond: couleur('couleurFond'),
    couleurHover: couleur('couleurHover'),
    reseauxSociaux: reseaux.optional(),
    inscriptionsOuvertes: z.boolean().optional(),
  },
  { error: 'Données invalides' },
)

export type DonneesConfiguration = z.infer<typeof SchemaConfiguration>
