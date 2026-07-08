import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur } from '@/app/generated/prisma/client'
import { ROLES_GROUPE as ROLES_AUTORISES } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    const utilisateur = await prisma.utilisateur.findFirst({
      where: { id, paroisseId },
      select: {
        id: true, nom: true, prenom: true, matricule: true,
        email: true, role: true, actif: true, paroisseId: true,
        createdAt: true, updatedAt: true,
      },
    })

    if (!utilisateur) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('GET /api/utilisateurs/[id]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId },
      select: { id: true, role: true, actif: true },
    })
    if (!existant) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const body = await request.json()
    const { nom, prenom, email, role, actif } = body as {
      nom?: string; prenom?: string; email?: string; role?: string; actif?: boolean
    }

    if (role !== undefined && !(role in RoleUtilisateur))
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

    // Un admin plateforme (transverse, sans paroisse) ne se promeut jamais
    // depuis cette route, quel que soit qui l'appelle.
    if (role === 'ADMIN_PLATEFORME')
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

    // Personne ne peut changer son propre rôle ou se désactiver soi-même —
    // sans quoi un compte connaissant son propre id pourrait s'auto-promouvoir
    // ou verrouiller son propre accès.
    if (id === session.user.id && ((role !== undefined && role !== existant.role) || actif === false)) {
      return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre rôle ou vous désactiver' }, { status: 403 })
    }

    if (email !== undefined && email !== null && email !== '') {
      const doublon = await prisma.utilisateur.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      })
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

    if (role !== undefined && role !== existant.role) {
      await enregistrerAudit({
        paroisseId,
        acteurId: session.user.id,
        action: 'UTILISATEUR_ROLE_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { ancienRole: existant.role, nouveauRole: role },
      })
    }
    if (actif !== undefined && actif !== existant.actif) {
      await enregistrerAudit({
        paroisseId,
        acteurId: session.user.id,
        action: actif ? 'UTILISATEUR_REACTIVE' : 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }

    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('PUT /api/utilisateurs/[id]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    if (id === session.user.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas vous désactiver vous-même' }, { status: 403 })
    }

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId },
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

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_DESACTIVE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('DELETE /api/utilisateurs/[id]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
