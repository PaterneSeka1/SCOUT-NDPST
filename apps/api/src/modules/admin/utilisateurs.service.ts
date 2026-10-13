import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { hash } from 'bcryptjs'
import {
  BrancheTypeSchema,
  libelleRoleAvecFonction,
  motDePasseValide,
  REGLE_MOT_DE_PASSE,
  ROLES_ASSIGNABLES_PAROISSE,
  ROLES_BRANCHE,
  ROLES_DISTRICT_ETENDU,
  ROLES_TOUT_STAFF,
} from '@scout/shared'
import { Prisma, type BrancheType, type RoleUtilisateur } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { AuthService } from '../../auth/auth.service'
import { logger } from '../../common/lib/logger'
import { envoyerEmailBienvenue } from '../../common/lib/notifications'
import {
  booleenOptionnel,
  type Corps,
  corpsObjet,
  entierBorneRequete,
  parametre,
  texteOptionnel,
  urlConnexion,
} from './admin.utils'

// Une cible ADMIN_PLATEFORME n'existe jamais pour cette surface : un admin
// plateforme ne gère pas d'autres admins plateforme via /api/admin/utilisateurs.
// On la traite comme "introuvable" (404) plutôt que de révéler son existence.
const CIBLE_GERABLE = { role: { not: 'ADMIN_PLATEFORME' } } as const

const SELECTION_NOMINATION = {
  id: true,
  nom: true,
  prenom: true,
  matricule: true,
  telephone: true,
  email: true,
  role: true,
  fonction: true,
  brancheType: true,
  roleDistrict: true,
  fonctionDistrict: true,
  brancheTypeDistrict: true,
  actif: true,
  createdAt: true,
  paroisse: { select: { id: true, nom: true, district: { select: { id: true, nom: true } } } },
} as const

const MESSAGE_CHEF_GROUPE_UNIQUE =
  "Cette paroisse a déjà un Chef de Groupe actif. Désactivez-le avant d'en désigner un nouveau."
const MESSAGE_RESPONSABLE_UNIQUE = 'Cette branche a déjà un Responsable de Branche actif dans la paroisse.'

// Champ de nomination facultatif : absent → undefined, null ou non-texte →
// null, sinon texte nettoyé (vide → null).
function nullableTexte(valeur: unknown): string | null | undefined {
  if (valeur === undefined) return undefined
  if (valeur === null) return null
  if (typeof valeur !== 'string') return null
  return valeur.trim() || null
}

const BRANCHE_INVALIDE = Symbol('brancheInvalide')

function nullableBranche(valeur: unknown): string | null | undefined | typeof BRANCHE_INVALIDE {
  const texte = nullableTexte(valeur)
  if (texte && !BrancheTypeSchema.safeParse(texte).success) return BRANCHE_INVALIDE
  return texte
}

function brancheValide(valeur: unknown): boolean {
  return valeur == null || BrancheTypeSchema.safeParse(valeur).success
}

function estConflitUnicite(erreur: unknown): boolean {
  return erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002'
}

