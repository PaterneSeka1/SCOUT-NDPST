import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common'
import { LABELS_TYPE_DEMANDE } from '@scout/shared'
import type { Prisma, StatutDemande, TypeDemande } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import { echapperHtml, envoyerEmailBrut } from '../../common/lib/email'
import { logger } from '../../common/lib/logger'
import { lirePagination, metaPagination, texteRequete } from '../../common/lib/pagination'
import { limiteAtteinte, limiterTaux } from '../../common/lib/rateLimit'
import { env } from '../../config/env'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigurationService } from '../configuration/configuration.service'
import type { CorpsDemandePublique, CorpsTraitementDemande } from './adhesions.schemas'

const MAX_DEMANDES_PAR_HEURE = 5
const FENETRE_MS = 60 * 60 * 1000
// En dessous de ce délai, le formulaire a été rempli par un robot.
const DELAI_MINIMAL_MS = 3000

const STATUTS: StatutDemande[] = ['NOUVELLE', 'EN_COURS', 'ACCEPTEE', 'REFUSEE', 'ARCHIVEE']
const TYPES: TypeDemande[] = ['INSCRIPTION_JEUNE', 'ENGAGEMENT_ADULTE', 'INFORMATION']

@Injectable()
export class AdhesionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly configuration: ConfigurationService,
  ) {}

  // Une demande publique n'ouvre jamais de compte : elle est seulement
  // enregistrée pour être traitée par la direction du groupe.
  async recevoir(corps: CorpsDemandePublique, ip: string): Promise<{ recue: true }> {
    const cle = `demande-adhesion:${ip}`
    if (await limiteAtteinte(cle, MAX_DEMANDES_PAR_HEURE)) {
      throw new HttpException(
        { erreur: 'Trop de demandes envoyées. Réessayez plus tard ou contactez-nous directement.' },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    await limiterTaux(cle, MAX_DEMANDES_PAR_HEURE, FENETRE_MS)

    // Robot probable : réponse identique à un succès, rien n'est enregistré.
    if (corps.siteWeb || (corps.ouvertLe && Date.now() - corps.ouvertLe < DELAI_MINIMAL_MS)) {
      logger.warn('adhesion.spam_ignore', { ip })
      return { recue: true }
    }

    const config = await this.configuration.lire()
    if (corps.type === 'INSCRIPTION_JEUNE' && !config.inscriptionsOuvertes) {
      throw new ForbiddenException('Les inscriptions sont actuellement fermées. Vous pouvez nous écrire pour être informé.')
    }

    const jeune = corps.type === 'INSCRIPTION_JEUNE'
    const demande = await this.prisma.demandeAdhesion.create({
      data: {
        type: corps.type,
        nomContact: corps.nomContact,
        prenomContact: corps.prenomContact,
        telephone: corps.telephone,
        email: corps.email,
        nomJeune: jeune ? (corps.nomJeune ?? null) : null,
        prenomJeune: jeune ? (corps.prenomJeune ?? null) : null,
        dateNaissanceJeune: jeune ? corps.dateNaissanceJeune : null,
        brancheSouhaitee: jeune ? (corps.brancheSouhaitee ?? null) : null,
        message: corps.message ?? null,
        consentementLe: new Date(),
      },
    })
    await this.audit.enregistrer({
      action: 'DEMANDE_RECUE',
      entite: 'DemandeAdhesion',
      entiteId: demande.id,
      details: { type: demande.type },
    })

    // Notification sans aucune donnée personnelle : seulement le type et le lien.
    if (config.email) {
      const lien = `${env().URL_FRONTEND_PAROISSE.replace(/\/$/, '')}/admin/demandes/${demande.id}`
      void envoyerEmailBrut(
        config.email,
        'Nouvelle demande reçue sur le site',
        `<p>Une nouvelle demande (${echapperHtml(LABELS_TYPE_DEMANDE[demande.type])}) a été reçue.</p><p><a href="${echapperHtml(lien)}">La consulter dans l'espace de gestion</a></p>`,
      )
    }
    return { recue: true }
  }

  async lister(requete: Record<string, unknown>) {
    const pagination = lirePagination(requete)
    const statut = STATUTS.find((s) => s === requete.statut)
    const type = TYPES.find((t) => t === requete.type)
    const q = texteRequete(requete.q)
    const where: Prisma.DemandeAdhesionWhereInput = {
      ...(statut ? { statut } : { statut: { not: 'ARCHIVEE' } }),
      ...(type ? { type } : {}),
      ...(q
        ? {
            OR: [
              { nomContact: { contains: q, mode: 'insensitive' } },
              { prenomContact: { contains: q, mode: 'insensitive' } },
              { nomJeune: { contains: q, mode: 'insensitive' } },
              { prenomJeune: { contains: q, mode: 'insensitive' } },
              { telephone: { contains: q } },
            ],
          }
        : {}),
    }
    const [demandes, total, nouvelles] = await Promise.all([
      this.prisma.demandeAdhesion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limite,
        select: {
          id: true,
          type: true,
          statut: true,
          nomContact: true,
          prenomContact: true,
          nomJeune: true,
          prenomJeune: true,
          brancheSouhaitee: true,
          createdAt: true,
        },
      }),
      this.prisma.demandeAdhesion.count({ where }),
      this.prisma.demandeAdhesion.count({ where: { statut: 'NOUVELLE' } }),
    ])
    return { demandes, nouvelles, pagination: metaPagination(pagination, total) }
  }

  async detail(id: string) {
    const demande = await this.prisma.demandeAdhesion.findUnique({
      where: { id },
      include: { traiteePar: { select: { prenom: true, nom: true } } },
    })
    if (!demande) throw new NotFoundException('Demande introuvable')
    return demande
  }

  async traiter(id: string, corps: CorpsTraitementDemande, acteurId: string) {
    const existante = await this.detail(id)
    const demande = await this.prisma.demandeAdhesion.update({
      where: { id },
      data: {
        ...(corps.statut ? { statut: corps.statut } : {}),
        ...(corps.notesInternes !== undefined ? { notesInternes: corps.notesInternes } : {}),
        ...(corps.statut && corps.statut !== existante.statut ? { traiteeLe: new Date(), traiteeParId: acteurId } : {}),
      },
    })
    await this.audit.enregistrer({
      acteurId,
      action: 'DEMANDE_TRAITEE',
      entite: 'DemandeAdhesion',
      entiteId: id,
      details: { avant: existante.statut, apres: demande.statut },
    })
    return demande
  }
}
