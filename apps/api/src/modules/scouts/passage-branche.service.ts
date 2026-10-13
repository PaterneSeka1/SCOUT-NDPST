import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { BrancheTypeSchema, brancheSelonAge, calculerAge } from '@scout/shared'
import type { BrancheType } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import { paroisseIdRequise } from '../../common/paroisse'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import { corpsObjet } from './corps'

interface Proposition {
  scoutId: string
  nom: string
  prenom: string
  matricule: string | null
  age: number
  brancheActuelle: string
  brancheProposee: string | null
}

@Injectable()
export class PassageBrancheService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Calcule, pour chaque scout actif, la branche correspondant à son âge à la
  // date de référence, et propose un changement si elle diffère de la branche
  // actuelle. Ne modifie rien : c'est une prévisualisation.
  async previsualiser(utilisateur: UtilisateurSession, dateRefParam: string | null) {
    const dateReference = dateRefParam ? new Date(dateRefParam) : new Date()
    if (Number.isNaN(dateReference.getTime())) throw new BadRequestException('Date de référence invalide')

    const paroisseId = paroisseIdRequise(utilisateur)

    const scouts = await this.prisma.scout.findMany({
      where: { paroisseId, actif: true },
      select: { id: true, nom: true, prenom: true, matricule: true, dateNaissance: true, brancheType: true },
      orderBy: [{ brancheType: 'asc' }, { nom: 'asc' }],
    })

    const propositions: Proposition[] = []
    for (const scout of scouts) {
      const age = calculerAge(scout.dateNaissance, dateReference)
      const brancheCorrespondante = brancheSelonAge(age)
      // brancheCorrespondante === null : trop jeune pour Oisillons (probable
      // erreur de saisie de la date de naissance) — on ne propose rien dans
      // ce cas. Au-delà de 20 ans révolus, le scout n'est plus "sorti du
      // mouvement" automatiquement : il est proposé en Ressources Adultes
      // (branche sans limite d'âge supérieure, cf. TRANCHES_AGE_BRANCHES).
      if (brancheCorrespondante === scout.brancheType) continue
      if (brancheCorrespondante === null && age < 6) continue

      propositions.push({
        scoutId: scout.id,
        nom: scout.nom,
        prenom: scout.prenom,
        matricule: scout.matricule,
        age,
        brancheActuelle: scout.brancheType,
        brancheProposee: brancheCorrespondante,
      })
    }

    return { dateReference: dateReference.toISOString(), propositions }
  }

  // Applique en bloc les passages de branche sélectionnés par l'utilisateur
  // (jamais automatique : toujours une confirmation explicite, scout par
  // scout, depuis la liste renvoyée par la prévisualisation).
  async appliquer(utilisateur: UtilisateurSession, brut: unknown) {
    const corps = corpsObjet(brut)
    const passagesBruts = corps.passages
    if (!Array.isArray(passagesBruts) || passagesBruts.length === 0) {
      throw new BadRequestException('Aucun passage à appliquer')
    }

    const passages: { scoutId: string; nouvelleBranche: BrancheType | null }[] = []
    for (const p of passagesBruts as unknown[]) {
      const passage = (typeof p === 'object' && p !== null ? p : {}) as Record<string, unknown>
      if (typeof passage.scoutId !== 'string' || !passage.scoutId) {
        throw new BadRequestException('scoutId manquant')
      }
      const nouvelleBranche = passage.nouvelleBranche
      if (nouvelleBranche != null && !BrancheTypeSchema.safeParse(nouvelleBranche).success) {
        throw new BadRequestException('Branche invalide')
      }
      passages.push({
        scoutId: passage.scoutId,
        nouvelleBranche: (nouvelleBranche ?? null) as BrancheType | null,
      })
    }

    const paroisseId = paroisseIdRequise(utilisateur)

    // Vérifie que tous les scouts appartiennent bien à la paroisse de l'appelant,
    // et récupère leur branche actuelle pour la trace d'audit (ancienne → nouvelle).
    const scoutIds = passages.map((p) => p.scoutId)
    const scoutsExistants = await this.prisma.scout.findMany({
      where: { id: { in: scoutIds }, paroisseId },
      select: { id: true, brancheType: true },
    })
    if (scoutsExistants.length !== scoutIds.length) {
      throw new NotFoundException('Un ou plusieurs scouts sont introuvables')
    }
    const brancheActuelleParScout = new Map(scoutsExistants.map((s) => [s.id, s.brancheType]))

    await this.prisma.$transaction(
      passages.map((p) =>
        p.nouvelleBranche
          ? this.prisma.scout.update({ where: { id: p.scoutId }, data: { brancheType: p.nouvelleBranche } })
          : // nouvelleBranche null = sortie du mouvement (âge dépassé) : le scout
            // est désactivé plutôt que supprimé, pour conserver son historique.
            this.prisma.scout.update({ where: { id: p.scoutId }, data: { actif: false } }),
      ),
    )

    // Action sensible (changement de branche en masse, ou sortie définitive du
    // mouvement) : une entrée d'audit par scout, à l'image des autres opérations
    // en masse (voir /api/cotisations).
    await Promise.all(
      passages.map((p) =>
        this.audit.enregistrer({
          paroisseId,
          acteurId: utilisateur.id,
          action: p.nouvelleBranche ? 'SCOUT_BRANCHE_MODIFIEE' : 'SCOUT_SORTIE_MOUVEMENT',
          entite: 'Scout',
          entiteId: p.scoutId,
          details: { ancienneBranche: brancheActuelleParScout.get(p.scoutId), nouvelleBranche: p.nouvelleBranche },
        }),
      ),
    )

    return { appliques: passages.length }
  }
}
