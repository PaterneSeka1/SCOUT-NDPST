import { BadRequestException, Injectable } from '@nestjs/common'
import { estCouleurHexValide, estUrlFichierValide } from '@scout/shared'
import type { ConfigurationPlateforme, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { urlPubliqueBase } from '../../common/lib/storage'
import { corpsObjet, entierBorneRequete, parametre } from './admin.utils'

// Identité visuelle commune à toutes les paroisses (page d'accueil, page de
// connexion — avant qu'on sache à quelle paroisse un visiteur appartient).
// Stockée en base (ConfigurationPlateforme, ligne unique id="platform") plutôt
// que dans un fichier : gérée exclusivement par ADMIN_PLATEFORME.
export interface SiteConfigJSON {
  logoSite: string
  nomSite: string
  sousTitreSite: string
  theme: { couleurPrimaire: string; couleurAccent: string; couleurFond: string; couleurHover: string }
  hero: { imageUrl: string; imageAlt: string; badge: string; titre: string; sousTitre: string }
  stats: { value: string; label: string }[]
}

const STATS_MAX = 12
const LONGUEUR_STAT_MAX = 100

// Forme attendue : tableau (borné) d'objets { value, label } textuels — sans
// ce contrôle, n'importe quel JSON serait stocké tel quel puis renvoyé à la
// page d'accueil publique.
function statsValides(stats: unknown): stats is SiteConfigJSON['stats'] {
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

function versJSON(cfg: ConfigurationPlateforme): SiteConfigJSON {
  return {
    logoSite: cfg.logoUrl ?? '',
    nomSite: cfg.nomSite,
    sousTitreSite: cfg.sousTitreSite,
    theme: {
      couleurPrimaire: cfg.couleurPrimaire,
      couleurAccent: cfg.couleurAccent,
      couleurFond: cfg.couleurFond,
      couleurHover: cfg.couleurHover,
    },
    hero: {
      imageUrl: cfg.heroImageUrl ?? '',
      imageAlt: cfg.heroImageAlt ?? '',
      badge: cfg.heroBadge ?? '',
      titre: cfg.heroTitre ?? '',
      sousTitre: cfg.heroSousTitre ?? '',
    },
    stats: (cfg.stats as SiteConfigJSON['stats'] | null) ?? [],
  }
}

// Texte optionnel d'un sous-objet de la configuration : un autre type ferait
// échouer l'écriture Prisma (erreur 500) au lieu d'un rejet propre.
function texte(valeur: unknown, nom: string): string | undefined {
  if (valeur === undefined) return undefined
  if (typeof valeur !== 'string') throw new BadRequestException(`${nom} doit être un texte`)
  return valeur
}

function sousObjet(valeur: unknown, nom: string): Record<string, unknown> | undefined {
  if (valeur === undefined) return undefined
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
    throw new BadRequestException(`${nom} est invalide`)
  }
  return valeur as Record<string, unknown>
}

@Injectable()
export class PlateformeService {
  constructor(private readonly prisma: PrismaService) {}

  // Journal d'audit de la plateforme : toutes les paroisses confondues, plus
  // les actions de portée plateforme (paroisseId = null, ex. création d'un
  // district). Ce journal n'est plus accessible depuis l'espace paroisse.
  async journalAudit(requete: Record<string, unknown>) {
    const page = entierBorneRequete(requete.page, 1)
    const limite = entierBorneRequete(requete.limite, 30, 100)
    const action = parametre(requete.action) || undefined
    const entite = parametre(requete.entite) || undefined
    const paroisseId = parametre(requete.paroisseId) || undefined

    const where: Prisma.JournalAuditWhereInput = {
      ...(paroisseId ? { paroisseId } : {}),
      ...(action ? { action } : {}),
      ...(entite ? { entite } : {}),
    }

    const [entrees, total] = await Promise.all([
      this.prisma.journalAudit.findMany({
        where,
        include: {
          acteur: { select: { id: true, nom: true, prenom: true, role: true } },
          paroisse: { select: { id: true, nom: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limite,
        take: limite,
      }),
      this.prisma.journalAudit.count({ where }),
    ])

    return {
      entrees,
      pagination: { page, limite, total, totalPages: Math.ceil(total / limite) },
    }
  }

  async lireConfig(): Promise<SiteConfigJSON> {
    const cfg = await this.prisma.configurationPlateforme.upsert({
      where: { id: 'platform' },
      create: { id: 'platform' },
      update: {},
    })
    return versJSON(cfg)
  }

  async modifierConfig(corpsBrut: unknown): Promise<SiteConfigJSON> {
    const corps = corpsObjet(corpsBrut)
    const origineStockage = urlPubliqueBase()

    const nomSite = texte(corps.nomSite, 'nomSite')
    const sousTitreSite = texte(corps.sousTitreSite, 'sousTitreSite')
    const logoSite = corps.logoSite
    const theme = sousObjet(corps.theme, 'theme')
    const heroObjet = sousObjet(corps.hero, 'hero')
    const hero = heroObjet
      ? {
          imageUrl: heroObjet.imageUrl,
          imageAlt: texte(heroObjet.imageAlt, 'hero.imageAlt'),
          badge: texte(heroObjet.badge, 'hero.badge'),
          titre: texte(heroObjet.titre, 'hero.titre'),
          sousTitre: texte(heroObjet.sousTitre, 'hero.sousTitre'),
        }
      : undefined

    // Comme la route d'origine : une valeur vide (ou null) efface le fichier,
    // toute autre valeur doit être un chemin local ou une URL de stockage autorisée.
    if (logoSite && !estUrlFichierValide(logoSite, origineStockage)) {
      throw new BadRequestException(
        'logoSite doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
      )
    }

    if (hero?.imageUrl && !estUrlFichierValide(hero.imageUrl, origineStockage)) {
      throw new BadRequestException(
        'hero.imageUrl doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
      )
    }

    if (corps.stats !== undefined && !statsValides(corps.stats)) {
      throw new BadRequestException(
        `stats doit être une liste d'au plus ${STATS_MAX} éléments { value, label } (textes de ${LONGUEUR_STAT_MAX} caractères maximum)`,
      )
    }

    if (theme) {
      for (const [champ, valeur] of Object.entries(theme)) {
        if (!estCouleurHexValide(valeur)) {
          throw new BadRequestException(`${champ} doit être une couleur hexadécimale valide (ex : #1a4731)`)
        }
      }
    }

    // Après validation : chaîne valide, ou valeur vide qui efface le fichier.
    const logo = logoSite as string | null | undefined
    const imageHero = hero?.imageUrl as string | null | undefined
    const couleurs = theme as Partial<SiteConfigJSON['theme']> | undefined

    const champs: Prisma.ConfigurationPlateformeUpdateInput = {
      ...(nomSite !== undefined ? { nomSite } : {}),
      ...(sousTitreSite !== undefined ? { sousTitreSite } : {}),
      ...(logo !== undefined ? { logoUrl: logo || null } : {}),
      ...(couleurs?.couleurPrimaire !== undefined ? { couleurPrimaire: couleurs.couleurPrimaire } : {}),
      ...(couleurs?.couleurAccent !== undefined ? { couleurAccent: couleurs.couleurAccent } : {}),
      ...(couleurs?.couleurFond !== undefined ? { couleurFond: couleurs.couleurFond } : {}),
      ...(couleurs?.couleurHover !== undefined ? { couleurHover: couleurs.couleurHover } : {}),
      ...(hero?.badge !== undefined ? { heroBadge: hero.badge || null } : {}),
      ...(hero?.titre !== undefined ? { heroTitre: hero.titre || null } : {}),
      ...(hero?.sousTitre !== undefined ? { heroSousTitre: hero.sousTitre || null } : {}),
      ...(imageHero !== undefined ? { heroImageUrl: imageHero || null } : {}),
      ...(hero?.imageAlt !== undefined ? { heroImageAlt: hero.imageAlt || null } : {}),
      ...(corps.stats !== undefined ? { stats: corps.stats as Prisma.InputJsonValue } : {}),
    }

    const misAJour = await this.prisma.configurationPlateforme.upsert({
      where: { id: 'platform' },
      create: { id: 'platform', ...(champs as Prisma.ConfigurationPlateformeCreateInput) },
      update: champs,
    })

    return versJSON(misAJour)
  }
}
