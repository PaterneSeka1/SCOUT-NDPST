import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { paroisseIdRequise } from '@/lib/session'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  const paroisseId = paroisseIdRequise(session)

  const { id } = await params

  const activite = await prisma.activite.findFirst({
    where: { id, paroisseId },
  })

  if (!activite) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  // Un responsable de branche ne peut consulter les présences que d'une
  // activité de sa propre branche (une activité sans branche = inter-branches,
  // ouverte à tout le staff, comme dans le calcul de la liste de scouts ci-dessous).
  if (ROLES_BRANCHE.includes(session.user.role)) {
    const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
    if (activite.brancheType && activite.brancheType !== bt) {
      return NextResponse.json({ error: 'Accès refusé à cette activité' }, { status: 403 })
    }
  }

  // Pour les camps, on vérifie en plus que le parent a signé (fiche médicale + autorisation) pour CE camp précis
  // (information seule, non bloquant — la décision de présence reste humaine).
  const estCamp = activite.type === 'CAMP'
  const scoutSelect = {
    id: true, nom: true, prenom: true, matricule: true, brancheType: true,
    ...(estCamp
      ? { autorisationsCamp: { where: { activiteId: id }, select: { type: true, confirmeLe: true } } }
      : {}),
  }

  function avecAutorisationCamp<T extends { autorisationsCamp?: { type: string; confirmeLe: Date | null }[] }>(scout: T) {
    if (!estCamp) return scout
    const { autorisationsCamp, ...reste } = scout
    const confirmee = (type: string) =>
      (autorisationsCamp ?? []).some((a) => a.type === type && a.confirmeLe !== null)
    return {
      ...reste,
      autorisationCamp: {
        ficheMedicale: confirmee('FICHE_MEDICALE'),
        autorisationParentale: confirmee('AUTORISATION_PARENTALE'),
      },
    }
  }

  const presences = await prisma.presence.findMany({
    where: { activiteId: id },
    include: {
      scout: { select: scoutSelect },
    },
    orderBy: { scout: { nom: 'asc' } },
  })

  // Si aucune présence n'existe encore, retourner tous les scouts de la branche concernée
  if (presences.length === 0) {
    const whereScout: Record<string, unknown> = { paroisseId, actif: true }
    if (activite.brancheType) {
      whereScout.brancheType = activite.brancheType
    }

    const scouts = await prisma.scout.findMany({
      where: whereScout,
      select: scoutSelect,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    return NextResponse.json(
      scouts.map((scout) => ({ id: null, present: false, commentaire: null, scout: avecAutorisationCamp(scout) }))
    )
  }

  return NextResponse.json(
    presences.map((p) => ({ ...p, scout: avecAutorisationCamp(p.scout) }))
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  const paroisseId = paroisseIdRequise(session)

  const { id } = await params

  const activite = await prisma.activite.findFirst({
    where: { id, paroisseId },
  })

  if (!activite) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  // Cf. GET ci-dessus : un responsable de branche ne peut enregistrer les
  // présences que d'une activité de sa propre branche (ou inter-branches).
  if (ROLES_BRANCHE.includes(session.user.role)) {
    const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
    if (activite.brancheType && activite.brancheType !== bt) {
      return NextResponse.json({ error: 'Accès refusé à cette activité' }, { status: 403 })
    }
  }

  try {
    const corps = await request.json()
    const { presences } = corps as {
      presences: Array<{ scoutId: string; present: boolean; commentaire?: string | null }>
    }

    if (
      !Array.isArray(presences) ||
      presences.some(
        (p) =>
          !p ||
          typeof p.scoutId !== 'string' ||
          !p.scoutId ||
          typeof p.present !== 'boolean' ||
          (p.commentaire != null && typeof p.commentaire !== 'string')
      )
    ) {
      return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
    }

    // Seuls les scouts de la paroisse appartenant à la branche de l'activité
    // (tous pour une activité inter-branches, comme la liste du GET) peuvent
    // être pointés — plus ceux déjà pointés sur cette activité, qui ont pu
    // changer de branche depuis. Empêche d'écrire une présence pour un scout
    // d'une autre paroisse ou d'une autre branche.
    const scoutIds = [...new Set(presences.map((p) => p.scoutId))]
    const autorises = await prisma.scout.findMany({
      where: {
        id: { in: scoutIds },
        paroisseId,
        OR: [
          activite.brancheType ? { brancheType: activite.brancheType } : {},
          { presences: { some: { activiteId: id } } },
        ],
      },
      select: { id: true },
    })
    if (autorises.length !== scoutIds.length) {
      return NextResponse.json({ error: 'Certains scouts ne font pas partie de cette activité' }, { status: 400 })
    }

    const resultats = await prisma.$transaction(
      presences.map((p) =>
        prisma.presence.upsert({
          where: { scoutId_activiteId: { scoutId: p.scoutId, activiteId: id } },
          update: { present: p.present, commentaire: p.commentaire ?? null },
          create: {
            scoutId: p.scoutId,
            activiteId: id,
            present: p.present,
            commentaire: p.commentaire ?? null,
          },
        })
      )
    )

    return NextResponse.json({ enregistrees: resultats.length })
  } catch (error) {
    logger.error('POST /api/activites/[id]/presences', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
