import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    // Une cible ADMIN_PLATEFORME n'existe jamais pour cette surface : un admin
    // plateforme ne réinitialise pas le mot de passe d'un autre admin plateforme
    // via /api/admin/utilisateurs.
    const existant = await prisma.utilisateur.findFirst({
      where: { id, role: { not: 'ADMIN_PLATEFORME' } },
      select: { id: true, paroisseId: true },
    })
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const body = await request.json()
    const { nouveauMotDePasse } = body as { nouveauMotDePasse?: string }

    if (!nouveauMotDePasse || !motDePasseValide(nouveauMotDePasse)) {
      return NextResponse.json({ erreur: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    const passwordHache = await hash(nouveauMotDePasse, 12)

    await prisma.utilisateur.update({
      where: { id },
      data: { password: passwordHache },
    })

    await enregistrerAudit({
      paroisseId: existant.paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return NextResponse.json({ message: 'Mot de passe mis à jour' })
  } catch (error) {
    logger.error('PUT /api/admin/utilisateurs/[id]/password', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
