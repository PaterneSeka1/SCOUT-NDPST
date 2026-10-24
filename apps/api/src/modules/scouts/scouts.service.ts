import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ROLES_TOUT_STAFF, entierBorne, estValeurEnum } from '@scout/shared'
import { hash } from 'bcryptjs'
import { BrancheType, Prisma, Sexe } from '../../generated/prisma/client'
import { AccesFichiersService } from '../../common/acces-fichiers.service'
import { AuditService } from '../../common/audit.service'
import type { UtilisateurSession } from '../../common/types'
import { logger } from '../../common/lib/logger'
import { PrismaService } from '../../prisma/prisma.service'
import { AccesScoutsService } from './acces-scouts.service'
import { chaine } from './corps'
import type {
  DonneesCreationScout,
  DonneesModificationScout,
  DonneesCreationCompteScout,
  DonneesMatriculeScout,
  DonneesImportScouts,
  DonneesRechercheDoublons,
} from './scouts.schemas'

// Comparaison des noms insensible à la casse, aux accents et aux espaces
// multiples. Côté base, `translate` couvre les lettres accentuées usuelles
// (minuscules et majuscules, sans dépendre de l'extension PostgreSQL unaccent
// ni de la locale) ; ces tables restent alignées sur normaliserNom (vérifié
// par les tests).
const ACCENTS_MINUSCULES = 'àáâãäåāăąçćĉċčďèéêëēĕėęěìíîïĩīĭįñńňòóôõöōŏőùúûüũūŭůűųýÿŷźżž'
const BASES_MINUSCULES = 'aaaaaaaaacccccdeeeeeeeeeiiiiiiiinnnoooooooouuuuuuuuuuyyyzzz'
export const ACCENTS_SOURCE = ACCENTS_MINUSCULES + ACCENTS_MINUSCULES.toUpperCase()
export const ACCENTS_CIBLE = BASES_MINUSCULES + BASES_MINUSCULES

