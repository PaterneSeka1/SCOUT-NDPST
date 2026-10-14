import { Injectable } from '@nestjs/common'
import type { ConfigurationPlateforme, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { entierBorneRequete, parametre } from './admin.utils'
import type { DonneesConfigurationSite } from './plateforme.schemas'

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

  // Corps déjà validé et normalisé par SchemaConfigurationSite.
  async modifierConfig(donnees: DonneesConfigurationSite): Promise<SiteConfigJSON> {
    const { nomSite, sousTitreSite, logoSite, theme, hero, stats } = donnees

    const champs: Prisma.ConfigurationPlateformeUpdateInput = {
      ...(nomSite !== undefined ? { nomSite } : {}),
      ...(sousTitreSite !== undefined ? { sousTitreSite } : {}),
      ...(logoSite !== undefined ? { logoUrl: logoSite } : {}),
      ...(theme?.couleurPrimaire !== undefined ? { couleurPrimaire: theme.couleurPrimaire } : {}),
      ...(theme?.couleurAccent !== undefined ? { couleurAccent: theme.couleurAccent } : {}),
      ...(theme?.couleurFond !== undefined ? { couleurFond: theme.couleurFond } : {}),
      ...(theme?.couleurHover !== undefined ? { couleurHover: theme.couleurHover } : {}),
      ...(hero?.badge !== undefined ? { heroBadge: hero.badge || null } : {}),
      ...(hero?.titre !== undefined ? { heroTitre: hero.titre || null } : {}),
      ...(hero?.sousTitre !== undefined ? { heroSousTitre: hero.sousTitre || null } : {}),
      ...(hero?.imageUrl !== undefined ? { heroImageUrl: hero.imageUrl } : {}),
      ...(hero?.imageAlt !== undefined ? { heroImageAlt: hero.imageAlt || null } : {}),
      ...(stats !== undefined ? { stats: stats as unknown as Prisma.InputJsonValue } : {}),
    }

    const misAJour = await this.prisma.configurationPlateforme.upsert({
      where: { id: 'platform' },
      create: { id: 'platform', ...(champs as Prisma.ConfigurationPlateformeCreateInput) },
      update: champs,
    })

    return versJSON(misAJour)
  }
}
