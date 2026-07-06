import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  const activite = await prisma.activite.findFirst({
    where: { id, paroisseId: session.user.paroisseId },
  })

  if (!activite) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  // Pour les camps, on vérifie en plus la présence d'une fiche médicale au dossier (information seule, non bloquant)
  const estCamp = activite.type === 'CAMP'
  const scoutSelect = {
    id: true, nom: true, prenom: true, matricule: true, brancheType: true,
    ...(estCamp
      ? { documents: { where: { type: 'CERTIFICAT_MEDICAL' as const }, select: { id: true }, take: 1 } }
      : {}),
  }

  function avecFicheMedicale<T extends { documents?: { id: string }[] }>(scout: T) {
    if (!estCamp) return scout
    const { documents, ...reste } = scout
    return { ...reste, ficheMedicale: (documents?.length ?? 0) > 0 }
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
    const whereScout: Record<string, unknown> = { paroisseId: session.user.paroisseId, actif: true }
    if (activite.brancheType) {
      whereScout.brancheType = activite.brancheType
    }

    const scouts = await prisma.scout.findMany({
      where: whereScout,
      select: scoutSelect,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    return NextResponse.json(
      scouts.map((scout) => ({ id: null, present: false, commentaire: null, scout: avecFicheMedicale(scout) }))
    )
  }

  return NextResponse.json(
    presences.map((p) => ({ ...p, scout: avecFicheMedicale(p.scout) }))
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

  const { id } = await params

  const activite = await prisma.activite.findFirst({
    where: { id, paroisseId: session.user.paroisseId },
  })

  if (!activite) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  const corps = await request.json()
  const { presences } = corps as {
    presences: Array<{ scoutId: string; present: boolean; commentaire?: string }>
  }

  if (!Array.isArray(presences)) {
    return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
  }

  const resultats = await Promise.all(
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
}
