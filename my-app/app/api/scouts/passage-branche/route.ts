import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ROLES_GROUPE } from '@/lib/roles'
import { BrancheTypeSchema } from '@/lib/validation'
import { calculerAge, brancheSelonAge } from '@/lib/branches'
import { BrancheType } from '@/app/generated/prisma/client'
import { paroisseIdRequise } from '@/lib/session'

// GET — calcule, pour chaque scout actif, la branche correspondant à son âge
// à la date de référence, et propose un changement si elle diffère de la
// branche actuelle. Ne modifie rien : c'est une prévisualisation.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GROUPE.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dateRefParam = searchParams.get('dateReference')
    const dateReference = dateRefParam ? new Date(dateRefParam) : new Date()
    if (Number.isNaN(dateReference.getTime())) {
      return NextResponse.json({ erreur: 'Date de référence invalide' }, { status: 400 })
    }

    const paroisseId = paroisseIdRequise(session)

    const scouts = await prisma.scout.findMany({
      where: { paroisseId, actif: true },
      select: { id: true, nom: true, prenom: true, matricule: true, dateNaissance: true, brancheType: true },
      orderBy: [{ brancheType: 'asc' }, { nom: 'asc' }],
    })

    const propositions: {
      scoutId: string; nom: string; prenom: string; matricule: string | null
      age: number; brancheActuelle: string; brancheProposee: string | null
    }[] = []

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

    return NextResponse.json({ dateReference: dateReference.toISOString(), propositions })
  } catch (error) {
    logger.error('GET /api/scouts/passage-branche', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — applique en bloc les passages de branche sélectionnés par
// l'utilisateur (jamais automatique : toujours une confirmation explicite,
// scout par scout, depuis la liste renvoyée par GET).
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GROUPE.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { passages } = body as {
      passages?: Array<{ scoutId?: string; nouvelleBranche?: string | null }>
    }

    if (!Array.isArray(passages) || passages.length === 0) {
      return NextResponse.json({ erreur: 'Aucun passage à appliquer' }, { status: 400 })
    }

    for (const p of passages) {
      if (!p.scoutId) {
        return NextResponse.json({ erreur: 'scoutId manquant' }, { status: 400 })
      }
      if (p.nouvelleBranche != null && !BrancheTypeSchema.safeParse(p.nouvelleBranche).success) {
        return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
      }
    }

    const paroisseId = paroisseIdRequise(session)

    // Vérifie que tous les scouts appartiennent bien à la paroisse de l'appelant.
    const scoutIds = passages.map((p) => p.scoutId!)
    const scoutsAutorises = await prisma.scout.count({
      where: { id: { in: scoutIds }, paroisseId },
    })
    if (scoutsAutorises !== scoutIds.length) {
      return NextResponse.json({ erreur: 'Un ou plusieurs scouts sont introuvables' }, { status: 404 })
    }

    await prisma.$transaction(
      passages.map((p) =>
        p.nouvelleBranche
          ? prisma.scout.update({ where: { id: p.scoutId! }, data: { brancheType: p.nouvelleBranche as BrancheType } })
          // nouvelleBranche null = sortie du mouvement (âge dépassé) : le scout
          // est désactivé plutôt que supprimé, pour conserver son historique.
          : prisma.scout.update({ where: { id: p.scoutId! }, data: { actif: false } }),
      ),
    )

    return NextResponse.json({ appliques: passages.length })
  } catch (error) {
    logger.error('POST /api/scouts/passage-branche', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
