import { Injectable } from '@nestjs/common'
import { THEME_DEFAUT, couleurSure } from '@scout/shared'
import type { ConfigurationInstallation, Prisma } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import { PrismaService } from '../../prisma/prisma.service'
import type { DonneesConfiguration } from './configuration.schemas'

export const ID_CONFIGURATION = 'installation'

// Identité de LA paroisse : ressource unique, créée par la migration ou
// l'initialisation. Le service ne propose que la lecture et la mise à jour —
// jamais de création multiple ni de suppression.
@Injectable()
export class ConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // upsert défensif : une base restaurée sans la ligne retrouve une
  // configuration vide (à compléter), sans erreur.
  lire(): Promise<ConfigurationInstallation> {
    return this.prisma.configurationInstallation.upsert({
      where: { id: ID_CONFIGURATION },
      create: { id: ID_CONFIGURATION },
      update: {},
    })
  }

  async modifier(donnees: DonneesConfiguration, acteurId: string): Promise<ConfigurationInstallation> {
    const { reseauxSociaux, ...champs } = donnees
    const data: Prisma.ConfigurationInstallationUpdateInput = {
      ...Object.fromEntries(Object.entries(champs).filter(([, valeur]) => valeur !== undefined)),
      ...(reseauxSociaux !== undefined ? { reseauxSociaux } : {}),
      updatedById: acteurId,
    }
    const config = await this.prisma.configurationInstallation.upsert({
      where: { id: ID_CONFIGURATION },
      create: { id: ID_CONFIGURATION, ...(data as Prisma.ConfigurationInstallationCreateInput) },
      update: data,
    })
    await this.audit.enregistrer({
      acteurId,
      action: 'CONFIGURATION_MODIFIEE',
      entite: 'ConfigurationInstallation',
      entiteId: ID_CONFIGURATION,
      details: { champs: Object.keys(donnees).filter((cle) => donnees[cle as keyof DonneesConfiguration] !== undefined) },
    })
    return config
  }

  // Projection publique : couleurs revalidées (injectées dans une balise
  // <style> par le frontend) et rang historique masqué tant qu'il n'est pas
  // confirmé par une source.
  async identitePublique() {
    const c = await this.lire()
    return {
      nomParoisse: c.nomParoisse,
      nomGroupe: c.nomGroupe,
      ville: c.ville,
      diocese: c.diocese,
      presentation: c.presentation,
      messageBienvenue: c.messageBienvenue,
      anneeHistorique: c.anneeHistorique,
      rangHistorique: c.rangHistoriqueValide ? c.rangHistorique : null,
      sourceHistorique: c.rangHistoriqueValide ? c.sourceHistorique : null,
      adresse: c.adresse,
      telephone: c.telephone,
      email: c.email,
      horaires: c.horaires,
      logoUrl: c.logoUrl || null,
      theme: {
        couleurPrimaire: couleurSure(c.couleurPrimaire, THEME_DEFAUT.couleurPrimaire),
        couleurAccent: couleurSure(c.couleurAccent, THEME_DEFAUT.couleurAccent),
        couleurFond: couleurSure(c.couleurFond, THEME_DEFAUT.couleurFond),
        couleurHover: couleurSure(c.couleurHover, THEME_DEFAUT.couleurHover),
      },
      accueil: {
        titre: c.heroTitre,
        sousTitre: c.heroSousTitre,
        imageUrl: c.heroImageUrl || null,
        imageAlt: c.heroImageAlt,
      },
      reseauxSociaux: (c.reseauxSociaux as Record<string, string> | null) ?? {},
      inscriptionsOuvertes: c.inscriptionsOuvertes,
    }
  }
}
