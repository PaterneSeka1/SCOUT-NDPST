import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_BRANCHE, ROLES_GESTION } from '@/lib/roles'

type RouteParams = { params: Promise<{ id: string; ligneId: string }> }

async function getBrancheUtilisateur(userId: string, paroisseId: string): Promise<string | null> {
  const poste = await prisma.posteBranche.findFirst({
    where: { utilisateurId: userId, paroisseId },
    select: { brancheType: true },
  })
  return poste?.brancheType ?? null
}

async function chargerLigneAutorisee(
  programmeId: string,
  ligneId: string,
  role: string,
  userId: string,
  paroisseId: string,
) {
  const ligne = await prisma.ligneProgramme.findFirst({
    where: { id: ligneId, programmeId },
    include: { programme: true },
  })
  if (!ligne || ligne.programme.paroisseId !== paroisseId) return { erreur: 'Ligne introuvable' as const, statut: 404 }

  if (ROLES_BRANCHE.includes(role)) {
    const bt = await getBrancheUtilisateur(userId, paroisseId)
    if (!bt || ligne.programme.brancheType !== bt) {
      return { erreur: 'Accès refusé à ce programme' as const, statut: 403 }
    }
  }

  return { ligne }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GESTION.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const { id: programmeId, ligneId } = await params
    const verif = await chargerLigneAutorisee(programmeId, ligneId, session.user.role, session.user.id, session.user.paroisseId)
    if ('erreur' in verif) return NextResponse.json({ erreur: verif.erreur }, { status: verif.statut })

    const body = await req.json()
    const { theme, objectif, datePrevue, ordre, activiteId } = body as {
      theme?: string
      objectif?: string | null
      datePrevue?: string | null
      ordre?: number
      activiteId?: string | null
    }

    if (activiteId) {
      const activite = await prisma.activite.findFirst({
        where: { id: activiteId, paroisseId: session.user.paroisseId },
      })
      if (!activite) return NextResponse.json({ erreur: 'Activité introuvable' }, { status: 400 })
    }

    const ligne = await prisma.ligneProgramme.update({
      where: { id: ligneId },
      data: {
        ...(theme !== undefined ? { theme } : {}),
        ...(objectif !== undefined ? { objectif } : {}),
        ...(datePrevue !== undefined ? { datePrevue: datePrevue ? new Date(datePrevue) : null } : {}),
        ...(ordre !== undefined ? { ordre } : {}),
        ...(activiteId !== undefined ? { activiteId } : {}),
      },
      include: { activite: { select: { id: true, titre: true, dateDebut: true } } },
    })

    return NextResponse.json(ligne)
  } catch (error) {
    console.error('[PATCH /api/programmes/[id]/lignes/[ligneId]]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GESTION.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const { id: programmeId, ligneId } = await params
    const verif = await chargerLigneAutorisee(programmeId, ligneId, session.user.role, session.user.id, session.user.paroisseId)
    if ('erreur' in verif) return NextResponse.json({ erreur: verif.erreur }, { status: verif.statut })

    await prisma.ligneProgramme.delete({ where: { id: ligneId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/programmes/[id]/lignes/[ligneId]]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
