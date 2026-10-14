import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { MONO_PAROISSE, ROLES_TOUT_STAFF } from '@scout/shared'
import type { RoleUtilisateur } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import type { DonneesDesignationCommissaire, DonneesDistrict } from './districts.schemas'

const AFFECTATION_DISTRICT_VIDE = { roleDistrict: null, fonctionDistrict: null, brancheTypeDistrict: null }

@Injectable()
export class DistrictsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async lister() {
    const districts = await this.prisma.district.findMany({
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, _count: { select: { paroisses: true } } },
    })

    const districtsAvecCommissaire = await Promise.all(
      districts.map(async (d) => {
        const commissaire = await this.prisma.utilisateur.findFirst({
          where: { roleDistrict: 'COMMISSAIRE_DISTRICT', actif: true, paroisse: { districtId: d.id } },
          select: { id: true, nom: true, prenom: true, actif: true },
        })
        return { id: d.id, nom: d.nom, nbParoisses: d._count.paroisses, commissaire }
      }),
    )

    return { districts: districtsAvecCommissaire }
  }

  async creer({ nom }: DonneesDistrict, acteurId: string) {
    if (MONO_PAROISSE) {
      const nbDistricts = await this.prisma.district.count()
      if (nbDistricts >= 1) {
        throw new BadRequestException(
          'Cette version ne prend en charge qu’une seule paroisse. La création d’un district supplémentaire est désactivée.',
        )
      }
    }

    const existant = await this.prisma.district.findFirst({
      where: { nom: { equals: nom, mode: 'insensitive' } },
      select: { id: true },
    })
    if (existant) throw new BadRequestException('Un district portant ce nom existe déjà')

    const district = await this.prisma.district.create({ data: { nom } })

    await this.audit.enregistrer({
      paroisseId: null,
      acteurId,
      action: 'DISTRICT_CREE',
      entite: 'District',
      entiteId: district.id,
      details: { nom: district.nom },
    })

    return district
  }

  async detail(id: string) {
    const district = await this.prisma.district.findUnique({ where: { id }, select: { id: true, nom: true } })
    if (!district) throw new NotFoundException('District introuvable')

    const paroisses = await this.prisma.paroisse.findMany({
      where: { districtId: id },
      select: {
        id: true,
        nom: true,
        ville: true,
        actif: true,
        _count: { select: { scouts: true, utilisateurs: true } },
        utilisateurs: {
          where: { role: 'CHEF_GROUPE' },
          select: { id: true, nom: true, prenom: true },
          take: 1,
        },
      },
      orderBy: { nom: 'asc' },
    })

    const equipe = await this.prisma.utilisateur.findMany({
      where: {
        roleDistrict: { in: ['COMMISSAIRE_DISTRICT', 'ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT'] },
        paroisse: { districtId: id },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        actif: true,
        role: true,
        roleDistrict: true,
        fonctionDistrict: true,
        brancheTypeDistrict: true,
        createdAt: true,
        paroisse: { select: { id: true, nom: true } },
      },
      orderBy: [{ roleDistrict: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
    })

    const membres = await this.prisma.utilisateur.findMany({
      where: {
        role: { not: 'ADMIN_PLATEFORME' },
        paroisse: { districtId: id },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        actif: true,
        role: true,
        fonction: true,
        brancheType: true,
        roleDistrict: true,
        fonctionDistrict: true,
        brancheTypeDistrict: true,
        createdAt: true,
        paroisse: { select: { id: true, nom: true, ville: true } },
      },
      orderBy: [{ paroisse: { nom: 'asc' } }, { role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
    })

    // Tout membre de l'équipe du district (y compris le Commissaire) est
    // désigné en affectant roleDistrict à un membre du staff (ROLES_TOUT_STAFF)
    // déjà en poste et actif dans l'une des paroisses du district — jamais en
    // créant un nouveau compte, et sans jamais toucher à son rôle paroissial.
    const personnelEligible = await this.prisma.utilisateur.findMany({
      where: {
        role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] },
        actif: true,
        roleDistrict: null,
        paroisse: { districtId: id },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        role: true,
        paroisse: { select: { id: true, nom: true } },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    return {
      id: district.id,
      nom: district.nom,
      personnelEligible,
      paroisses: paroisses.map((p) => ({
        id: p.id,
        nom: p.nom,
        ville: p.ville,
        actif: p.actif,
        scouts: p._count.scouts,
        utilisateurs: p._count.utilisateurs,
        chefGroupe: p.utilisateurs[0] ?? null,
      })),
      equipe: equipe.map((m) => ({
        id: m.id,
        nom: m.nom,
        prenom: m.prenom,
        matricule: m.matricule,
        telephone: m.telephone,
        email: m.email,
        actif: m.actif,
        role: m.roleDistrict,
        fonction: m.fonctionDistrict,
        brancheType: m.brancheTypeDistrict,
        roleParoisse: m.role,
        createdAt: m.createdAt,
        paroisse: m.paroisse,
      })),
      membres,
    }
  }

  async modifier(id: string, { nom }: DonneesDistrict, acteurId: string) {
    const existant = await this.prisma.district.findUnique({ where: { id }, select: { id: true, nom: true } })
    if (!existant) throw new NotFoundException('District introuvable')

    const doublon = await this.prisma.district.findFirst({
      where: { nom: { equals: nom, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    })
    if (doublon) throw new BadRequestException('Un district portant ce nom existe déjà')

    const district = await this.prisma.district.update({ where: { id }, data: { nom } })

    if (district.nom !== existant.nom) {
      await this.audit.enregistrer({
        paroisseId: null,
        acteurId,
        action: 'DISTRICT_MODIFIE',
        entite: 'District',
        entiteId: id,
        details: { ancienNom: existant.nom, nouveauNom: district.nom },
      })
    }

    return district
  }

  async supprimer(id: string, acteurId: string) {
    const district = await this.prisma.district.findUnique({
      where: { id },
      select: { id: true, nom: true, _count: { select: { paroisses: true } } },
    })
    if (!district) throw new NotFoundException('District introuvable')

    const nb = district._count.paroisses
    if (nb > 0) {
      throw new ConflictException(
        `Ce district contient encore ${nb} paroisse${nb > 1 ? 's' : ''}. Déplacez-les vers un autre district avant de le supprimer.`,
      )
    }

    await this.prisma.district.delete({ where: { id } })

    await this.audit.enregistrer({
      paroisseId: null,
      acteurId,
      action: 'DISTRICT_SUPPRIME',
      entite: 'District',
      entiteId: id,
      details: { nom: district.nom },
    })

    return { ok: true }
  }

  // Désigne un Commissaire de District en affectant roleDistrict à un membre du
  // staff (ROLES_TOUT_STAFF) déjà en poste et actif dans l'une des paroisses du
  // district — jamais en créant un nouveau compte, et sans jamais toucher à son
  // rôle paroissial (role) : il continue de l'exercer normalement.
  async designerCommissaire(districtId: string, { utilisateurId }: DonneesDesignationCommissaire, acteurId: string) {
    const district = await this.prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
    if (!district) throw new NotFoundException('District introuvable')

    const membre = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: {
        id: true,
        role: true,
        roleDistrict: true,
        actif: true,
        paroisseId: true,
        paroisse: { select: { districtId: true } },
      },
    })
    if (!membre) throw new NotFoundException('Utilisateur introuvable')

    if (!ROLES_TOUT_STAFF.includes(membre.role) || !membre.actif) {
      throw new BadRequestException(
        "Seul un membre actif du staff d'une paroisse peut être désigné Commissaire de District",
      )
    }
    if (membre.roleDistrict) {
      throw new BadRequestException("Cette personne fait déjà partie de l'équipe du district")
    }
    if (membre.paroisse?.districtId !== districtId) {
      throw new BadRequestException("Cette personne n'appartient pas à une paroisse de ce district")
    }

    const commissairesExistants = await this.prisma.utilisateur.findMany({
      where: { roleDistrict: 'COMMISSAIRE_DISTRICT', paroisse: { districtId } },
      select: { id: true },
    })
    const idsCommissairesExistants = commissairesExistants.map((u) => u.id).filter((id) => id !== membre.id)

    // Ne touche jamais à `role` (rôle paroissial) : la personne continue de
    // l'exercer normalement dans sa paroisse, l'affectation district s'ajoute
    // simplement à son compte existant.
    const commissaire = await this.prisma.$transaction(async (tx) => {
      if (idsCommissairesExistants.length > 0) {
        await tx.utilisateur.updateMany({
          where: { id: { in: idsCommissairesExistants } },
          data: AFFECTATION_DISTRICT_VIDE,
        })
      }

      return tx.utilisateur.update({
        where: { id: membre.id },
        data: { roleDistrict: 'COMMISSAIRE_DISTRICT', fonctionDistrict: null, brancheTypeDistrict: null },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          telephone: true,
          email: true,
          actif: true,
          createdAt: true,
          role: true,
          roleDistrict: true,
          paroisseId: true,
        },
      })
    })

    await this.audit.enregistrer({
      paroisseId: membre.paroisseId,
      acteurId,
      action: 'UTILISATEUR_ROLE_DISTRICT_AFFECTE',
      entite: 'Utilisateur',
      entiteId: commissaire.id,
      details: {
        roleParoisse: commissaire.role,
        roleDistrict: commissaire.roleDistrict,
        remplace: idsCommissairesExistants,
      },
    })

    return {
      id: commissaire.id,
      nom: commissaire.nom,
      prenom: commissaire.prenom,
      matricule: commissaire.matricule,
      telephone: commissaire.telephone,
      email: commissaire.email,
      actif: commissaire.actif,
      createdAt: commissaire.createdAt,
      paroisseId: commissaire.paroisseId,
      roleParoisse: commissaire.role,
    }
  }

  async retirerCommissaire(districtId: string, acteurId: string) {
    const district = await this.prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
    if (!district) throw new NotFoundException('District introuvable')

    const commissaires = await this.prisma.utilisateur.findMany({
      where: { roleDistrict: 'COMMISSAIRE_DISTRICT', paroisse: { districtId } },
      select: { id: true, paroisseId: true },
    })
    if (commissaires.length === 0) throw new NotFoundException('Aucun Commissaire de District à retirer')

    await this.prisma.utilisateur.updateMany({
      where: { id: { in: commissaires.map((u) => u.id) } },
      data: AFFECTATION_DISTRICT_VIDE,
    })

    await this.audit.enregistrer({
      paroisseId: commissaires[0]?.paroisseId ?? null,
      acteurId,
      action: 'UTILISATEUR_ROLE_DISTRICT_RETIRE',
      entite: 'District',
      entiteId: districtId,
      details: { commissairesRetires: commissaires.map((u) => u.id) },
    })

    return { ok: true }
  }
}
