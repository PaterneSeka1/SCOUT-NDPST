import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { TypeActiviteSchema, BrancheTypeSchema } from '@/lib/validation'
import { paroisseIdRequise } from '@/lib/session'

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

  let brancheRequise: string | undefined
  if (ROLES_BRANCHE.includes(session.user.role)) {
    const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
    if (!bt) return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
    brancheRequise = bt
  }

  const activite = await prisma.activite.findFirst({
    where: {
      id,
      paroisseId,
      ...(brancheRequise ? { OR: [{ brancheType: brancheRequise as never }, { brancheType: null }] } : {}),
    },
    include: {
      _count: { select: { presences: true } },
    },
  })

  if (!activite) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  return NextResponse.json(activite)
}

export async function PUT(
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

  // Un responsable de branche ne peut modifier que les activités de sa propre
  // branche (ou inter-branches), et ne peut pas déplacer une activité vers
  // une autre branche.
  let brancheUtilisateur: string | undefined
  if (ROLES_BRANCHE.includes(session.user.role)) {
    const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
    if (!bt) return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
    brancheUtilisateur = bt
  }

  const existante = await prisma.activite.findFirst({
    where: {
      id,
      paroisseId,
      ...(brancheUtilisateur ? { OR: [{ brancheType: brancheUtilisateur as never }, { brancheType: null }] } : {}),
    },
  })

  if (!existante) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  const corps = await request.json()
  const { titre, description, dateDebut, dateFin, lieu, type, brancheType } = corps

  if (type !== undefined && !TypeActiviteSchema.safeParse(type).success) {
    return NextResponse.json({ error: "Type d'activité invalide" }, { status: 400 })
  }
  if (brancheType != null && brancheType !== '' && !BrancheTypeSchema.safeParse(brancheType).success) {
    return NextResponse.json({ error: 'Branche invalide' }, { status: 400 })
  }
  if (brancheUtilisateur && brancheType !== undefined && (brancheType || null) !== existante.brancheType) {
    return NextResponse.json({ error: 'Le changement de branche est réservé au groupe' }, { status: 403 })
  }

  const activite = await prisma.activite.update({
    where: { id },
    data: {
      ...(titre !== undefined && { titre }),
      ...(description !== undefined && { description }),
      ...(dateDebut !== undefined && { dateDebut: new Date(dateDebut) }),
      ...(dateFin !== undefined && { dateFin: dateFin ? new Date(dateFin) : null }),
      ...(lieu !== undefined && { lieu }),
      ...(type !== undefined && { type }),
      ...(brancheType !== undefined && { brancheType: brancheType || null }),
    },
    include: {
      _count: { select: { presences: true } },
    },
  })

  return NextResponse.json(activite)
}

export async function DELETE(
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

  const existante = await prisma.activite.findFirst({
    where: { id, paroisseId },
  })

  if (!existante) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  const peutSupprimer =
    existante.creePar === session.user.id || session.user.role === 'CHEF_GROUPE'

  if (!peutSupprimer) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  await prisma.activite.delete({ where: { id } })

  return NextResponse.json({ message: 'Activité supprimée' })
}
