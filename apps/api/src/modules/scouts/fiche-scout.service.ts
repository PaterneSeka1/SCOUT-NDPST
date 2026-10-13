import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { estCheminLocalValide, estValeurEnum } from '@scout/shared'
import { TypeDocument } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import { AccesScoutsService } from './acces-scouts.service'
import { corpsObjet, booleen, texte, texteOuNull } from './corps'

// Contacts d'urgence et documents d'un scout. Chaque opération vérifie d'abord
// que le scout appartient à la paroisse de l'utilisateur, et à sa branche pour
// un responsable de branche (contact d'urgence, fiche médicale, autorisation
// parentale = données sensibles d'un mineur, même cloisonnement que la fiche).
@Injectable()
export class FicheScoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly acces: AccesScoutsService,
  ) {}

  async ajouterContact(utilisateur: UtilisateurSession, scoutId: string, brut: unknown) {
    await this.acces.verifierScoutGere(utilisateur, scoutId)
    const corps = corpsObjet(brut)

    const nom = texte(corps, 'nom')
    const prenom = texteOuNull(corps, 'prenom')
    const telephone = texte(corps, 'telephone')
    const relation = texteOuNull(corps, 'relation')
    const principal = corps.principal === true

    if (!nom?.trim()) throw new BadRequestException('Le nom du contact est requis')
    if (!telephone?.trim()) throw new BadRequestException('Le téléphone du contact est requis')

    // Si le nouveau contact est principal, retirer le statut des autres — dans
    // la même transaction, pour ne jamais laisser le scout sans contact
    // principal si la création échoue.
    return this.prisma.$transaction(async (tx) => {
      if (principal) {
        await tx.contactUrgence.updateMany({
          where: { scoutId, principal: true },
          data: { principal: false },
        })
      }

      return tx.contactUrgence.create({
        data: {
          nom: nom.trim(),
          prenom: prenom?.trim() || null,
          telephone: telephone.trim(),
          relation: relation?.trim() || null,
          principal,
          scoutId,
        },
      })
    })
  }

  async modifierContact(utilisateur: UtilisateurSession, scoutId: string, contactId: string, brut: unknown) {
    await this.acces.verifierScoutGere(utilisateur, scoutId)

    const contact = await this.prisma.contactUrgence.findFirst({ where: { id: contactId, scoutId } })
    if (!contact) throw new NotFoundException('Contact introuvable')
    const corps = corpsObjet(brut)

    const nom = texte(corps, 'nom')
    const prenom = texteOuNull(corps, 'prenom')
    const telephone = texte(corps, 'telephone')
    const relation = texteOuNull(corps, 'relation')
    const principal = booleen(corps, 'principal')

    // Si passage en principal, retirer le statut des autres — dans la même
    // transaction que la mise à jour, pour rester cohérent en cas d'échec.
    return this.prisma.$transaction(async (tx) => {
      if (principal === true && !contact.principal) {
        await tx.contactUrgence.updateMany({
          where: { scoutId, principal: true, NOT: { id: contactId } },
          data: { principal: false },
        })
      }

      return tx.contactUrgence.update({
        where: { id: contactId },
        data: {
          ...(nom !== undefined ? { nom: nom.trim() } : {}),
          ...(prenom !== undefined ? { prenom: prenom?.trim() || null } : {}),
          ...(telephone !== undefined ? { telephone: telephone.trim() } : {}),
          ...(relation !== undefined ? { relation: relation?.trim() || null } : {}),
          ...(principal !== undefined ? { principal } : {}),
        },
      })
    })
  }

  async supprimerContact(utilisateur: UtilisateurSession, scoutId: string, contactId: string) {
    await this.acces.verifierScoutGere(utilisateur, scoutId)

    // Vérifier qu'il ne s'agit pas du dernier contact
    const nbContacts = await this.prisma.contactUrgence.count({ where: { scoutId } })
    if (nbContacts <= 1) throw new BadRequestException("Impossible de supprimer le dernier contact d'urgence")

    const contact = await this.prisma.contactUrgence.findFirst({ where: { id: contactId, scoutId } })
    if (!contact) throw new NotFoundException('Contact introuvable')

    await this.prisma.contactUrgence.delete({ where: { id: contactId } })
    return { message: 'Contact supprimé' }
  }

  async ajouterDocument(utilisateur: UtilisateurSession, scoutId: string, brut: unknown) {
    await this.acces.verifierScoutGere(utilisateur, scoutId)
    const corps = corpsObjet(brut)

    const type = corps.type
    const nomFichier = texte(corps, 'nomFichier')
    const url = texte(corps, 'url')
    const dateExpiration = texteOuNull(corps, 'dateExpiration')

    // estValeurEnum plutôt que `type in TypeDocument` : `in` remonte la chaîne
    // de prototypes et accepterait "toString", "constructor"…
    if (!type || !estValeurEnum(TypeDocument, type)) throw new BadRequestException('Type de document invalide')
    if (!nomFichier?.trim() || !url?.trim()) throw new BadRequestException('Le fichier est requis')
    if (!estCheminLocalValide(url.trim())) {
      throw new BadRequestException('url doit être un chemin local (ex : /api/fichiers/…)')
    }
    let dateExpirationValide: Date | null = null
    if (dateExpiration) {
      dateExpirationValide = new Date(dateExpiration)
      if (Number.isNaN(dateExpirationValide.getTime())) throw new BadRequestException("Date d'expiration invalide")
    }

    return this.prisma.document.create({
      data: {
        type,
        nomFichier: nomFichier.trim(),
        url: url.trim(),
        dateExpiration: dateExpirationValide,
        scoutId,
      },
    })
  }

  async supprimerDocument(utilisateur: UtilisateurSession, scoutId: string, documentId: string) {
    const paroisseId = await this.acces.verifierScoutGere(utilisateur, scoutId)

    const document = await this.prisma.document.findFirst({ where: { id: documentId, scoutId } })
    if (!document) throw new NotFoundException('Document introuvable')

    await this.prisma.document.delete({ where: { id: documentId } })

    await this.audit.enregistrer({
      paroisseId,
      acteurId: utilisateur.id,
      action: 'DOCUMENT_SUPPRIME',
      entite: 'Document',
      entiteId: documentId,
      details: { type: document.type, nomFichier: document.nomFichier, scoutId },
    })

    return { message: 'Document supprimé' }
  }
}
