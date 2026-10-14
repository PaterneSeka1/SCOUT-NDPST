import { Injectable } from '@nestjs/common'
import { entierBorne, LABELS_TYPE_DOCUMENT, ROLES_BRANCHE } from '@scout/shared'
import { env } from '../../config/env'
import { paroisseIdRequise } from '../../common/paroisse'
import { PerimetreService } from '../../common/perimetre.service'
import { verifierSecretCron } from '../../common/lib/cron'
import { logger } from '../../common/lib/logger'
import { envoyerEmailRappelDocuments, type DocumentARenouveler } from '../../common/lib/notifications'
import type { UtilisateurSession } from '../../common/types'
import type { BrancheType } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

const FENETRE_RAPPEL_JOURS = 7
// Borne haute de la fenêtre d'expiration consultable (10 ans) : au-delà, la
// date seuil n'a plus de sens et ferait échouer la requête.
const JOURS_AVANT_MAX = 3650

export { secretsCorrespondent } from '../../common/lib/cron'

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  // Documents déjà expirés ou arrivant à expiration dans les N prochains jours
  // (30 par défaut), pour les scouts actifs de la paroisse. Un responsable de
  // branche ne voit que les documents des scouts de sa propre branche.
  async expirations(utilisateur: UtilisateurSession, joursAvantParam: string | undefined) {
    const joursAvant = entierBorne(joursAvantParam ?? null, 30, 0, JOURS_AVANT_MAX)
    const seuil = new Date()
    seuil.setDate(seuil.getDate() + joursAvant)
    seuil.setHours(23, 59, 59, 999)

    const paroisseId = paroisseIdRequise(utilisateur)

    let brancheType: string | null = null
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      brancheType = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!brancheType) return { documents: [] }
    }

    const documents = await this.prisma.document.findMany({
      where: {
        dateExpiration: { lte: seuil },
        scout: {
          paroisseId,
          actif: true,
          ...(brancheType ? { brancheType: brancheType as BrancheType } : {}),
        },
      },
      select: {
        id: true,
        type: true,
        nomFichier: true,
        dateExpiration: true,
        valide: true,
        scout: { select: { id: true, nom: true, prenom: true, matricule: true, brancheType: true } },
      },
      orderBy: { dateExpiration: 'asc' },
    })

    const aujourdhui = new Date()
    return {
      documents: documents.map((d) => ({
        ...d,
        expire: d.dateExpiration != null && d.dateExpiration < aujourdhui,
      })),
    }
  }

  // Vérifie le secret partagé du déclencheur externe (en-tête x-cron-secret).
  verifierSecretCron(secretRecu: string | undefined): void {
    verifierSecretCron(secretRecu)
  }

  // Envoie un rappel par e-mail à chaque parent dont un enfant a un document
  // expirant dans les 7 prochains jours. Chaque document n'est rappelé qu'une
  // fois (rappelEnvoyeLe) : le déclencheur peut tourner chaque jour sans
  // renvoyer les mêmes e-mails.
  async envoyerRappels(): Promise<{ documentsConcernes: number; parentsNotifies: number }> {
    const seuil = new Date()
    seuil.setDate(seuil.getDate() + FENETRE_RAPPEL_JOURS)
    seuil.setHours(23, 59, 59, 999)
    const maintenant = new Date()

    const documents = await this.prisma.document.findMany({
      where: {
        dateExpiration: { gte: maintenant, lte: seuil },
        rappelEnvoyeLe: null,
        scout: { actif: true },
      },
      select: {
        id: true,
        type: true,
        dateExpiration: true,
        scout: {
          select: {
            nom: true,
            prenom: true,
            liensParents: { select: { parent: { select: { id: true, email: true, prenom: true } } } },
          },
        },
      },
    })

    const parDestinataire = new Map<string, { email: string; prenom: string; documents: DocumentARenouveler[] }>()

    for (const doc of documents) {
      if (!doc.dateExpiration) continue
      for (const lien of doc.scout.liensParents) {
        const parent = lien.parent
        if (!parent.email) continue
        const entree = parDestinataire.get(parent.id) ?? { email: parent.email, prenom: parent.prenom, documents: [] }
        entree.documents.push({
          scoutNomComplet: `${doc.scout.prenom} ${doc.scout.nom}`,
          typeLabel: LABELS_TYPE_DOCUMENT[doc.type] ?? doc.type,
          dateExpiration: doc.dateExpiration,
        })
        parDestinataire.set(parent.id, entree)
      }
    }

    const urlDocuments = `${env().URL_FRONTEND_PAROISSE.replace(/\/$/, '')}/dashboard/mes-enfants`
    let envoyes = 0
    for (const { email, prenom, documents: docsParent } of parDestinataire.values()) {
      await envoyerEmailRappelDocuments({ email, prenom, nomSite: 'SCOUT ASCCI', documents: docsParent, urlDocuments })
      envoyes += 1
    }

    // Marqués après l'envoi : un échec en cours de route n'empêche pas le
    // rappel au prochain passage.
    if (documents.length > 0) {
      await this.prisma.document.updateMany({
        where: { id: { in: documents.map((d) => d.id) } },
        data: { rappelEnvoyeLe: maintenant },
      })
    }

    logger.info('cron.rappels_documents', { documentsConcernes: documents.length, parentsNotifies: envoyes })
    return { documentsConcernes: documents.length, parentsNotifies: envoyes }
  }
}
