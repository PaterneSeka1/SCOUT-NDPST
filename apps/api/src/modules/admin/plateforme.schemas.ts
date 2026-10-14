import { estCouleurHexValide, estUrlFichierValide } from '@scout/shared'
import { z } from 'zod'
import { urlPubliqueBase } from '../../common/lib/storage'
import { corpsAdmin } from './admin.schemas'

export const STATS_MAX = 12
export const LONGUEUR_STAT_MAX = 100

export interface StatSite {
  value: string
  label: string
}

// Forme attendue : tableau (borné) d'objets { value, label } textuels — sans
// ce contrôle, n'importe quel JSON serait stocké tel quel puis renvoyé à la
// page d'accueil publique.
function statsValides(stats: unknown): stats is StatSite[] {
  return (
    Array.isArray(stats) &&
    stats.length <= STATS_MAX &&
    stats.every(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as { value?: unknown }).value === 'string' &&
        typeof (s as { label?: unknown }).label === 'string' &&
        (s as { value: string }).value.length <= LONGUEUR_STAT_MAX &&
        (s as { label: string }).label.length <= LONGUEUR_STAT_MAX,
    )
  )
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

// Texte optionnel de la configuration : un autre type ferait échouer
// l'écriture Prisma (erreur 500) au lieu d'un rejet propre.
function texte(nom: string) {
  return z.string({ error: `${nom} doit être un texte` }).optional()
}

const MESSAGE_FICHIER = 'doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée'

// PUT /admin/site-config — mise à jour partielle : une clé absente reste
// inchangée. Les couleurs du thème sont toutes contrôlées (y compris une clé
// inconnue), seules les quatre couleurs connues sont enregistrées.
export const SchemaConfigurationSite = corpsAdmin({
  nomSite: texte('nomSite'),
  sousTitreSite: texte('sousTitreSite'),
  logoSite: z.unknown().optional(),
  theme: z.custom<Record<string, unknown>>(estObjet, { error: 'theme est invalide' }).optional(),
  hero: z
    .object(
      {
        imageUrl: z.unknown().optional(),
        imageAlt: texte('hero.imageAlt'),
        badge: texte('hero.badge'),
        titre: texte('hero.titre'),
        sousTitre: texte('hero.sousTitre'),
      },
      { error: 'hero est invalide' },
    )
    .optional(),
  stats: z.unknown().optional(),
}).transform((corps, ctx) => {
  const { logoSite, theme, hero, stats } = corps
  const origineStockage = urlPubliqueBase()

  // Une valeur vide (ou null) efface le fichier ; toute autre valeur doit être
  // un chemin local ou une URL de stockage autorisée.
  if (logoSite && !estUrlFichierValide(logoSite, origineStockage)) {
    ctx.addIssue({ code: 'custom', message: `logoSite ${MESSAGE_FICHIER}`, path: ['logoSite'] })
    return z.NEVER
  }
  if (hero?.imageUrl && !estUrlFichierValide(hero.imageUrl, origineStockage)) {
    ctx.addIssue({ code: 'custom', message: `hero.imageUrl ${MESSAGE_FICHIER}`, path: ['hero', 'imageUrl'] })
    return z.NEVER
  }
  if (stats !== undefined && !statsValides(stats)) {
    ctx.addIssue({
      code: 'custom',
      message: `stats doit être une liste d'au plus ${STATS_MAX} éléments { value, label } (textes de ${LONGUEUR_STAT_MAX} caractères maximum)`,
      path: ['stats'],
    })
    return z.NEVER
  }
  if (theme) {
    for (const [champ, valeur] of Object.entries(theme)) {
      if (!estCouleurHexValide(valeur)) {
        ctx.addIssue({
          code: 'custom',
          message: `${champ} doit être une couleur hexadécimale valide (ex : #1a4731)`,
          path: ['theme', champ],
        })
        return z.NEVER
      }
    }
  }
  // Toutes les valeurs du thème sont désormais des couleurs valides.
  const couleur = (valeur: unknown) => valeur as string | undefined

  // Après validation : chaîne valide, ou valeur vide (effacement → null).
  const fichier = (valeur: unknown): string | null | undefined =>
    valeur === undefined ? undefined : (valeur as string) || null

  return {
    nomSite: corps.nomSite,
    sousTitreSite: corps.sousTitreSite,
    logoSite: fichier(logoSite),
    theme: theme
      ? {
          couleurPrimaire: couleur(theme.couleurPrimaire),
          couleurAccent: couleur(theme.couleurAccent),
          couleurFond: couleur(theme.couleurFond),
          couleurHover: couleur(theme.couleurHover),
        }
      : undefined,
    hero: hero
      ? {
          imageUrl: fichier(hero.imageUrl),
          imageAlt: hero.imageAlt,
          badge: hero.badge,
          titre: hero.titre,
          sousTitre: hero.sousTitre,
        }
      : undefined,
    stats: stats as StatSite[] | undefined,
  }
})
export type DonneesConfigurationSite = z.infer<typeof SchemaConfigurationSite>