export function normaliserNom(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export interface CorrespondanceDoublon {
  id: string
  nom: string
  prenom: string
  brancheType: BrancheType
  dateNaissance: Date
  actif: boolean
}

export interface FiltresListe {
  page: string | null
  limite: string | null
  recherche: string | null
  actif: string | null
  branche: string | null
}

interface ResultatLigne {
  ligne: number
  succes: boolean
  erreur?: string
  scoutId?: string
  nom?: string
  prenom?: string
}

interface LigneValidee {
  nom: string
  prenom: string
  dateNaissance: Date
  sexe: Sexe
  brancheType: BrancheType
  matricule: string | null
  contact: { nom: string; prenom: string | null; telephone: string; relation: string | null }
}

@Injectable()
export class ScoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly acces: AccesScoutsService,
    private readonly fichiers: AccesFichiersService,
  ) {}

  async lister(utilisateur: UtilisateurSession, filtres: FiltresListe) {
    const page = entierBorne(filtres.page, 1, 1, Number.MAX_SAFE_INTEGER)
    const limite = entierBorne(filtres.limite, 20, 1, 100)
    const recherche = filtres.recherche?.trim() || undefined

    // Les responsables de branche ne voient QUE leur branche — toute valeur
    // "branche" fournie par le client est ignorée pour ce groupe de rôles,
    // sinon un simple `?branche=AUTRE` dans l'URL suffirait à voir tout le groupe.
    let branche: string | undefined = filtres.branche ?? undefined
    if (this.acces.estRoleBranche(utilisateur)) {
      const bt = await this.acces.brancheImposee(utilisateur)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que tout le groupe par défaut.
      if (!bt) return { scouts: [], total: 0, page, limite, totalPages: 0 }
      branche = bt
    } else if (branche && !estValeurEnum(BrancheType, branche)) {
      throw new BadRequestException('Branche invalide')
    }

    const where: Prisma.ScoutWhereInput = {
      ...(branche ? { brancheType: branche as BrancheType } : {}),
      ...(filtres.actif !== null ? { actif: filtres.actif === 'true' } : {}),
      ...(recherche
        ? {
            OR: [
              { nom: { contains: recherche, mode: 'insensitive' } },
              { prenom: { contains: recherche, mode: 'insensitive' } },
              { matricule: { contains: recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [scouts, total] = await Promise.all([
      this.prisma.scout.findMany({
        where,
        select: {
          id: true,
          nom: true,
          prenom: true,
          dateNaissance: true,
          sexe: true,
          brancheType: true,
          matricule: true,
          actif: true,
          photo: true,
          utilisateurId: true,
          createdAt: true,
          equipeId: true,
          equipe: { select: { id: true, nom: true } },
          _count: { select: { contactsUrgence: true } },
        },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        skip: (page - 1) * limite,
        take: limite,
      }),
      this.prisma.scout.count({ where }),
    ])

    return { scouts, total, page, limite, totalPages: Math.ceil(total / limite) }
  }

  // Équipe facultative : doit exister, être active et appartenir à la branche
  // du scout. null = aucune équipe.
  private async verifierEquipe(equipeId: string | null | undefined, brancheType: BrancheType): Promise<void> {
    if (!equipeId) return
    const equipe = await this.prisma.equipe.findUnique({
      where: { id: equipeId },
      select: { actif: true, brancheType: true },
    })
    if (!equipe || !equipe.actif || equipe.brancheType !== brancheType) {
      throw new BadRequestException('Équipe invalide : équipe active de la branche du scout requise')
    }
  }

  // Détection de doublons avant inscription : même nom et prénom (insensible
  // à la casse et aux accents, inversion nom/prénom comprise), et même date de
  // naissance si elle est fournie. Réponse volontairement minimale (identité,
  // branche, date de naissance) : aucune donnée de fiche n'est exposée.
  async doublons(criteres: DonneesRechercheDoublons): Promise<{ correspondances: CorrespondanceDoublon[] }> {
    const nom = normaliserNom(criteres.nom)
    const prenom = normaliserNom(criteres.prenom)
    const colonne = (nomColonne: 'nom' | 'prenom') =>
      Prisma.sql`translate(lower(regexp_replace(trim(${Prisma.raw(`"${nomColonne}"`)}), '[[:space:]]+', ' ', 'g')), ${ACCENTS_SOURCE}, ${ACCENTS_CIBLE})`
    let filtreDate = Prisma.empty
    if (criteres.dateNaissance) {
      // Comparaison au jour près (UTC), quelle que soit l'heure saisie.
      const debut = new Date(criteres.dateNaissance)
      debut.setUTCHours(0, 0, 0, 0)
      const fin = new Date(debut.getTime() + 24 * 60 * 60 * 1000)
      filtreDate = Prisma.sql`AND "dateNaissance" >= ${debut} AND "dateNaissance" < ${fin}`
    }

    const correspondances = await this.prisma.$queryRaw<CorrespondanceDoublon[]>`
      SELECT "id", "nom", "prenom", "brancheType", "dateNaissance", "actif"
      FROM "Scout"
      WHERE "anonymiseLe" IS NULL
        AND (
          (${colonne('nom')} = ${nom} AND ${colonne('prenom')} = ${prenom})
          OR (${colonne('nom')} = ${prenom} AND ${colonne('prenom')} = ${nom})
        )
        ${filtreDate}
      ORDER BY "nom" ASC, "prenom" ASC
      LIMIT 20`
    return { correspondances }
  }

  async creer(utilisateur: UtilisateurSession, corps: DonneesCreationScout) {
    const {
      nom,
      prenom,
      dateNaissance,
      sexe,
      brancheType,
      photo,
      allergies,
      traitementsMedicaux,
      equipeId,
      contactsUrgence,
    } = corps
    if (photo?.trim()) await this.fichiers.verifierRattachable(utilisateur, photo.trim())

    // Un responsable de branche ne peut inscrire un scout que dans sa propre branche.
    let brancheEffective: BrancheType = brancheType
    if (this.acces.estRoleBranche(utilisateur)) {
      const bt = await this.acces.brancheImposee(utilisateur)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      brancheEffective = bt
    }
    await this.verifierEquipe(equipeId, brancheEffective)

    // Créer le scout et ses contacts en transaction
    const scout = await this.prisma.$transaction(async (tx) => {
      const nouveauScout = await tx.scout.create({
        data: {
          nom: nom.trim(),
          prenom: prenom.trim(),
          dateNaissance,
          sexe,
          brancheType: brancheEffective,
          photo: photo?.trim() || null,
          allergies: allergies?.trim() || null,
          traitementsMedicaux: traitementsMedicaux?.trim() || null,
          equipeId: equipeId ?? null,
        },
      })

      // Créer les contacts d'urgence
      for (const contact of contactsUrgence) {
        await tx.contactUrgence.create({ data: { ...contact, scoutId: nouveauScout.id } })
      }

      return tx.scout.findUniqueOrThrow({
        where: { id: nouveauScout.id },
        include: { contactsUrgence: true, equipe: { select: { id: true, nom: true } } },
      })
    })

    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'SCOUT_CREE',
      entite: 'Scout',
      entiteId: scout.id,
      details: { nom: scout.nom, prenom: scout.prenom },
    })

    return scout
  }

  async detail(utilisateur: UtilisateurSession, id: string) {
    if (!ROLES_TOUT_STAFF.includes(utilisateur.role)) {
      // Un scout ne peut consulter que sa propre fiche (ex. carte de membre),
      // jamais celle d'un autre — jamais via un id fourni par le client seul.
      if (utilisateur.role !== 'SCOUT') throw new ForbiddenException('Accès refusé')

      const scoutPropre = await this.prisma.scout.findFirst({
        where: { id, utilisateurId: utilisateur.id },
        select: { id: true, nom: true, prenom: true, photo: true, brancheType: true, matricule: true },
      })
      if (!scoutPropre) throw new NotFoundException('Scout introuvable')
      return scoutPropre
    }

    // Un responsable de branche ne peut consulter que les scouts de sa propre branche.
    const branche = await this.acces.brancheImposee(utilisateur)
    if (branche === null) throw new NotFoundException('Scout introuvable')

    const scout = await this.prisma.scout.findFirst({
      where: { id, ...(branche ? { brancheType: branche } : {}) },
      include: {
        equipe: { select: { id: true, nom: true, brancheType: true, actif: true } },
        contactsUrgence: { orderBy: [{ principal: 'desc' }, { nom: 'asc' }] },
        documents: { orderBy: { createdAt: 'desc' } },
        liensParents: {
          include: {
            parent: {
              select: { id: true, nom: true, prenom: true, telephone: true, email: true, role: true },
            },
          },
        },
        utilisateur: { select: { id: true, nom: true, prenom: true, matricule: true, actif: true } },
        cotisations: {
          orderBy: [{ statut: 'asc' }, { anneeScolaire: 'desc' }],
          select: {
            id: true,
            type: true,
            libelle: true,
            montant: true,
            anneeScolaire: true,
            statut: true,
            datePaiement: true,
          },
        },
      },
    })

    if (!scout) throw new NotFoundException('Scout introuvable')

    // Fiche complète d'un mineur (allergies, traitements, documents) :
    // chaque consultation est tracée (loi n° 2013-450, données sensibles).
    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'FICHE_SCOUT_CONSULTEE',
      entite: 'Scout',
      entiteId: id,
    })
    return scout
  }

  async modifier(utilisateur: UtilisateurSession, id: string, corps: DonneesModificationScout) {
    // Un responsable de branche ne peut modifier que les scouts de sa propre branche.
    const brancheUtilisateur = await this.acces.brancheImposee(utilisateur)
    if (brancheUtilisateur === null) throw new NotFoundException('Scout introuvable')

    const existant = await this.prisma.scout.findFirst({
      where: { id, ...(brancheUtilisateur ? { brancheType: brancheUtilisateur } : {}) },
      select: { id: true, brancheType: true, photo: true, actif: true, equipeId: true },
    })
    if (!existant) throw new NotFoundException('Scout introuvable')
    const {
      nom,
      prenom,
      dateNaissance,
      sexe,
      brancheType,
      actif,
      photo,
      allergies,
      traitementsMedicaux,
      consentementImage,
      consentementSante,
      equipeId,
    } = corps
    // Le changement de branche est réservé au groupe (fonctionnalité dédiée
    // "passage de branche") — un responsable de branche ne peut pas déplacer
    // un scout vers une autre branche via cette route.
    if (brancheUtilisateur && brancheType !== undefined && brancheType !== existant.brancheType) {
      throw new ForbiddenException('Le changement de branche est réservé au groupe')
    }
    if (photo?.trim()) await this.fichiers.verifierRattachable(utilisateur, photo.trim(), id)

    // Équipe : vérifiée contre la branche finale du scout. Un changement de
    // branche sans nouvelle équipe retire le scout de son ancienne équipe.
    const brancheFinale = (brancheType ?? existant.brancheType) as BrancheType
    let equipeFinale: string | null | undefined = equipeId
    if (equipeId === undefined && brancheFinale !== existant.brancheType && existant.equipeId) equipeFinale = null
    await this.verifierEquipe(equipeFinale, brancheFinale)

    const scout = await this.prisma.scout.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom: nom.trim() } : {}),
        ...(prenom !== undefined ? { prenom: prenom.trim() } : {}),
        ...(dateNaissance ? { dateNaissance } : {}),
        ...(sexe !== undefined ? { sexe: sexe as Sexe } : {}),
        ...(brancheType !== undefined ? { brancheType: brancheType as BrancheType } : {}),
        ...(equipeFinale !== undefined ? { equipeId: equipeFinale } : {}),
        // desactiveLe : point de départ du délai de conservation (anonymisation).
        ...(actif !== undefined
          ? { actif, ...(actif !== existant.actif ? { desactiveLe: actif ? null : new Date() } : {}) }
          : {}),
        ...(photo !== undefined ? { photo: photo?.trim() || null } : {}),
        ...(allergies !== undefined ? { allergies: allergies?.trim() || null } : {}),
        ...(traitementsMedicaux !== undefined ? { traitementsMedicaux: traitementsMedicaux?.trim() || null } : {}),
        ...(consentementImage !== undefined
          ? {
              consentementImage,
              consentementImageDate: consentementImage ? new Date() : null,
              consentementImageParId: consentementImage ? utilisateur.id : null,
              consentementImageOrigine: consentementImage ? 'SAISIE_ADMINISTRATIVE' : 'RETIRE',
            }
          : {}),
        ...(consentementSante !== undefined
          ? {
              consentementSante,
              consentementSanteDate: consentementSante ? new Date() : null,
              consentementSanteParId: consentementSante ? utilisateur.id : null,
              consentementSanteOrigine: consentementSante ? 'SAISIE_ADMINISTRATIVE' : 'RETIRE',
            }
          : {}),
      },
      include: { contactsUrgence: true, equipe: { select: { id: true, nom: true } } },
    })

    if (photo !== undefined && existant.photo && existant.photo !== scout.photo) {
      await this.fichiers.supprimerSiOrphelin(existant.photo)
    }

    if (allergies !== undefined || traitementsMedicaux !== undefined) {
      // Le contenu n'est jamais copié dans le journal : seuls les champs modifiés.
      await this.audit.enregistrer({
        acteurId: utilisateur.id,
        action: 'SCOUT_DONNEES_MEDICALES_MODIFIEES',
        entite: 'Scout',
        entiteId: id,
        details: {
          champs: [
            ...(allergies !== undefined ? ['allergies'] : []),
            ...(traitementsMedicaux !== undefined ? ['traitementsMedicaux'] : []),
          ],
        },
      })
    }

    if (consentementImage !== undefined) {
      await this.audit.enregistrer({
        acteurId: utilisateur.id,
        action: 'SCOUT_CONSENTEMENT_IMAGE_MODIFIE',
        entite: 'Scout',
        entiteId: id,
        details: {
          consentementImage,
          source: consentementImage ? 'SAISIE_ADMINISTRATIVE' : 'RETIRE',
          methode: 'INTERFACE_ADMINISTRATIVE',
        },
      })
    }

    if (consentementSante !== undefined) {
      await this.audit.enregistrer({
        acteurId: utilisateur.id,
        action: 'SCOUT_CONSENTEMENT_SANTE_MODIFIE',
        entite: 'Scout',
        entiteId: id,
        details: {
          consentementSante,
          source: consentementSante ? 'SAISIE_ADMINISTRATIVE' : 'RETIRE',
          methode: 'INTERFACE_ADMINISTRATIVE',
        },
      })
    }

    return scout
  }

  // Création du compte utilisateur (rôle SCOUT) rattaché à un scout.
  async creerCompte(utilisateur: UtilisateurSession, id: string, corps: DonneesCreationCompteScout) {
    const scout = await this.prisma.scout.findFirst({
      where: { id },
      select: { id: true, nom: true, prenom: true, matricule: true, utilisateurId: true },
    })
    if (!scout) throw new NotFoundException('Scout introuvable')
    if (!scout.matricule) {
      throw new BadRequestException('Le scout doit avoir un matricule avant de créer un compte')
    }
    if (scout.utilisateurId) throw new BadRequestException('Ce scout possède déjà un compte utilisateur')
    const { password, telephone } = corps

    // Vérifier que le matricule n'est pas déjà utilisé par un utilisateur
    const matriculeExistant = await this.prisma.utilisateur.findUnique({
      where: { matricule: scout.matricule },
      select: { id: true },
    })
    if (matriculeExistant) {
      throw new BadRequestException('Ce matricule est déjà utilisé par un compte existant')
    }

    const passwordHache = await hash(password, 12)

    return this.prisma.$transaction(async (tx) => {
      const nouvelUtilisateur = await tx.utilisateur.create({
        data: {
          nom: scout.nom,
          prenom: scout.prenom,
          matricule: scout.matricule,
          telephone: telephone?.trim() || null,
          role: 'SCOUT',
          password: passwordHache,
          doitChangerMotDePasse: true,
        },
        select: { id: true, nom: true, prenom: true, matricule: true, role: true, actif: true },
      })

      await tx.scout.update({ where: { id }, data: { utilisateurId: nouvelUtilisateur.id } })

      return nouvelUtilisateur
    })
  }

  async attribuerMatricule(utilisateur: UtilisateurSession, id: string, corps: DonneesMatriculeScout) {
    const existant = await this.prisma.scout.findFirst({
      where: { id },
      select: { id: true, matricule: true },
    })
    if (!existant) throw new NotFoundException('Scout introuvable')
    const { matricule } = corps

    // Vérifier l'unicité du matricule
    const doublon = await this.prisma.scout.findFirst({
      where: { matricule, NOT: { id } },
      select: { id: true },
    })
    if (doublon) throw new BadRequestException('Ce matricule est déjà attribué à un autre scout')

    let scout
    try {
      scout = await this.prisma.scout.update({
        where: { id },
        data: { matricule },
        select: { id: true, nom: true, prenom: true, matricule: true, brancheType: true, actif: true },
      })
    } catch (erreur) {
      // Attribution concurrente du même matricule : la contrainte unique a tranché.
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException('Ce matricule est déjà attribué à un autre scout')
      }
      throw erreur
    }

    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'SCOUT_MATRICULE_ATTRIBUE',
      entite: 'Scout',
      entiteId: id,
      details: { ancienMatricule: existant.matricule, nouveauMatricule: matricule },
    })

    return scout
  }

  async importer(utilisateur: UtilisateurSession, corps: DonneesImportScouts) {
    const { scouts } = corps

    // Comme POST /api/scouts : un responsable de branche n'inscrit que dans sa
    // propre branche — la branche du fichier est ignorée et forcée.
    let brancheForcee: BrancheType | null = null
    if (this.acces.estRoleBranche(utilisateur)) {
      const bt = await this.acces.brancheImposee(utilisateur)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      brancheForcee = bt
    }

    const matriculesVus = new Set<string>()
    const resultats: ResultatLigne[] = []

    for (const [index, ligne] of (scouts as unknown[]).entries()) {
      const numeroLigne = index + 1
      const validation = validerLigne(ligne)

      if ('erreur' in validation) {
        resultats.push({ ligne: numeroLigne, succes: false, erreur: validation.erreur })
        continue
      }

      if (validation.matricule) {
        if (matriculesVus.has(validation.matricule)) {
          resultats.push({
            ligne: numeroLigne,
            succes: false,
            erreur: `Matricule "${validation.matricule}" en double dans le fichier`,
          })
          continue
        }
        const existant = await this.prisma.scout.findUnique({
          where: { matricule: validation.matricule },
          select: { id: true },
        })
        if (existant) {
          resultats.push({
            ligne: numeroLigne,
            succes: false,
            erreur: `Matricule "${validation.matricule}" déjà utilisé`,
          })
          continue
        }
        matriculesVus.add(validation.matricule)
      }

      try {
        const scout = await this.prisma.$transaction(async (tx) => {
          const nouveauScout = await tx.scout.create({
            data: {
              nom: validation.nom,
              prenom: validation.prenom,
              dateNaissance: validation.dateNaissance,
              sexe: validation.sexe,
              brancheType: brancheForcee ?? validation.brancheType,
              matricule: validation.matricule,
            },
          })
          await tx.contactUrgence.create({
            data: { ...validation.contact, principal: true, scoutId: nouveauScout.id },
          })
          return nouveauScout
        })

        resultats.push({ ligne: numeroLigne, succes: true, scoutId: scout.id, nom: scout.nom, prenom: scout.prenom })
      } catch (erreur) {
        logger.error('POST /api/scouts/import ligne', erreur, { ligne: numeroLigne })
        resultats.push({ ligne: numeroLigne, succes: false, erreur: 'Erreur serveur lors de la création' })
      }
    }

    const nbSucces = resultats.filter((r) => r.succes).length

    if (nbSucces > 0) {
      await this.audit.enregistrer({
        acteurId: utilisateur.id,
        action: 'SCOUTS_IMPORTES',
        entite: 'Scout',
        details: { nbSucces, nbEchecs: resultats.length - nbSucces, brancheForcee },
      })
    }
    return { resultats, nbSucces, nbEchecs: resultats.length - nbSucces }
  }
}