@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // Unicité des postes « 1 Chef de Groupe actif par paroisse » et « 1 Responsable
  // de Branche actif par (paroisse, branche) » : garantie en base par des index
  // partiels (migration 20260713150000_fixes_pre_production), vérifiée ici en
  // amont pour renvoyer un message clair plutôt qu'une violation de contrainte.
  async conflitPosteUnique(
    paroisseId: string,
    role: string,
    brancheType: string | null,
    exclureId?: string,
  ): Promise<string | null> {
    const exclusion = exclureId ? { NOT: { id: exclureId } } : {}
    if (role === 'CHEF_GROUPE') {
      const autre = await this.prisma.utilisateur.findFirst({
        where: { paroisseId, role: 'CHEF_GROUPE', actif: true, ...exclusion },
        select: { id: true },
      })
      if (autre) return MESSAGE_CHEF_GROUPE_UNIQUE
    }
    if (role === 'RESPONSABLE_BRANCHE' && brancheType) {
      const autre = await this.prisma.utilisateur.findFirst({
        where: {
          paroisseId,
          role: 'RESPONSABLE_BRANCHE',
          brancheType: brancheType as BrancheType,
          actif: true,
          ...exclusion,
        },
        select: { id: true },
      })
      if (autre) return MESSAGE_RESPONSABLE_UNIQUE
    }
    return null
  }

  // Gestion transverse des comptes de toutes les paroisses par un admin
  // plateforme. Contrairement à /api/utilisateurs (scopé à la paroisse de
  // l'appelant), cette surface n'est jamais filtrée par une paroisseId
  // d'appelant — l'admin plateforme n'en a pas — mais elle exclut toujours les
  // comptes ADMIN_PLATEFORME.
  async lister(requete: Record<string, unknown>) {
    const page = entierBorneRequete(requete.page, 1)
    const limite = entierBorneRequete(requete.limite, 20, 100)
    const roleParam = parametre(requete.role)
    const role = roleParam && ROLES_ASSIGNABLES_PAROISSE.includes(roleParam) ? roleParam : undefined
    const roleDistrictParam = parametre(requete.roleDistrict) ?? ''
    const categorie = parametre(requete.categorie) ?? ''
    const statut = parametre(requete.statut) ?? ''
    const paroisseId = parametre(requete.paroisseId)?.trim() || undefined
    const districtId = parametre(requete.districtId)?.trim() || undefined
    const recherche = parametre(requete.recherche)?.trim() || undefined
    const brancheParam = parametre(requete.brancheType)
    const brancheType =
      brancheParam && BrancheTypeSchema.safeParse(brancheParam).success ? (brancheParam as BrancheType) : undefined

    let roleWhere: Prisma.EnumRoleUtilisateurFilter<'Utilisateur'> | RoleUtilisateur = { not: 'ADMIN_PLATEFORME' }
    if (categorie === 'staff' || categorie === 'nommables-district') {
      roleWhere = { in: ROLES_TOUT_STAFF as RoleUtilisateur[] }
    }
    if (role) roleWhere = role as RoleUtilisateur

    let roleDistrictWhere: Prisma.EnumRoleUtilisateurNullableFilter<'Utilisateur'> | RoleUtilisateur | null | undefined
    let brancheDistrictRequise = false
    if (categorie === 'equipe-district') {
      roleDistrictWhere = { in: ROLES_DISTRICT_ETENDU as RoleUtilisateur[] }
    }
    if (categorie === 'commissaires-branche') {
      roleDistrictWhere = 'ASSISTANT_DISTRICT'
      brancheDistrictRequise = true
    }
    if (categorie === 'nommables-district') {
      roleDistrictWhere = null
    }

    if (roleDistrictParam === 'AUCUNE') {
      roleDistrictWhere = null
      brancheDistrictRequise = false
    } else if (roleDistrictParam === 'EQUIPE_DISTRICT') {
      roleDistrictWhere = { in: ROLES_DISTRICT_ETENDU as RoleUtilisateur[] }
      brancheDistrictRequise = false
    } else if (roleDistrictParam === 'COMMISSAIRES_BRANCHE') {
      roleDistrictWhere = 'ASSISTANT_DISTRICT'
      brancheDistrictRequise = true
    } else if (ROLES_DISTRICT_ETENDU.includes(roleDistrictParam)) {
      roleDistrictWhere = roleDistrictParam as RoleUtilisateur
      brancheDistrictRequise = false
    }

    const et: Prisma.UtilisateurWhereInput[] = []
    if (recherche) {
      et.push({
        OR: [
          { nom: { contains: recherche, mode: 'insensitive' } },
          { prenom: { contains: recherche, mode: 'insensitive' } },
          { matricule: { contains: recherche, mode: 'insensitive' } },
          { telephone: { contains: recherche, mode: 'insensitive' } },
          { email: { contains: recherche, mode: 'insensitive' } },
        ],
      })
    }
    if (brancheType) {
      et.push({ OR: [{ brancheType }, { brancheTypeDistrict: brancheType }] })
    }

    const where: Prisma.UtilisateurWhereInput = {
      role: roleWhere,
      ...(paroisseId ? { paroisseId } : {}),
      ...(districtId ? { paroisse: { districtId } } : {}),
      ...(statut === 'actifs' ? { actif: true } : {}),
      ...(statut === 'inactifs' ? { actif: false } : {}),
      ...(categorie === 'nommables-district' && statut !== 'inactifs' ? { actif: true } : {}),
      ...(roleDistrictWhere !== undefined ? { roleDistrict: roleDistrictWhere } : {}),
      ...(brancheDistrictRequise ? { brancheTypeDistrict: { not: null } } : {}),
      ...(et.length > 0 ? { AND: et } : {}),
    }

    const [utilisateurs, total] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where,
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          telephone: true,
          email: true,
          role: true,
          fonction: true,
          brancheType: true,
          roleDistrict: true,
          fonctionDistrict: true,
          brancheTypeDistrict: true,
          actif: true,
          createdAt: true,
          paroisse: { select: { id: true, nom: true, district: { select: { id: true, nom: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limite,
        take: limite,
      }),
      this.prisma.utilisateur.count({ where }),
    ])

    return { utilisateurs, total, page, totalPages: Math.max(1, Math.ceil(total / limite)) }
  }

  async creer(corpsBrut: unknown, acteurId: string) {
    const corps = corpsObjet(corpsBrut)
    const paroisseId = texteOptionnel(corps, 'paroisseId')
    const nom = texteOptionnel(corps, 'nom')?.trim()
    const prenom = texteOptionnel(corps, 'prenom')?.trim()
    const email = texteOptionnel(corps, 'email')?.trim()
    const matricule = texteOptionnel(corps, 'matricule')?.trim()
    const telephone = texteOptionnel(corps, 'telephone')?.trim()
    const role = texteOptionnel(corps, 'role')
    const password = texteOptionnel(corps, 'password')
    const fonction = texteOptionnel(corps, 'fonction')
    const brancheType = corps.brancheType

    if (!paroisseId || !nom || !prenom || !role || !password) {
      throw new BadRequestException('Les champs paroisseId, nom, prenom, role et password sont requis')
    }
    if (!motDePasseValide(password)) throw new BadRequestException(REGLE_MOT_DE_PASSE)

    const paroisse = await this.prisma.paroisse.findUnique({ where: { id: paroisseId }, select: { id: true } })
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')

    // Un admin plateforme (transverse, sans paroisse) ne se crée jamais via
    // cette route — ROLES_ASSIGNABLES_PAROISSE exclut ADMIN_PLATEFORME. Les
    // rôles de district non plus : `role` est toujours un rôle PAROISSIAL ;
    // une affectation district (roleDistrict) se fait en promouvant un membre
    // du staff déjà actif, jamais en créant un compte avec ce rôle.
    if (!ROLES_ASSIGNABLES_PAROISSE.includes(role)) throw new BadRequestException('Rôle invalide')

    if (!brancheValide(brancheType)) throw new BadRequestException('Branche invalide')

    // brancheType n'a de sens que pour l'encadrement de branche paroissial :
    // requis pour ces rôles, forcé à null pour tout autre rôle même si fourni.
    const estBranche = ROLES_BRANCHE.includes(role)
    if (estBranche && !brancheType) throw new BadRequestException('La branche est requise pour ce rôle')
    const brancheTypeValeur = estBranche ? (brancheType as BrancheType) : null
    const fonctionValeur = fonction?.trim() || null

    // Un compte est créé actif : il ne doit pas doubler un poste unique.
    const conflitPoste = await this.conflitPosteUnique(paroisseId, role, brancheTypeValeur)
    if (conflitPoste) throw new ConflictException(conflitPoste)

    const estParent = role === 'PARENT'
    if (estParent && !telephone) throw new BadRequestException('Le numéro de téléphone est requis pour un parent')
    if (!estParent && !matricule) throw new BadRequestException('Le matricule est requis')

    if (matricule) {
      const doublon = await this.prisma.utilisateur.findUnique({ where: { matricule }, select: { id: true } })
      if (doublon) throw new BadRequestException('Ce matricule est déjà utilisé')
    }
    if (telephone) {
      const doublon = await this.prisma.utilisateur.findUnique({ where: { telephone }, select: { id: true } })
      if (doublon) throw new BadRequestException('Ce numéro de téléphone est déjà utilisé')
    }
    if (email) {
      // Insensible à la casse : évite qu'un doublon "Jean@x.com" / "jean@x.com"
      // passe inaperçu, ce qui rendrait ensuite la réinitialisation par email ambiguë.
      const doublon = await this.prisma.utilisateur.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      })
      if (doublon) throw new BadRequestException('Cette adresse e-mail est déjà utilisée')
    }

    const passwordHache = await hash(password, 12)

    let utilisateur
    try {
      utilisateur = await this.prisma.utilisateur.create({
        data: {
          nom,
          prenom,
          email: email || null,
          matricule: matricule || null,
          telephone: telephone || null,
          role: role as RoleUtilisateur,
          fonction: fonctionValeur,
          brancheType: brancheTypeValeur,
          password: passwordHache,
          paroisseId,
        },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          telephone: true,
          email: true,
          role: true,
          fonction: true,
          brancheType: true,
          actif: true,
          createdAt: true,
          paroisseId: true,
        },
      })
    } catch (erreur) {
      // Création concurrente : la contrainte d'unicité en base a tranché.
      if (estConflitUnicite(erreur)) {
        throw new ConflictException(
          'Conflit avec un compte existant : matricule, téléphone, adresse e-mail ou poste unique déjà attribué.',
        )
      }
      throw erreur
    }

    await this.audit.enregistrer({
      paroisseId,
      acteurId,
      action: 'UTILISATEUR_CREE',
      entite: 'Utilisateur',
      entiteId: utilisateur.id,
      details: { role: utilisateur.role },
    })

    if (utilisateur.email) {
      // Meilleur effort : un échec d'envoi ne doit jamais faire échouer la création du compte.
      envoyerEmailBienvenue({
        email: utilisateur.email,
        prenom: utilisateur.prenom,
        identifiant: utilisateur.matricule ?? utilisateur.telephone ?? utilisateur.email,
        roleLabel: libelleRoleAvecFonction(utilisateur.role, utilisateur.fonction, utilisateur.brancheType),
        nomSite: 'SCOUT ASCCI',
        urlConnexion: urlConnexion(),
      }).catch((error: unknown) => logger.error('admin.utilisateurs.email_bienvenue_echoue', error))
    }

    return utilisateur
  }

  async detail(id: string) {
    const utilisateur = await this.prisma.utilisateur.findFirst({
      where: { id, ...CIBLE_GERABLE },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        fonction: true,
        brancheType: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
        paroisse: { select: { id: true, nom: true } },
      },
    })
    if (!utilisateur) throw new NotFoundException('Utilisateur introuvable')
    return utilisateur
  }

  private async trouverCible(id: string) {
    const cible = await this.prisma.utilisateur.findFirst({
      where: { id, ...CIBLE_GERABLE },
      select: { id: true, role: true, actif: true, fonction: true, brancheType: true, paroisseId: true },
    })
    if (!cible) throw new NotFoundException('Utilisateur introuvable')
    return cible
  }

  async modifier(id: string, corpsBrut: unknown, acteurId: string) {
    const existant = await this.trouverCible(id)
    const corps: Corps = corpsObjet(corpsBrut)
    const { nom, prenom, email, role, fonction, brancheType } = corps
    const actif = booleenOptionnel(corps, 'actif')

    // Pas de réaffectation de paroisse : seuls nom, prenom, email, role, actif,
    // fonction et brancheType sont modifiables via cette route. `role` est
    // toujours un rôle PAROISSIAL, jamais une valeur de district — une
    // affectation district (roleDistrict) se gère via la désignation du
    // Commissaire ou les nominations. Un compte PARENT/SCOUT existant (hors
    // périmètre V1) garde son rôle tel quel.
    if (
      role !== undefined &&
      role !== existant.role &&
      (typeof role !== 'string' || !ROLES_ASSIGNABLES_PAROISSE.includes(role))
    ) {
      throw new BadRequestException('Rôle invalide')
    }
    if (nom !== undefined && (typeof nom !== 'string' || !nom.trim())) {
      throw new BadRequestException('Le nom est invalide')
    }
    if (prenom !== undefined && (typeof prenom !== 'string' || !prenom.trim())) {
      throw new BadRequestException('Le prénom est invalide')
    }
    if (email !== undefined && email !== null && typeof email !== 'string') {
      throw new BadRequestException('L’adresse e-mail est invalide')
    }
    if (fonction !== undefined && fonction !== null && typeof fonction !== 'string') {
      throw new BadRequestException('La fonction est invalide')
    }
    if (!brancheValide(brancheType)) throw new BadRequestException('Branche invalide')

    // brancheType/fonction recalculés sur le RÔLE FINAL (nouveau si fourni,
    // sinon existant) — un utilisateur qui change de rôle ne doit jamais
    // conserver une branche héritée d'un rôle précédent.
    const roleFinal = role !== undefined ? (role as string) : existant.role
    const estBrancheFinal = ROLES_BRANCHE.includes(roleFinal)
    if (estBrancheFinal && brancheType === undefined && !existant.brancheType) {
      throw new BadRequestException('La branche est requise pour ce rôle')
    }
    if (estBrancheFinal && brancheType === null) {
      throw new BadRequestException('La branche est requise pour ce rôle')
    }
    const brancheTypeFinal = estBrancheFinal
      ? ((brancheType !== undefined ? brancheType : existant.brancheType) as BrancheType)
      : null
    const fonctionFinal = fonction !== undefined ? (fonction as string | null)?.trim() || null : existant.fonction
    const emailNettoye = typeof email === 'string' ? email.trim() : ''

    if (email !== undefined && emailNettoye) {
      const doublon = await this.prisma.utilisateur.findFirst({
        where: { email: { equals: emailNettoye, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      })
      if (doublon) throw new BadRequestException('Cette adresse e-mail est déjà utilisée')
    }

    const actifFinal = actif !== undefined ? actif : existant.actif
    if (actifFinal && existant.paroisseId) {
      const conflitPoste = await this.conflitPosteUnique(existant.paroisseId, roleFinal, brancheTypeFinal, id)
      if (conflitPoste) throw new ConflictException(conflitPoste)
    }

    let misAJour
    try {
      misAJour = await this.prisma.utilisateur.update({
        where: { id },
        data: {
          ...(nom !== undefined ? { nom: (nom as string).trim() } : {}),
          ...(prenom !== undefined ? { prenom: (prenom as string).trim() } : {}),
          ...(email !== undefined ? { email: emailNettoye || null } : {}),
          ...(role !== undefined ? { role: role as RoleUtilisateur } : {}),
          ...(actif !== undefined ? { actif } : {}),
          fonction: fonctionFinal,
          brancheType: brancheTypeFinal,
        },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          telephone: true,
          email: true,
          role: true,
          fonction: true,
          brancheType: true,
          actif: true,
          createdAt: true,
          updatedAt: true,
          paroisseId: true,
          paroisse: { select: { id: true, nom: true } },
        },
      })
    } catch (erreur) {
      // Modification concurrente : la contrainte d'unicité en base a tranché.
      if (estConflitUnicite(erreur)) {
        throw new ConflictException('Conflit avec un compte existant : adresse e-mail ou poste unique déjà attribué.')
      }
      throw erreur
    }
    const { paroisseId: paroisseIdCible, ...utilisateur } = misAJour

    // Compte désactivé : ses sessions ouvertes sont fermées immédiatement.
    if (actif === false) await this.auth.revoquerToutes(id)

    if (role !== undefined && role !== existant.role) {
      await this.audit.enregistrer({
        paroisseId: paroisseIdCible,
        acteurId,
        action: 'UTILISATEUR_ROLE_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { ancienRole: existant.role, nouveauRole: role },
      })
    }
    if (actif !== undefined && actif !== existant.actif) {
      await this.audit.enregistrer({
        paroisseId: paroisseIdCible,
        acteurId,
        action: actif ? 'UTILISATEUR_REACTIVE' : 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }

    return utilisateur
  }

  async desactiver(id: string, acteurId: string) {
    await this.trouverCible(id)

    const { paroisseId: paroisseIdCible, ...utilisateur } = await this.prisma.utilisateur.update({
      where: { id },
      data: { actif: false },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
        paroisseId: true,
        paroisse: { select: { id: true, nom: true } },
      },
    })

    await this.auth.revoquerToutes(id)

    await this.audit.enregistrer({
      paroisseId: paroisseIdCible,
      acteurId,
      action: 'UTILISATEUR_DESACTIVE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return utilisateur
  }

  async nommer(id: string, corpsBrut: unknown, acteurId: string) {
    const existant = await this.prisma.utilisateur.findFirst({
      where: { id, ...CIBLE_GERABLE },
      select: {
        id: true,
        role: true,
        fonction: true,
        brancheType: true,
        roleDistrict: true,
        fonctionDistrict: true,
        brancheTypeDistrict: true,
        actif: true,
        matricule: true,
        telephone: true,
        paroisseId: true,
        paroisse: { select: { districtId: true } },
      },
    })
    if (!existant) throw new NotFoundException('Utilisateur introuvable')

    const corps = corpsObjet(corpsBrut)
    const { role, roleDistrict } = corps
    const brancheTypeParoisseCorps = corps.brancheType
    const brancheTypeDistrictCorps = corps.brancheTypeDistrict
    const fonctionDistrictCorps = corps.fonctionDistrict

    const estTexteOuNul = (v: unknown) => v === undefined || v === null || typeof v === 'string'
    if (role !== undefined && typeof role !== 'string') throw new BadRequestException('Rôle invalide')
    if (!estTexteOuNul(roleDistrict)) throw new BadRequestException('Rôle de district invalide')
    if (!estTexteOuNul(brancheTypeParoisseCorps)) throw new BadRequestException('Branche invalide')
    if (!estTexteOuNul(brancheTypeDistrictCorps)) throw new BadRequestException('Branche de district invalide')
    if (!estTexteOuNul(fonctionDistrictCorps)) throw new BadRequestException('Fonction de district invalide')

    // Un compte PARENT/SCOUT existant (hors périmètre V1) garde son rôle tel quel.
    if (role !== undefined && role !== existant.role && !ROLES_ASSIGNABLES_PAROISSE.includes(role)) {
      throw new BadRequestException('Rôle invalide')
    }

    const roleFinal: string = role !== undefined ? role : existant.role
    const estRoleBranche = ROLES_BRANCHE.includes(roleFinal)
    const brancheParoisseDemandee = nullableBranche(brancheTypeParoisseCorps)
    if (brancheParoisseDemandee === BRANCHE_INVALIDE) throw new BadRequestException('Branche invalide')

    const brancheParoisseFinale = estRoleBranche
      ? brancheParoisseDemandee !== undefined
        ? brancheParoisseDemandee
        : existant.brancheType
      : null
    if (estRoleBranche && !brancheParoisseFinale) {
      throw new BadRequestException('La branche est requise pour ce rôle')
    }

    if (roleFinal === 'PARENT' && !existant.telephone?.trim()) {
      throw new BadRequestException('Un parent doit avoir un numéro de téléphone avant cette nomination')
    }
    if (roleFinal !== 'PARENT' && !existant.matricule?.trim()) {
      throw new BadRequestException('Un matricule est requis avant de nommer cette personne à ce rôle')
    }

    const roleDistrictNormalise = nullableTexte(roleDistrict)
    if (roleDistrictNormalise && !ROLES_DISTRICT_ETENDU.includes(roleDistrictNormalise)) {
      throw new BadRequestException('Rôle de district invalide')
    }
    const roleDistrictFinal = roleDistrict !== undefined ? (roleDistrictNormalise ?? null) : existant.roleDistrict

    const brancheDistrictDemandee = nullableBranche(brancheTypeDistrictCorps)
    if (brancheDistrictDemandee === BRANCHE_INVALIDE) throw new BadRequestException('Branche de district invalide')
    const fonctionDistrictDemandee = nullableTexte(fonctionDistrictCorps)

    if (roleDistrictFinal) {
      if (!existant.actif) {
        throw new BadRequestException('Le compte doit être actif pour recevoir une affectation district')
      }
      if (!ROLES_TOUT_STAFF.includes(roleFinal)) {
        throw new BadRequestException('Seul un membre du staff peut recevoir une affectation district')
      }
      if (!existant.paroisseId || !existant.paroisse?.districtId) {
        throw new BadRequestException('La personne doit être rattachée à une paroisse avec district')
      }
    }

    const brancheDistrictFinale =
      roleDistrictFinal === 'ASSISTANT_DISTRICT'
        ? brancheDistrictDemandee !== undefined
          ? brancheDistrictDemandee
          : existant.brancheTypeDistrict
        : null
    const fonctionDistrictFinale =
      roleDistrictFinal === 'ASSISTANT_DISTRICT' && !brancheDistrictFinale
        ? fonctionDistrictDemandee !== undefined
          ? fonctionDistrictDemandee
          : existant.fonctionDistrict
        : null

    // Unicité des postes uniques, vérifiée en amont pour un message clair.
    if (existant.actif && existant.paroisseId) {
      const conflitPoste = await this.conflitPosteUnique(existant.paroisseId, roleFinal, brancheParoisseFinale, id)
      if (conflitPoste) throw new ConflictException(conflitPoste)
    }

    let commissairesRemplaces: string[] = []
    let utilisateur
    try {
      utilisateur = await this.prisma.$transaction(async (tx) => {
        if (roleDistrictFinal === 'COMMISSAIRE_DISTRICT' && existant.paroisse?.districtId) {
          const commissairesExistants = await tx.utilisateur.findMany({
            where: {
              roleDistrict: 'COMMISSAIRE_DISTRICT',
              paroisse: { districtId: existant.paroisse.districtId },
              NOT: { id },
            },
            select: { id: true },
          })
          commissairesRemplaces = commissairesExistants.map((u) => u.id)
          if (commissairesRemplaces.length > 0) {
            await tx.utilisateur.updateMany({
              where: { id: { in: commissairesRemplaces } },
              data: { roleDistrict: null, fonctionDistrict: null, brancheTypeDistrict: null },
            })
          }
        }

        return tx.utilisateur.update({
          where: { id },
          data: {
            role: roleFinal as RoleUtilisateur,
            brancheType: brancheParoisseFinale as BrancheType | null,
            roleDistrict: roleDistrictFinal as RoleUtilisateur | null,
            fonctionDistrict: fonctionDistrictFinale,
            brancheTypeDistrict: brancheDistrictFinale as BrancheType | null,
          },
          select: SELECTION_NOMINATION,
        })
      })
    } catch (erreur) {
      // Nomination concurrente : la contrainte d'unicité en base a tranché.
      if (estConflitUnicite(erreur)) {
        throw new ConflictException("Ce poste unique vient d'être attribué à un autre compte.")
      }
      throw erreur
    }

    if (roleFinal !== existant.role) {
      await this.audit.enregistrer({
        paroisseId: existant.paroisseId,
        acteurId,
        action: 'UTILISATEUR_ROLE_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { ancienRole: existant.role, nouveauRole: roleFinal },
      })
    }

    const affectationDistrictChangee =
      roleDistrictFinal !== existant.roleDistrict ||
      fonctionDistrictFinale !== existant.fonctionDistrict ||
      brancheDistrictFinale !== existant.brancheTypeDistrict

    if (affectationDistrictChangee) {
      await this.audit.enregistrer({
        paroisseId: existant.paroisseId,
        acteurId,
        action: roleDistrictFinal
          ? existant.roleDistrict
            ? 'UTILISATEUR_ROLE_DISTRICT_MODIFIE'
            : 'UTILISATEUR_ROLE_DISTRICT_AFFECTE'
          : 'UTILISATEUR_ROLE_DISTRICT_RETIRE',
        entite: 'Utilisateur',
        entiteId: id,
        details: {
          ancienRoleDistrict: existant.roleDistrict,
          nouveauRoleDistrict: roleDistrictFinal,
          fonctionDistrict: fonctionDistrictFinale,
          brancheTypeDistrict: brancheDistrictFinale,
          commissairesRemplaces,
        },
      })
    }

    return utilisateur
  }

  async changerMotDePasse(id: string, corpsBrut: unknown, acteurId: string) {
    // Un admin plateforme ne réinitialise pas le mot de passe d'un autre
    // admin plateforme via cette surface.
    const existant = await this.prisma.utilisateur.findFirst({
      where: { id, ...CIBLE_GERABLE },
      select: { id: true, paroisseId: true },
    })
    if (!existant) throw new NotFoundException('Utilisateur introuvable')

    const nouveauMotDePasse = corpsObjet(corpsBrut).nouveauMotDePasse
    if (typeof nouveauMotDePasse !== 'string' || !motDePasseValide(nouveauMotDePasse)) {
      throw new BadRequestException(REGLE_MOT_DE_PASSE)
    }

    const passwordHache = await hash(nouveauMotDePasse, 12)
    await this.prisma.utilisateur.update({ where: { id }, data: { password: passwordHache } })

    // L'ancien mot de passe a pu être compromis : toutes les sessions ouvertes
    // avec lui sont fermées.
    await this.auth.revoquerToutes(id)

    await this.audit.enregistrer({
      paroisseId: existant.paroisseId,
      acteurId,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return { message: 'Mot de passe mis à jour' }
  }
}
