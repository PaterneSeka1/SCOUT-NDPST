import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { genererMotDePasseTemporaire } from '@/lib/motDePasseTemporaire'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

// Reproduit l'auth/scoping du DELETE de app/api/admin/utilisateurs/[id]/route.ts :
// une cible ADMIN_PLATEFORME n'existe jamais pour cette surface, un admin
// plateforme ne gère pas d'autres admins plateforme via /api/admin/utilisateurs.
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const existant = await prisma.utilisateur.findFirst({
      where: { id, role: { not: 'ADMIN_PLATEFORME' } },
      select: { id: true, paroisseId: true },
    })
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const motDePasseTemporaire = genererMotDePasseTemporaire()
    const passwordHache = await hash(motDePasseTemporaire, 12)

    await prisma.utilisateur.update({
      where: { id },
      data: { password: passwordHache },
    })

    // Réutilise l'action déjà journalisée par les routes .../password
    // existantes (mot de passe choisi manuellement) : c'est le même
    // événement métier (mot de passe réinitialisé côté admin), qu'il soit
    // saisi ou généré automatiquement — pas de fragmentation de l'audit.
    await enregistrerAudit({
      paroisseId: existant.paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    // Le mot de passe en clair n'est renvoyé qu'ici, une seule fois à
    // l'appelant : jamais journalisé, jamais stocké en clair ailleurs.
    return NextResponse.json({ motDePasseTemporaire })
  } catch (error) {
    logger.error('POST /api/admin/utilisateurs/[id]/reinitialiser-mot-de-passe', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
