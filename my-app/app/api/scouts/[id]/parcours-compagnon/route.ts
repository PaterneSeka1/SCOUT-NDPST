import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  autoriseConsultationParcoursCompagnon,
  autoriseDeclarationParcoursCompagnon,
} from '@/lib/parcoursCompagnonPermissions'
import {
  genererParcoursCompagnon,
  ParcoursDejaExistantError,
  ReferentielVideError,
} from '@/lib/parcoursCompagnonService'
import {
  formaterProgressionsAffichables,
  calculerAvancementDepuisBrut,
  AgeEntreeInvalideError,
} from '@/lib/parcoursCompagnon'

type RouteParams = { params: Promise<{ id: string }> }

// GET — parcours de progression individuelle du scout (branche Compagnons),
// avec statut temporel recalculé à la volée (voir calculerStatutAffiche) :
// le job cron persiste périodiquement la même valeur pour les besoins de
// filtrage/statistiques, mais l'affichage n'attend jamais son passage.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params

    const scout = await prisma.scout.findUnique({
      where: { id },
      select: { id: true, nom: true, prenom: true, paroisseId: true, brancheType: true },
    })

    if (!scout || !(await autoriseConsultationParcoursCompagnon(session, scout))) {
      return NextResponse.json({ erreur: 'Scout introuvable' }, { status: 404 })
    }

    const scoutReponse = { id: scout.id, nom: scout.nom, prenom: scout.prenom, brancheType: scout.brancheType }
    const brancheCompatible = scout.brancheType === 'COMPAGNONS'

    const parcours = await prisma.parcoursCompagnon.findUnique({
      where: { scoutId: id },
      include: {
        progressions: { include: { etapeActivite: true } },
        attributsObtenus: true,
      },
    })

    if (!parcours) {
      return NextResponse.json({
        scout: scoutReponse,
        brancheCompatible,
        parcours: null,
        progressions: [],
        attributsObtenus: [],
        avancement: null,
      })
    }

    const maintenant = new Date()
    const progressionsReponse = formaterProgressionsAffichables(parcours.progressions, maintenant)
    const avancement = calculerAvancementDepuisBrut(parcours.progressions, maintenant)

    return NextResponse.json({
      scout: scoutReponse,
      brancheCompatible,
      parcours: {
        id: parcours.id,
        dateEntreeParcours: parcours.dateEntreeParcours.toISOString(),
        ageEntree: parcours.ageEntree,
        trancheAge: parcours.trancheAge,
        dateFinPrevue: parcours.dateFinPrevue.toISOString(),
        dateFinReelle: parcours.dateFinReelle?.toISOString() ?? null,
        statut: parcours.statut,
        responsableId: parcours.responsableId,
      },
      progressions: progressionsReponse,
      attributsObtenus: parcours.attributsObtenus,
      avancement,
    })
  } catch (error) {
    logger.error('GET /api/scouts/[id]/parcours-compagnon', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — génère le parcours de progression d'un Compagnon (calcul de l'âge,
// de la tranche, et de toutes les lignes de progression théorique). Réservé
// aux rôles de branche (+ admin plateforme) — voir lib/parcoursCompagnonPermissions.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params

    const scout = await prisma.scout.findUnique({
      where: { id },
      select: { id: true, paroisseId: true, brancheType: true, dateNaissance: true },
    })

    if (!scout || !(await autoriseDeclarationParcoursCompagnon(session, scout))) {
      return NextResponse.json({ erreur: 'Scout introuvable' }, { status: 404 })
    }

    if (scout.brancheType !== 'COMPAGNONS') {
      return NextResponse.json(
        { erreur: 'Le parcours de progression individuelle est réservé à la branche Compagnons' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const { dateEntreeParcours, responsableId } = body as { dateEntreeParcours?: string; responsableId?: string }

    if (!dateEntreeParcours || Number.isNaN(Date.parse(dateEntreeParcours))) {
      return NextResponse.json(
        { erreur: 'dateEntreeParcours est requise et doit être une date valide' },
        { status: 400 },
      )
    }

    const responsableIdNettoye = responsableId?.trim() || null
    if (responsableIdNettoye) {
      const responsable = await prisma.utilisateur.findUnique({ where: { id: responsableIdNettoye }, select: { id: true } })
      if (!responsable) {
        return NextResponse.json({ erreur: 'Responsable introuvable' }, { status: 400 })
      }
    }

    try {
      const parcours = await genererParcoursCompagnon({
        scoutId: scout.id,
        dateNaissance: scout.dateNaissance,
        paroisseId: scout.paroisseId,
        dateEntreeParcours: new Date(dateEntreeParcours),
        responsableId: responsableIdNettoye,
        acteurId: session.user.id,
      })

      return NextResponse.json(parcours, { status: 201 })
    } catch (error) {
      if (error instanceof AgeEntreeInvalideError) {
        return NextResponse.json({ erreur: error.message }, { status: 400 })
      }
      if (error instanceof ParcoursDejaExistantError) {
        return NextResponse.json({ erreur: error.message }, { status: 409 })
      }
      if (error instanceof ReferentielVideError) {
        return NextResponse.json({ erreur: error.message }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    logger.error('POST /api/scouts/[id]/parcours-compagnon', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
