import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import { ROLES_DISTRICT as ROLES_AUTORISES, ROLES_ASSIGNABLES_DISTRICT } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'
import { BrancheTypeSchema } from '@/lib/validation'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    const utilisateur = await prisma.utilisateur.findFirst({
      where: { id, paroisseId, role: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] } },
      select: {
        id: true, nom: true, prenom: true, matricule: true, telephone: true,
        email: true, role: true, fonction: true, brancheType: true, actif: true, paroisseId: true,
        createdAt: true, updatedAt: true,
      },
    })

    if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('GET /api/district/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId, role: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] } },
      select: { id: true, role: true, actif: true, fonction: true },
    })
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const body = await request.json()
    const { nom, prenom, email, role, actif, fonction, brancheType } = body as {
      nom?: string; prenom?: string; email?: string; role?: string; actif?: boolean
      fonction?: string | null; brancheType?: string | null
    }

    if (role !== undefined && !ROLES_ASSIGNABLES_DISTRICT.includes(role))
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success)
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })

    if (email !== undefined && email !== null && email !== '') {
      const doublon = await prisma.utilisateur.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      })
      if (doublon) return NextResponse.json({ erreur: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
    }

    // fonction n'a de sens que pour ASSISTANT_DISTRICT : si le rôle final
    // (après cette modification) n'est pas ASSISTANT_DISTRICT, on la force à
    // null même si elle n'a pas été envoyée — un ADJOINT_DISTRICT ne doit
    // jamais conserver une fonction héritée d'un rôle précédent.
    const roleFinal = role !== undefined ? role : existant.role
    const fonctionFinale =
      roleFinal !== 'ASSISTANT_DISTRICT' ? null : fonction !== undefined ? fonction?.trim() || null : undefined

    // brancheType et fonction sont mutuellement exclusifs : si un texte de
    // fonction a été fourni à la place, la branche est effacée même si un
    // brancheType est aussi présent dans le corps de la requête.
    const fonctionTexteFourni = fonction !== undefined && !!fonction?.trim()
    const brancheFinale =
      roleFinal !== 'ASSISTANT_DISTRICT' || fonctionTexteFourni
        ? null
        : brancheType !== undefined
          ? (brancheType as BrancheType | null)
          : undefined

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom } : {}),
        ...(prenom !== undefined ? { prenom } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(role !== undefined ? { role: role as RoleUtilisateur } : {}),
        ...(actif !== undefined ? { actif } : {}),
        ...(fonctionFinale !== undefined ? { fonction: fonctionFinale } : {}),
        ...(brancheFinale !== undefined ? { brancheType: brancheFinale } : {}),
      },
      select: {
        id: true, nom: true, prenom: true, matricule: true, telephone: true,
        email: true, role: true, fonction: true, brancheType: true, actif: true, paroisseId: true,
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
    logger.error('PUT /api/district/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId, role: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] } },
      select: { id: true },
    })
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data: { actif: false },
      select: {
        id: true, nom: true, prenom: true, matricule: true, telephone: true,
        email: true, role: true, fonction: true, actif: true, paroisseId: true,
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
    logger.error('DELETE /api/district/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
