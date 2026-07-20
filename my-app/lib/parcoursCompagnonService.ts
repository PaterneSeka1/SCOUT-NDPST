// Orchestration Prisma du parcours de progression individuelle des Compagnons.
// Le calcul (âge, dates, statuts) reste dans lib/parcoursCompagnon.ts (fonctions
// pures) — ce fichier ne fait que persister leur résultat et journaliser
// l'audit, jamais l'inverse (voir PROMPT_INTEGRATION_PROGRESSION_ROUTIER.md §5).
import { prisma } from './prisma'
import { logger } from './logger'
import { enregistrerAudit } from './audit'
import {
  calculerAgeEntree,
  calculerStatutAffiche,
  calculerDateFinPrevue,
  dejaAlerteRecemment,
  determinerTrancheAge,
  genererLignesProgression,
  type TrancheAgeCompagnon,
} from './parcoursCompagnon'

export class ParcoursDejaExistantError extends Error {}
export class ReferentielVideError extends Error {}

/**
 * Charge une ProgressionCompagnon avec le contexte nécessaire à l'autorisation
 * (parcours + scout) et à l'audit — factorisé ici pour éviter de dupliquer la
 * même requête dans les trois routes du workflow (soumettre/valider/rejeter).
 */
export async function chargerProgressionAvecScout(progressionId: string) {
  return prisma.progressionCompagnon.findUnique({
    where: { id: progressionId },
    include: {
      etapeActivite: true,
      parcours: { include: { scout: { select: { id: true, paroisseId: true, brancheType: true } } } },
    },
  })
}

interface CreationParcoursParams {
  scoutId: string
  dateNaissance: Date
  paroisseId: string
  dateEntreeParcours: Date
  responsableId?: string | null
  acteurId: string
}

export interface ParcoursGenere {
  id: string
  ageEntree: number
  trancheAge: TrancheAgeCompagnon
  dateFinPrevue: Date
  alerteEntreeVingtAns: boolean
}

/**
 * Génère le parcours d'un Compagnon : calcule l'âge et la tranche d'entrée,
 * lit le référentiel actif, génère toutes les lignes de progression théorique
 * et les persiste dans une transaction atomique. Lève AgeEntreeInvalideError
 * (âge hors 18-20 ans), ParcoursDejaExistantError ou ReferentielVideError —
 * à la charge de l'appelant (route API) de les traduire en réponse HTTP.
 */
export async function genererParcoursCompagnon(params: CreationParcoursParams): Promise<ParcoursGenere> {
  const existant = await prisma.parcoursCompagnon.findUnique({ where: { scoutId: params.scoutId } })
  if (existant) {
    throw new ParcoursDejaExistantError('Un parcours de progression existe déjà pour ce scout')
  }

  const ageEntree = calculerAgeEntree(params.dateNaissance, params.dateEntreeParcours)
  const trancheAge = determinerTrancheAge(ageEntree) // peut lever AgeEntreeInvalideError

  const referentiel = await prisma.etapeParcoursCompagnon.findMany({
    where: { actif: true },
    orderBy: { ordre: 'asc' },
  })
  if (referentiel.length === 0) {
    throw new ReferentielVideError('Le référentiel du parcours Compagnons est vide — contactez un administrateur')
  }

  const lignes = genererLignesProgression(referentiel, trancheAge, params.dateEntreeParcours)
  const dateFinPrevue = calculerDateFinPrevue(lignes)

  const parcours = await prisma.$transaction(async (tx) => {
    const parcoursCree = await tx.parcoursCompagnon.create({
      data: {
        scoutId: params.scoutId,
        dateEntreeParcours: params.dateEntreeParcours,
        ageEntree,
        trancheAge,
        dateFinPrevue,
        responsableId: params.responsableId ?? null,
      },
    })

    await tx.progressionCompagnon.createMany({
      data: lignes.map((ligne) => ({
        parcoursId: parcoursCree.id,
        etapeActiviteId: ligne.etapeActiviteId,
        dateDebutTheorique: ligne.dateDebutTheorique,
        dateLimiteTheorique: ligne.dateLimiteTheorique,
        statut: 'A_VENIR',
      })),
    })

    return parcoursCree
  })

  await enregistrerAudit({
    paroisseId: params.paroisseId,
    acteurId: params.acteurId,
    action: 'PARCOURS_COMPAGNON_GENERE',
    entite: 'ParcoursCompagnon',
    entiteId: parcours.id,
    details: { scoutId: params.scoutId, trancheAge, ageEntree, dateFinPrevue: dateFinPrevue.toISOString() },
  })

  const alerteEntreeVingtAns = trancheAge === 'VINGT_ANS'
  if (alerteEntreeVingtAns) {
    logger.warn('parcours_compagnon.entree_vingt_ans', { scoutId: params.scoutId, parcoursId: parcours.id })
  }

  return { id: parcours.id, ageEntree, trancheAge, dateFinPrevue, alerteEntreeVingtAns }
}

// ---------------------------------------------------------------------------
// Recalcul des statuts temporels — appelé par la route cron (déclencheur
// externe) et par la route d'administration (déclenchement manuel), voir §5.5.
// ---------------------------------------------------------------------------

export interface ResultatRecalcul {
  progressionsAnalysees: number
  progressionsMisesAJour: number
  nouvellesAlertesRetard: number
}

export async function recalculerStatutsProgressionsCompagnon(maintenant: Date = new Date()): Promise<ResultatRecalcul> {
  const progressions = await prisma.progressionCompagnon.findMany({
    where: { statut: { in: ['A_VENIR', 'EN_COURS', 'EN_RETARD'] } },
    select: {
      id: true,
      statut: true,
      dateDebutTheorique: true,
      dateLimiteTheorique: true,
      derniereAlerteRetardLe: true,
    },
  })

  let progressionsMisesAJour = 0
  let nouvellesAlertesRetard = 0

  for (const progression of progressions) {
    const nouveauStatut = calculerStatutAffiche(progression, maintenant)
    const devientEnRetard =
      nouveauStatut === 'EN_RETARD' && !dejaAlerteRecemment(progression.derniereAlerteRetardLe, maintenant)

    if (nouveauStatut === progression.statut && !devientEnRetard) continue

    try {
      await prisma.progressionCompagnon.update({
        where: { id: progression.id },
        data: {
          statut: nouveauStatut,
          ...(devientEnRetard ? { derniereAlerteRetardLe: maintenant } : {}),
        },
      })
      progressionsMisesAJour += 1
      if (devientEnRetard) nouvellesAlertesRetard += 1
    } catch (error) {
      // Une ligne en échec ne doit jamais interrompre le traitement des autres.
      logger.error('parcours_compagnon.recalcul_ligne_echouee', error, { progressionId: progression.id })
    }
  }

  logger.info('parcours_compagnon.recalcul_termine', {
    progressionsAnalysees: progressions.length,
    progressionsMisesAJour,
    nouvellesAlertesRetard,
  })

  return { progressionsAnalysees: progressions.length, progressionsMisesAJour, nouvellesAlertesRetard }
}
