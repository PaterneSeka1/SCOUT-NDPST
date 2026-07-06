import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur } from '@/app/generated/prisma/client'
import { ROLES_GROUPE as ROLES_AUTORISES } from '@/lib/roles'

type RouteParams = { params: Promise<{ id: string }> }

// Vérifie que l'utilisateur ciblé n'est pas admin (protection pour CHEF_GROUPE)
async function cibleAutorisee(session: any, id: string): Promise<boolean> {
  if (session.user.role === 'ADMIN_PAROISSE') return true
  const cible = await prisma.utilisateur.findFirst({
    where: { id, paroisseId: session.user.paroisseId },
    select: { role: true },
  })
  if (!cible) return false
  return cible.role !== 'ADMIN_PAROISSE'
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { id } = await params

    if (!(await cibleAutorisee(session, id)))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const utilisateur = await prisma.utilisateur.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: {
        id: true, nom: true, prenom: true, matricule: true,
        email: true, role: true, actif: true, paroisseId: true,
        createdAt: true, updatedAt: true,
      },
    })

    if (!utilisateur) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    return NextResponse.json(utilisateur)
  } catch (error) {
    console.error('[GET /api/utilisateurs/[id]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { id } = await params

    if (!(await cibleAutorisee(session, id)))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true },
    })
    if (!existant) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const body = await request.json()
    const { nom, prenom, email, role, actif } = body as {
      nom?: string; prenom?: string; email?: string; role?: string; actif?: boolean
    }

    if (role !== undefined && !(role in RoleUtilisateur))
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

    // CHEF_GROUPE ne peut pas attribuer le rôle ADMIN_PAROISSE
    if (session.user.role === 'CHEF_GROUPE' && role === 'ADMIN_PAROISSE')
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    if (email !== undefined) {
      const doublon = await prisma.utilisateur.findFirst({ where: { email, NOT: { id } }, select: { id: true } })
      if (doublon) return NextResponse.json({ error: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
    }

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom } : {}),
        ...(prenom !== undefined ? { prenom } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(role !== undefined ? { role: role as RoleUtilisateur } : {}),
        ...(actif !== undefined ? { actif } : {}),
      },
      select: {
        id: true, nom: true, prenom: true, matricule: true,
        email: true, role: true, actif: true, paroisseId: true,
        createdAt: true, updatedAt: true,
      },
    })

    return NextResponse.json(utilisateur)
  } catch (error) {
    console.error('[PUT /api/utilisateurs/[id]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { id } = await params

    if (!(await cibleAutorisee(session, id)))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true },
    })
    if (!existant) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data: { actif: false },
      select: {
        id: true, nom: true, prenom: true, matricule: true,
        email: true, role: true, actif: true, paroisseId: true,
        createdAt: true, updatedAt: true,
      },
    })

    return NextResponse.json(utilisateur)
  } catch (error) {
    console.error('[DELETE /api/utilisateurs/[id]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
