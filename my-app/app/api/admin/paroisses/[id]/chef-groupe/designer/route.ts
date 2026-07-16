import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME, ROLES_TOUT_STAFF } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

// Désigne un membre déjà existant de la paroisse comme Chef de Groupe — à la
// différence de POST /chef-groupe (qui crée un nouveau compte), cette route
// promeut un compte présent dans l'équipe. S'il y a déjà un Chef de Groupe
// actif, il est rétrogradé Assistant de Groupe dans la même transaction : une
// paroisse n'a jamais deux Chefs de Groupe actifs à la fois (contrainte SQL,
// voir prisma/schema.prisma).
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id: paroisseId } = await params
    const body = await request.json()
    const { utilisateurId } = body as { utilisateurId?: string }
    if (!utilisateurId?.trim()) {
      return NextResponse.json({ erreur: 'Le membre à désigner est requis' }, { status: 400 })
    }

    const cible = await prisma.utilisateur.findFirst({
      where: { id: utilisateurId, paroisseId, actif: true },
      select: { id: true, role: true },
    })
    if (!cible) return NextResponse.json({ erreur: 'Membre introuvable dans cette paroisse' }, { status: 404 })
    if (cible.role === 'CHEF_GROUPE') {
      return NextResponse.json({ erreur: 'Ce membre est déjà Chef de Groupe' }, { status: 400 })
    }
    if (!ROLES_TOUT_STAFF.includes(cible.role)) {
      return NextResponse.json({ erreur: 'Seul un membre du staff peut être désigné Chef de Groupe' }, { status: 400 })
    }

    const ancienChef = await prisma.utilisateur.findFirst({
      where: { paroisseId, role: 'CHEF_GROUPE', actif: true },
      select: { id: true },
    })

    await prisma.$transaction(async (tx) => {
      if (ancienChef) {
        await tx.utilisateur.update({
          where: { id: ancienChef.id },
          data: { role: 'ASSISTANT_GROUPE', brancheType: null },
        })
      }
      await tx.utilisateur.update({
        where: { id: cible.id },
        data: { role: 'CHEF_GROUPE', brancheType: null },
      })
    })

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'CHEF_GROUPE_DESIGNE',
      entite: 'Paroisse',
      entiteId: paroisseId,
      details: { ancienChefId: ancienChef?.id ?? null, nouveauChefId: cible.id, methode: 'admin' },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('POST /api/admin/paroisses/[id]/chef-groupe/designer', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
