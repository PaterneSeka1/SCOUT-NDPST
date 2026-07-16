import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_GROUPE, ROLES_TOUT_STAFF } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

// Passation volontaire de la direction de groupe : seul le Chef de Groupe en
// exercice peut céder sa place (ROLES_GROUPE = ['CHEF_GROUPE']), à un membre
// du staff de sa propre paroisse. Contrairement à /api/utilisateurs/[id], qui
// interdit à quiconque de changer son propre rôle, cette route existe
// précisément pour ça — de façon atomique et restreinte : le successeur
// devient Chef de Groupe, l'ancien devient Assistant de Groupe, dans la même
// transaction (jamais deux chefs actifs à la fois, contrainte SQL — voir
// prisma/schema.prisma).
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GROUPE.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const paroisseId = paroisseIdRequise(session)
    const body = await request.json()
    const { successeurId } = body as { successeurId?: string }
    if (!successeurId?.trim()) {
      return NextResponse.json({ error: 'Le successeur est requis' }, { status: 400 })
    }
    if (successeurId === session.user.id) {
      return NextResponse.json({ error: 'Vous êtes déjà Chef de Groupe' }, { status: 400 })
    }

    const successeur = await prisma.utilisateur.findFirst({
      where: { id: successeurId, paroisseId, actif: true },
      select: { id: true, role: true },
    })
    if (!successeur) return NextResponse.json({ error: 'Membre introuvable dans votre paroisse' }, { status: 404 })
    if (!ROLES_TOUT_STAFF.includes(successeur.role)) {
      return NextResponse.json({ error: 'Seul un membre du staff peut devenir Chef de Groupe' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.utilisateur.update({
        where: { id: session.user.id },
        data: { role: 'ASSISTANT_GROUPE', brancheType: null },
      }),
      prisma.utilisateur.update({
        where: { id: successeur.id },
        data: { role: 'CHEF_GROUPE', brancheType: null },
      }),
    ])

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'CHEF_GROUPE_DESIGNE',
      entite: 'Paroisse',
      entiteId: paroisseId,
      details: { ancienChefId: session.user.id, nouveauChefId: successeur.id, methode: 'passation' },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('POST /api/utilisateurs/chef-groupe/ceder', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
