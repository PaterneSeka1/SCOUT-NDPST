import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { ROLES_GROUPE, ROLES_DISTRICT_ETENDU } from '@/lib/roles'
import { RoleUtilisateur } from '@/app/generated/prisma/client'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_GROUPE.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId, role: { notIn: ROLES_DISTRICT_ETENDU as RoleUtilisateur[] } },
      select: { id: true },
    })

    if (!existant) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { nouveauMotDePasse } = body as { nouveauMotDePasse?: string }

    if (!nouveauMotDePasse || !motDePasseValide(nouveauMotDePasse)) {
      return NextResponse.json({ error: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    const passwordHache = await hash(nouveauMotDePasse, 12)

    await prisma.utilisateur.update({
      where: { id },
      data: { password: passwordHache },
    })

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return NextResponse.json({ message: 'Mot de passe mis à jour' })
  } catch (error) {
    logger.error('PUT /api/utilisateurs/[id]/password', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
