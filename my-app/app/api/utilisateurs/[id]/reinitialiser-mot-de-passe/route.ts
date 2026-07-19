import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_GROUPE as ROLES_AUTORISES } from '@/lib/roles'
import { genererMotDePasseTemporaire } from '@/lib/motDePasseTemporaire'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

type RouteParams = { params: Promise<{ id: string }> }

// Reproduit l'auth/scoping du DELETE de app/api/utilisateurs/[id]/route.ts :
// scope par paroisseId, garde "pas soi-même". Sert à la fois la fiche
// dashboard/utilisateurs/[id] et dashboard/parents/[id] (les parents sont des
// Utilisateur avec role=PARENT, même route, même scoping par paroisse).
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    if (id === session.user.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas réinitialiser votre propre mot de passe' }, { status: 403 })
    }

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId },
      select: { id: true },
    })
    if (!existant) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const motDePasseTemporaire = genererMotDePasseTemporaire()
    const passwordHache = await hash(motDePasseTemporaire, 12)

    await prisma.utilisateur.update({
      where: { id },
      data: { password: passwordHache },
    })

    // Réutilise l'action déjà journalisée par /api/utilisateurs/[id]/password
    // (mot de passe choisi manuellement) : même événement métier, qu'il soit
    // saisi ou généré automatiquement.
    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    // Le mot de passe en clair n'est renvoyé qu'ici, une seule fois à
    // l'appelant : jamais journalisé, jamais stocké en clair ailleurs.
    return NextResponse.json({ motDePasseTemporaire })
  } catch (error) {
    logger.error('POST /api/utilisateurs/[id]/reinitialiser-mot-de-passe', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