// Valide une ligne et retourne soit les données prêtes pour Prisma, soit un
// message d'erreur — mêmes règles que la création d'un scout à l'unité
// (POST /api/scouts), pour ne pas avoir deux logiques métier divergentes.
function validerLigne(ligne: unknown): { erreur: string } | LigneValidee {
  const nom = chaine(ligne, 'nom')?.trim()
  const prenom = chaine(ligne, 'prenom')?.trim()
  if (!nom) return { erreur: 'Le nom est requis' }
  if (!prenom) return { erreur: 'Le prénom est requis' }
  const dateTexte = chaine(ligne, 'dateNaissance')?.trim()
  if (!dateTexte) return { erreur: 'La date de naissance est requise' }
  const dateNaissance = new Date(dateTexte)
  if (Number.isNaN(dateNaissance.getTime())) {
    return { erreur: 'Date de naissance invalide (format attendu : AAAA-MM-JJ)' }
  }

  const sexe = chaine(ligne, 'sexe')?.trim().toUpperCase()
  if (!sexe || !estValeurEnum(Sexe, sexe)) return { erreur: 'Sexe invalide (MASCULIN ou FEMININ attendu)' }

  const brancheType = chaine(ligne, 'brancheType')?.trim().toUpperCase()
  if (!brancheType || !estValeurEnum(BrancheType, brancheType)) {
    return {
      erreur:
        'Branche invalide (OISILLONS, LOUVETEAUX, ECLAIREURS, CHEMINOTS, COMPAGNONS ou RESSOURCES_ADULTES attendu)',
    }
  }

  const contactNom = chaine(ligne, 'contactNom')?.trim()
  const contactTelephone = chaine(ligne, 'contactTelephone')?.trim()
  if (!contactNom) return { erreur: "Le nom du contact d'urgence est requis" }
  if (!contactTelephone) return { erreur: "Le téléphone du contact d'urgence est requis" }

  return {
    nom,
    prenom,
    dateNaissance,
    sexe,
    brancheType,
    matricule: chaine(ligne, 'matricule')?.trim() || null,
    contact: {
      nom: contactNom,
      prenom: chaine(ligne, 'contactPrenom')?.trim() || null,
      telephone: contactTelephone,
      relation: chaine(ligne, 'contactRelation')?.trim() || null,
    },
  }
}
