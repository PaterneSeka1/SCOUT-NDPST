import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { THEME_DEFAUT, couleurSure } from '@scout/shared'
import { Public } from '../../common/decorators/public.decorator'
import { PrismaService } from '../../prisma/prisma.service'

@ApiTags('Plateforme publique')
@Controller('public')
export class PlateformePubliqueController {
  constructor(private readonly prisma: PrismaService) {}

  // Public : sert l'identité de la PLATEFORME (pas celle d'une paroisse). Un
  // visiteur non connecté n'a aucun moyen d'indiquer sa paroisse (ni
  // sous-domaine ni sélecteur) : les pages pré-connexion (accueil, connexion)
  // affichent toujours l'identité commune, gérée par ADMIN_PLATEFORME.
  // L'identité propre à chaque paroisse n'apparaît qu'une fois connecté.
  @Public()
  @Get('logo')
  async logo() {
    const cfg = await this.prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } })
    return {
      // L'API ne connaît pas le logo par défaut du frontend : null (ou chaîne
      // vide en base) laisse le frontend appliquer son propre logo officiel.
      logoUrl: cfg?.logoUrl || null,
      nomSite: cfg?.nomSite ?? 'SCOUT ASCCI',
      sousTitreSite: cfg?.sousTitreSite ?? "Côte d'Ivoire",
    }
  }

  // Public : même justification que /public/logo. Identité complète de la
  // plateforme pour le rendu des pages (thème, contenu de la page d'accueil).
  // Les couleurs sont revalidées ici : elles sont injectées telles quelles
  // dans une balise <style> par les frontends. Les champs d'accueil absents
  // restent null : chaque frontend applique ses propres textes par défaut.
  @Public()
  @Get('identite')
  async identite() {
    const cfg = await this.prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } })
    return {
      nomSite: cfg?.nomSite ?? 'SCOUT ASCCI',
      sousTitreSite: cfg?.sousTitreSite ?? "Côte d'Ivoire",
      logoUrl: cfg?.logoUrl || null,
      theme: {
        couleurPrimaire: couleurSure(cfg?.couleurPrimaire, THEME_DEFAUT.couleurPrimaire),
        couleurAccent: couleurSure(cfg?.couleurAccent, THEME_DEFAUT.couleurAccent),
        couleurFond: couleurSure(cfg?.couleurFond, THEME_DEFAUT.couleurFond),
        couleurHover: couleurSure(cfg?.couleurHover, THEME_DEFAUT.couleurHover),
      },
      accueil: {
        badge: cfg?.heroBadge || null,
        titre: cfg?.heroTitre || null,
        sousTitre: cfg?.heroSousTitre || null,
        imageUrl: cfg?.heroImageUrl || null,
        imageAlt: cfg?.heroImageAlt || null,
        stats: Array.isArray(cfg?.stats) ? cfg.stats : null,
      },
    }
  }
}
