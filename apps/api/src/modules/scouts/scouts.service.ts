import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  REGLE_MOT_DE_PASSE,
  ROLES_TOUT_STAFF,
  entierBorne,
  estCheminLocalValide,
  estValeurEnum,
  motDePasseValide,
} from '@scout/shared'
import { hash } from 'bcryptjs'
import { BrancheType, Prisma, Sexe } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import { paroisseIdRequise } from '../../common/paroisse'
import type { UtilisateurSession } from '../../common/types'
import { logger } from '../../common/lib/logger'
import { PrismaService } from '../../prisma/prisma.service'
import { AccesScoutsService } from './acces-scouts.service'
import { corpsObjet, booleen, chaine, texte, texteOuNull } from './corps'

const MAX_LIGNES_IMPORT = 500

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
  ) {}

  async lister(utilisateur: UtilisateurSession, filtres: FiltresListe) {
    const page = entierBorne(filtres.page, 1, 1, Number.MAX_SAFE_INTEGER)
    const limite = entierBorne(filtres.limite, 20, 1, 100)
    const recherche = filtres.recherche || undefined
    const paroisseId = paroisseIdRequise(utilisateur)

    // Les responsables de branche ne voient QUE leur branche — toute valeur
    // "branche" fournie par le client est ignorée pour ce groupe de rôles,
    // sinon un simple `?branche=AUTRE` dans l'URL suffirait à voir toute la paroisse.
    let branche: string | undefined = filtres.branche ?? undefined
    if (this.acces.estRoleBranche(utilisateur)) {
      const bt = await this.acces.brancheImposee(utilisateur)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!bt) return { scouts: [], total: 0, page, totalPages: 0 }
      branche = bt
    } else if (branche && !estValeurEnum(BrancheType, branche)) {
      throw new BadRequestException('Branche invalide')
    }

    const where: Prisma.ScoutWhereInput = {
      paroisseId,
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
          paroisseId: true,
          utilisateurId: true,
          createdAt: true,
          _count: { select: { contactsUrgence: true } },
        },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        skip: (page - 1) * limite,
        take: limite,
      }),
      this.prisma.scout.count({ where }),
    ])

    return { scouts, total, page, totalPages: Math.ceil(total / limite) }
  }

  async creer(utilisateur: UtilisateurSession, brut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const corps = corpsObjet(brut)
    const nom = texte(corps, 'nom')
    const prenom = texte(corps, 'prenom')
    const dateNaissance = texte(corps, 'dateNaissance')
    const sexe = corps.sexe
    const brancheType = corps.brancheType
    const photo = texteOuNull(corps, 'photo')
    const allergies = texteOuNull(corps, 'allergies')
    const traitementsMedicaux = texteOuNull(corps, 'traitementsMedicaux')
    const contactsUrgence = corps.contactsUrgence

    // Validation des champs obligatoires
    if (!nom?.trim()) throw new BadRequestException('Le nom est requis')
    if (!prenom?.trim()) throw new BadRequestException('Le prénom est requis')
    if (!dateNaissance) throw new BadRequestException('La date de naissance est requise')
    const dateNaissanceObj = new Date(dateNaissance)
    if (Number.isNaN(dateNaissanceObj.getTime())) {
      throw new BadRequestException('La date de naissance est invalide')
    }
    if (!estValeurEnum(Sexe, sexe)) throw new BadRequestException('Le sexe est invalide ou manquant')
    if (!estValeurEnum(BrancheType, brancheType)) {
      throw new BadRequestException('La branche est invalide ou manquante')
    }
    if (photo != null && photo !== '' && !estCheminLocalValide(photo)) {
      throw new BadRequestException('photo doit être un chemin local (ex : /api/fichiers/…)')
    }

    // Un responsable de branche ne peut inscrire un scout que dans sa propre branche.
    let brancheEffective: BrancheType = brancheType
    if (this.acces.estRoleBranche(utilisateur)) {
      const bt = await this.acces.brancheImposee(utilisateur)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      brancheEffective = bt
    }

    // Validation des contacts d'urgence
    if (!Array.isArray(contactsUrgence) || contactsUrgence.length === 0) {
      throw new BadRequestException("Au moins un contact d'urgence est requis")
    }
    const contacts = contactsUrgence.map((contact: unknown, i) => {
      const nomContact = chaine(contact, 'nom')?.trim()
      const telephone = chaine(contact, 'telephone')?.trim()
      if (!nomContact) throw new BadRequestException(`Le nom du contact ${i + 1} est requis`)
      if (!telephone) throw new BadRequestException(`Le téléphone du contact ${i + 1} est requis`)
      const principal = (contact as Record<string, unknown>).principal
      return {
        nom: nomContact,
        prenom: chaine(contact, 'prenom')?.trim() || null,
        telephone,
        relation: chaine(contact, 'relation')?.trim() || null,
        principal: principal === true,
      }
    })

    // Créer le scout et ses contacts en transaction
    const scout = await this.prisma.$transaction(async (tx) => {
      const nouveauScout = await tx.scout.create({
        data: {
          nom: nom.trim(),
          prenom: prenom.trim(),
          dateNaissance: dateNaissanceObj,
          sexe,
          brancheType: brancheEffective,
          photo: photo?.trim() || null,
          allergies: allergies?.trim() || null,
          traitementsMedicaux: traitementsMedicaux?.trim() || null,
          paroisseId,
        },
      })

      // Créer les contacts d'urgence
      for (const contact of contacts) {
        await tx.contactUrgence.create({ data: { ...contact, scoutId: nouveauScout.id } })
      }

      return tx.scout.findUniqueOrThrow({
        where: { id: nouveauScout.id },
        include: { contactsUrgence: true },
      })
    })

    await this.audit.enregistrer({
      paroisseId,
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

    const paroisseId = paroisseIdRequise(utilisateur)

    // Un responsable de branche ne peut consulter que les scouts de sa propre branche.
    const branche = await this.acces.brancheImposee(utilisateur)
    if (branche === null) throw new NotFoundException('Scout introuvable')

    const scout = await this.prisma.scout.findFirst({
      where: { id, paroisseId, ...(branche ? { brancheType: branche } : {}) },
      include: {
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
    return scout
  }

  async modifier(utilisateur: UtilisateurSession, id: string, brut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)

    // Un responsable de branche ne peut modifier que les scouts de sa propre branche.
    const brancheUtilisateur = await this.acces.brancheImposee(utilisateur)
    if (brancheUtilisateur === null) throw new NotFoundException('Scout introuvable')

    const existant = await this.prisma.scout.findFirst({
      where: { id, paroisseId, ...(brancheUtilisateur ? { brancheType: brancheUtilisateur } : {}) },
      select: { id: true, brancheType: true },
    })
    if (!existant) throw new NotFoundException('Scout introuvable')
    const corps = corpsObjet(brut)

    const nom = texte(corps, 'nom')
    const prenom = texte(corps, 'prenom')
    const dateNaissance = texte(corps, 'dateNaissance')
    const sexe = corps.sexe
    const brancheType = corps.brancheType
    const actif = booleen(corps, 'actif')
    const photo = texteOuNull(corps, 'photo')
    const allergies = texteOuNull(corps, 'allergies')
    const traitementsMedicaux = texteOuNull(corps, 'traitementsMedicaux')
    const consentementImage = booleen(corps, 'consentementImage')

    const dateNaissanceObj = dateNaissance !== undefined ? new Date(dateNaissance) : undefined
    if (dateNaissanceObj && Number.isNaN(dateNaissanceObj.getTime())) {
      throw new BadRequestException('La date de naissance est invalide')
    }
    if (sexe !== undefined && !estValeurEnum(Sexe, sexe)) throw new BadRequestException('Sexe invalide')
    if (brancheType !== undefined && !estValeurEnum(BrancheType, brancheType)) {
      throw new BadRequestException('Branche invalide')
    }
    // Le changement de branche est réservé au groupe (fonctionnalité dédiée
    // "passage de branche") — un responsable de branche ne peut pas déplacer
    // un scout vers une autre branche via cette route.
    if (brancheUtilisateur && brancheType !== undefined && brancheType !== existant.brancheType) {
      throw new ForbiddenException('Le changement de branche est réservé au groupe')
    }
    if (photo != null && photo !== '' && !estCheminLocalValide(photo)) {
      throw new BadRequestException('photo doit être un chemin local (ex : /api/fichiers/…)')
    }

    const scout = await this.prisma.scout.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom: nom.trim() } : {}),
        ...(prenom !== undefined ? { prenom: prenom.trim() } : {}),
        ...(dateNaissanceObj ? { dateNaissance: dateNaissanceObj } : {}),
        ...(sexe !== undefined ? { sexe: sexe as Sexe } : {}),
        ...(brancheType !== undefined ? { brancheType: brancheType as BrancheType } : {}),
        ...(actif !== undefined ? { actif } : {}),
        ...(photo !== undefined ? { photo: photo?.trim() || null } : {}),
        ...(allergies !== undefined ? { allergies: allergies?.trim() || null } : {}),
        ...(traitementsMedicaux !== undefined ? { traitementsMedicaux: traitementsMedicaux?.trim() || null } : {}),
        ...(consentementImage !== undefined
          ? {
              consentementImage,
              consentementImageDate: consentementImage ? new Date() : null,
              consentementImageParId: consentementImage ? utilisateur.id : null,
            }
          : {}),
      },
      include: { contactsUrgence: true },
    })

    if (consentementImage !== undefined) {
      await this.audit.enregistrer({
        paroisseId,
        acteurId: utilisateur.id,
        action: 'SCOUT_CONSENTEMENT_IMAGE_MODIFIE',
        entite: 'Scout',
        entiteId: id,
        details: { consentementImage },
      })
    }

    return scout
  }

  // Création du compte utilisateur (rôle SCOUT) rattaché à un scout.
  async creerCompte(utilisateur: UtilisateurSession, id: string, brut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)

    const scout = await this.prisma.scout.findFirst({
      where: { id, paroisseId },
      select: { id: true, nom: true, prenom: true, matricule: true, utilisateurId: true },
    })
    if (!scout) throw new NotFoundException('Scout introuvable')
    if (!scout.matricule) {
      throw new BadRequestException('Le scout doit avoir un matricule avant de créer un compte')
    }
    if (scout.utilisateurId) throw new BadRequestException('Ce scout possède déjà un compte utilisateur')
    const corps = corpsObjet(brut)

    const password = corps.password
    const telephone = texte(corps, 'telephone')
    if (typeof password !== 'string' || !password || !motDePasseValide(password)) {
      throw new BadRequestException(REGLE_MOT_DE_PASSE)
    }

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
          paroisseId,
        },
        select: { id: true, nom: true, prenom: true, matricule: true, role: true, actif: true },
      })

      await tx.scout.update({ where: { id }, data: { utilisateurId: nouvelUtilisateur.id } })

      return nouvelUtilisateur
    })
  }

  async attribuerMatricule(utilisateur: UtilisateurSession, id: string, brut: unknown) {
    const paroisseId = paroisseIdRequise(utilisateur)

    const existant = await this.prisma.scout.findFirst({
      where: { id, paroisseId },
      select: { id: true, matricule: true },
    })
    if (!existant) throw new NotFoundException('Scout introuvable')
    const corps = corpsObjet(brut)

    const matricule = texte(corps, 'matricule')?.trim()
    if (!matricule) throw new BadRequestException('Le matricule est requis')

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
      paroisseId,
      acteurId: utilisateur.id,
      action: 'SCOUT_MATRICULE_ATTRIBUE',
      entite: 'Scout',
      entiteId: id,
      details: { ancienMatricule: existant.matricule, nouveauMatricule: matricule },
    })

    return scout
  }

  async importer(utilisateur: UtilisateurSession, brut: unknown) {
    const corps = corpsObjet(brut)
    const scouts = corps.scouts
    if (!Array.isArray(scouts) || scouts.length === 0) throw new BadRequestException('Aucune ligne à importer')
    if (scouts.length > MAX_LIGNES_IMPORT) {
      throw new BadRequestException(`Maximum ${MAX_LIGNES_IMPORT} lignes par import`)
    }

    const paroisseId = paroisseIdRequise(utilisateur)

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
              paroisseId,
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
        paroisseId,
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
