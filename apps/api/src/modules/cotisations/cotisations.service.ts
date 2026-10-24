import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  ROLES_BRANCHE,
  STATUTS_COTISANT,
  anneeScolaireCourante,
  anneeScolaireValide,
  entierBorne,
  estValeurEnum,
} from '@scout/shared'
import { BrancheType, Prisma, StatutCotisation } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import type {
  CorpsCreationBareme,
  CorpsCreationCotisation,
  CorpsModificationBareme,
  CorpsModificationCotisation,
  CorpsStatutCotisant,
} from './cotisations.schemas'

export interface FiltresCotisations {
  anneeScolaire?: string
  statut?: string
  branche?: string
  recherche?: string
  page?: string
  limite?: string
}

@Injectable()
export class CotisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
    private readonly audit: AuditService,
  ) {}

  // Liste paginée des cotisations (staff uniquement). Les responsables de
  // branche ne voient que les scouts de leur branche.
  async lister(utilisateur: UtilisateurSession, filtres: FiltresCotisations) {
    const anneeScolaire = filtres.anneeScolaire ?? anneeScolaireCourante()
    const statut = filtres.statut
    const recherche = filtres.recherche?.trim() ?? ''
    const page = entierBorne(filtres.page ?? null, 1, 1, Number.MAX_SAFE_INTEGER)
    const limite = entierBorne(filtres.limite ?? null, 50, 1, 100)

    // Les responsables de branche ne voient QUE leur branche — toute valeur
    // "branche" fournie par le client est ignorée pour ce groupe de rôles.
    let filtreBranche = filtres.branche
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que toutes les branches par défaut.
      if (!bt) return { cotisations: [], pagination: { page, limite, total: 0, totalPages: 0 } }
      filtreBranche = bt
    }

    if (statut !== undefined && !estValeurEnum(StatutCotisation, statut)) {
      throw new BadRequestException('Statut invalide')
    }
    if (filtreBranche && !estValeurEnum(BrancheType, filtreBranche)) {
      throw new BadRequestException('Branche invalide')
    }

    const filtreScout: Prisma.ScoutWhereInput = {
      ...(filtreBranche ? { brancheType: filtreBranche as BrancheType } : {}),
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
    const where: Prisma.CotisationWhereInput = {
      anneeScolaire,
      ...(statut ? { statut: statut as StatutCotisation } : {}),
      ...(Object.keys(filtreScout).length > 0 ? { scout: filtreScout } : {}),
    }

    const [cotisations, total] = await Promise.all([
      this.prisma.cotisation.findMany({
        where,
        include: {
          scout: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              brancheType: true,
              matricule: true,
              actif: true,
            },
          },
          activite: { select: { id: true, titre: true, dateDebut: true } },
          enregistrePar: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: [{ statut: 'asc' }, { scout: { nom: 'asc' } }],
        skip: (page - 1) * limite,
        take: limite,
      }),
      this.prisma.cotisation.count({ where }),
    ])

    return { cotisations, pagination: { page, limite, total, totalPages: Math.ceil(total / limite) } }
  }

  // Crée une cotisation (à titre individuel) ou, si `scoutIds` est fourni,
  // génère la même cotisation pour plusieurs scouts d'un coup (ex : toute une
  // branche en début d'année). Réservé à la direction du groupe (contrôlé par
  // le contrôleur) : c'est elle qui définit ce qui est dû, même si les
  // responsables de branche pourront ensuite enregistrer les paiements.
  async creer(utilisateur: UtilisateurSession, corps: CorpsCreationCotisation) {
    // Corps déjà validé par SchemaCreationCotisation (cibles, type, montant).
    const { cibles, type, montant, libelle, activiteId } = corps
    const annee = corps.anneeScolaire?.trim() || anneeScolaireCourante()
    if (!anneeScolaireValide(annee)) throw new BadRequestException('Année scolaire invalide')

    const scouts = await this.prisma.scout.findMany({
      where: { id: { in: cibles } },
      select: { id: true },
    })
    if (scouts.length !== new Set(cibles).size) {
      throw new NotFoundException('Un ou plusieurs scouts sont introuvables')
    }

    if (activiteId) {
      const activite = await this.prisma.activite.findUnique({ where: { id: activiteId }, select: { id: true } })
      if (!activite) throw new NotFoundException('Activité introuvable')
    }

    const cotisations = await this.prisma.$transaction(
      scouts.map((s) =>
        this.prisma.cotisation.create({
          data: {
            scoutId: s.id,
            type,
            libelle: libelle?.trim() || null,
            montant,
            anneeScolaire: annee,
            activiteId: activiteId ?? null,
          },
        }),
      ),
    )

    await Promise.all(
      cotisations.map((c) =>
        this.audit.enregistrer({
          acteurId: utilisateur.id,
          action: 'COTISATION_CREEE',
          entite: 'Cotisation',
          entiteId: c.id,
          details: {
            scoutId: c.scoutId,
            type: c.type,
            montant: c.montant,
            anneeScolaire: c.anneeScolaire,
            activiteId: c.activiteId,
          },
        }),
      ),
    )

    return { cotisations }
  }

  // Enregistrer un paiement (ou changer le statut). Ouvert à toute la
  // direction (groupe + branches) : dans la pratique, ce sont souvent les
  // responsables de branche qui collectent les cotisations sur le terrain.
  async modifier(utilisateur: UtilisateurSession, id: string, corps: CorpsModificationCotisation) {
    // Un responsable de branche ne peut enregistrer un paiement que pour un
    // scout de sa propre branche.
    let brancheRequise: string | undefined
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      if (!bt) throw new NotFoundException('Cotisation introuvable')
      brancheRequise = bt
    }

    const existante = await this.prisma.cotisation.findFirst({
      where: {
        id,
        ...(brancheRequise ? { scout: { brancheType: brancheRequise as BrancheType } } : {}),
      },
    })
    if (!existante) throw new NotFoundException('Cotisation introuvable')

    // Forme déjà validée par SchemaModificationCotisation ; reste ici la
    // cohérence du montant payé avec le montant dû.
    const { statut, montantPaye, modePaiement, notes } = corps

    if (statut === 'PARTIELLEMENT_PAYEE') {
      if (
        montantPaye === undefined ||
        !Number.isInteger(montantPaye) ||
        montantPaye <= 0 ||
        montantPaye >= existante.montant
      ) {
        throw new BadRequestException(
          'Le montant payé doit être un entier positif, inférieur au montant dû (sinon utilisez le statut "Payée")',
        )
      }
    }

    // montantPaye reste toujours cohérent avec statut : 0 pour EN_ATTENTE/EXONEREE,
    // le montant dû en entier pour PAYEE, la valeur fournie pour PARTIELLEMENT_PAYEE.
    const montantPayeSelonStatut: Record<StatutCotisation, number> = {
      EN_ATTENTE: 0,
      EXONEREE: 0,
      PAYEE: existante.montant,
      PARTIELLEMENT_PAYEE: montantPaye ?? 0,
    }
    const paiement = statut === 'PAYEE' || statut === 'PARTIELLEMENT_PAYEE'

    const cotisation = await this.prisma.cotisation.update({
      where: { id },
      data: {
        ...(statut !== undefined
          ? {
              statut,
              montantPaye: montantPayeSelonStatut[statut],
              datePaiement: paiement ? new Date() : null,
              enregistreParId: paiement ? utilisateur.id : null,
            }
          : {}),
        ...(modePaiement !== undefined ? { modePaiement: modePaiement?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
      include: {
        scout: {
          select: { id: true, nom: true, prenom: true, brancheType: true },
        },
        enregistrePar: { select: { id: true, nom: true, prenom: true } },
      },
    })

    // Auditer tout changement de statut, mais aussi un complément de paiement
    // partiel qui laisse le statut à PARTIELLEMENT_PAYEE (ex: 5000 puis 3000
    // FCFA de plus) — sans quoi ce second mouvement d'argent ne laisserait
    // aucune trace, alors que c'est justement ce que ce statut vise à tracer.
    if (statut !== undefined) {
      const statutInchange = statut === existante.statut
      const montantInchange = statutInchange && montantPayeSelonStatut[statut] === existante.montantPaye
      if (!montantInchange) {
        await this.audit.enregistrer({
          acteurId: utilisateur.id,
          action: 'COTISATION_STATUT_MODIFIE',
          entite: 'Cotisation',
          entiteId: id,
          details: {
            ancienStatut: existante.statut,
            nouveauStatut: statut,
            scoutId: existante.scoutId,
            ancienMontantPaye: existante.montantPaye,
            montantPaye: montantPayeSelonStatut[statut],
          },
        })
      }
    }

    return cotisation
  }

  // Supprime une cotisation créée par erreur. Réservé à la direction du
  // groupe (même logique que la création : eux seuls définissent ce qui est dû).
  async supprimer(utilisateur: UtilisateurSession, id: string) {
    const existante = await this.prisma.cotisation.findFirst({
      where: { id },
    })
    if (!existante) throw new NotFoundException('Cotisation introuvable')

    await this.prisma.cotisation.delete({ where: { id } })

    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'COTISATION_SUPPRIMEE',
      entite: 'Cotisation',
      entiteId: id,
      details: {
        scoutId: existante.scoutId,
        montant: existante.montant,
        anneeScolaire: existante.anneeScolaire,
      },
    })

    return { ok: true }
  }

  // Cotisations V1 : on ne suit plus les montants ni les paiements partiels,
  // seulement « cotisant / non cotisant » par scout et par année scolaire. Un
  // scout est cotisant s'il a, pour l'année, une cotisation ADHESION_ANNUELLE
  // au statut PAYEE (ou EXONEREE, héritée de l'ancien suivi détaillé). Le
  // modèle Cotisation n'est pas modifié.

  // Liste des scouts actifs avec leur statut de cotisation. Lecture ouverte à
  // tout le staff ; l'encadrement de branche ne voit que sa branche.
  async listerStatuts(utilisateur: UtilisateurSession, filtres: Omit<FiltresCotisations, 'statut'>) {
    const anneeScolaire = filtres.anneeScolaire ?? anneeScolaireCourante()
    if (!anneeScolaireValide(anneeScolaire)) {
      throw new BadRequestException('Année scolaire invalide')
    }

    let filtreBranche = filtres.branche || undefined
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      if (!bt) return { anneeScolaire, scouts: [] }
      filtreBranche = bt
    }
    if (filtreBranche && !estValeurEnum(BrancheType, filtreBranche)) {
      throw new BadRequestException('Branche invalide')
    }

    const scouts = await this.prisma.scout.findMany({
      where: {
        actif: true,
        ...(filtreBranche ? { brancheType: filtreBranche as BrancheType } : {}),
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        brancheType: true,
        cotisations: {
          where: {
            anneeScolaire,
            type: 'ADHESION_ANNUELLE',
            statut: { in: STATUTS_COTISANT },
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    return {
      anneeScolaire,
      scouts: scouts.map(({ cotisations, ...s }) => ({
        ...s,
        cotisant: cotisations.length > 0,
      })),
    }
  }

  // Marque un scout cotisant ou non cotisant pour une année. Réservé au Chef
  // de Groupe (direction du groupe), contrôlé par le contrôleur.
  async definirStatut(utilisateur: UtilisateurSession, corps: CorpsStatutCotisant) {
    const { scoutId, cotisant } = corps
    const anneeScolaire = corps.anneeScolaire ?? anneeScolaireCourante()

    const scout = await this.prisma.scout.findFirst({
      where: { id: scoutId },
      select: { id: true },
    })
    if (!scout) throw new NotFoundException('Scout introuvable')

    // L'ancien suivi détaillé a pu laisser plusieurs lignes ADHESION_ANNUELLE
    // pour la même année : on raisonne sur l'ensemble, comme le GET (cotisant
    // dès qu'une ligne est PAYEE/EXONEREE).
    const lignes = await this.prisma.cotisation.findMany({
      where: { scoutId, anneeScolaire, type: 'ADHESION_ANNUELLE' },
      orderBy: { createdAt: 'desc' },
    })
    const lignesCotisant = lignes.filter((l) => STATUTS_COTISANT.includes(l.statut))

    if (lignesCotisant.length > 0 === cotisant) {
      return { scoutId, anneeScolaire, cotisant }
    }

    // On ne supprime jamais une ligne : le passage à « non cotisant » repasse
    // les cotisations EN_ATTENTE, pour garder l'historique (et l'audit) cohérents.
    let modifiees: { id: string; ancienStatut: string }[]
    if (cotisant) {
      const derniere = lignes[0]
      const donnees = {
        statut: 'PAYEE' as const,
        datePaiement: new Date(),
        enregistreParId: utilisateur.id,
      }
      const cotisation = derniere
        ? await this.prisma.cotisation.update({
            where: { id: derniere.id },
            data: { ...donnees, montantPaye: derniere.montant },
          })
        : await this.prisma.cotisation.create({
            data: {
              scoutId,
              anneeScolaire,
              type: 'ADHESION_ANNUELLE',
              montant: 0,
              ...donnees,
            },
          })
      modifiees = [{ id: cotisation.id, ancienStatut: derniere?.statut ?? 'AUCUNE' }]
    } else {
      await this.prisma.cotisation.updateMany({
        where: { id: { in: lignesCotisant.map((l) => l.id) } },
        data: {
          statut: 'EN_ATTENTE',
          montantPaye: 0,
          datePaiement: null,
          enregistreParId: null,
        },
      })
      modifiees = lignesCotisant.map((l) => ({
        id: l.id,
        ancienStatut: l.statut,
      }))
    }

    await Promise.all(
      modifiees.map((m) =>
        this.audit.enregistrer({
          acteurId: utilisateur.id,
          action: 'COTISATION_STATUT_MODIFIE',
          entite: 'Cotisation',
          entiteId: m.id,
          details: {
            scoutId,
            anneeScolaire,
            ancienStatut: m.ancienStatut,
            nouveauStatut: cotisant ? 'PAYEE' : 'EN_ATTENTE',
          },
        }),
      ),
    )

    return { scoutId, anneeScolaire, cotisant }
  }

  // ---------------------------------------------------------------------------
  // Barème des cotisations — réservé à ROLES_FINANCES (contrôleur), journalisé.
  // ---------------------------------------------------------------------------

  async listerBaremes(anneeScolaire?: string) {
    const annee = anneeScolaire?.trim() || anneeScolaireCourante()
    if (!anneeScolaireValide(annee)) throw new BadRequestException('Année scolaire invalide')
    const baremes = await this.prisma.baremeCotisation.findMany({
      where: { anneeScolaire: annee },
      orderBy: [{ type: 'asc' }, { brancheType: 'asc' }, { libelle: 'asc' }],
    })
    return { anneeScolaire: annee, baremes }
  }

  // Un même barème (année, type, branche, libellé) ne doit exister qu'une fois :
  // deux montants concurrents rendraient la référence ambiguë.
  private async verifierBaremeUnique(
    cle: { anneeScolaire: string; type: CorpsCreationBareme['type']; brancheType: BrancheType | null; libelle: string | null },
    exclureId?: string,
  ) {
    const doublon = await this.prisma.baremeCotisation.findFirst({
      where: { ...cle, ...(exclureId ? { id: { not: exclureId } } : {}) },
      select: { id: true },
    })
    if (doublon) throw new ConflictException('Un barème identique existe déjà pour cette année')
  }

  async creerBareme(utilisateur: UtilisateurSession, corps: CorpsCreationBareme) {
    const { anneeScolaire, type, brancheType, libelle, montant } = corps
    await this.verifierBaremeUnique({ anneeScolaire, type, brancheType, libelle })

    const bareme = await this.prisma.baremeCotisation.create({
      data: { anneeScolaire, type, brancheType, libelle, montant },
    })
    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'BAREME_MODIFIE',
      entite: 'BaremeCotisation',
      entiteId: bareme.id,
      details: { operation: 'CREATION', anneeScolaire, type, brancheType, libelle, montant },
    })
    return bareme
  }

  async modifierBareme(utilisateur: UtilisateurSession, id: string, corps: CorpsModificationBareme) {
    const existant = await this.prisma.baremeCotisation.findUnique({ where: { id } })
    if (!existant) throw new NotFoundException('Barème introuvable')

    const final = {
      anneeScolaire: corps.anneeScolaire ?? existant.anneeScolaire,
      type: corps.type ?? existant.type,
      brancheType: corps.brancheType !== undefined ? corps.brancheType : existant.brancheType,
      libelle: corps.libelle !== undefined ? corps.libelle : existant.libelle,
    }
    await this.verifierBaremeUnique(final, id)

    const bareme = await this.prisma.baremeCotisation.update({
      where: { id },
      data: { ...final, ...(corps.montant !== undefined ? { montant: corps.montant } : {}) },
    })
    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'BAREME_MODIFIE',
      entite: 'BaremeCotisation',
      entiteId: id,
      details: {
        operation: 'MODIFICATION',
        avant: {
          anneeScolaire: existant.anneeScolaire,
          type: existant.type,
          brancheType: existant.brancheType,
          libelle: existant.libelle,
          montant: existant.montant,
        },
        apres: { ...final, montant: bareme.montant },
      },
    })
    return bareme
  }

  async supprimerBareme(utilisateur: UtilisateurSession, id: string) {
    const existant = await this.prisma.baremeCotisation.findUnique({ where: { id } })
    if (!existant) throw new NotFoundException('Barème introuvable')

    await this.prisma.baremeCotisation.delete({ where: { id } })
    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'BAREME_MODIFIE',
      entite: 'BaremeCotisation',
      entiteId: id,
      details: {
        operation: 'SUPPRESSION',
        anneeScolaire: existant.anneeScolaire,
        type: existant.type,
        brancheType: existant.brancheType,
        libelle: existant.libelle,
        montant: existant.montant,
      },
    })
    return { ok: true }
  }
}
