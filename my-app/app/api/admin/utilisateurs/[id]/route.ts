import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import { ROLES_PLATEFORME, ROLES_ASSIGNABLES_PAROISSE, ROLES_BRANCHE } from '@/lib/roles'
import { BrancheTypeSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

// Une cible ADMIN_PLATEFORME n'existe jamais pour cette surface : un admin
// plateforme ne gère pas d'autres admins plateforme via /api/admin/utilisateurs.
// On la traite comme "introuvable" (404) plutôt que de révéler son existence.
async function trouverCible(id: string) {
  return prisma.utilisateur.findFirst({
    where: { id, role: { not: 'ADMIN_PLATEFORME' } },
    select: { id: true, role: true, actif: true, fonction: true, brancheType: true },
  })
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const utilisateur = await prisma.utilisateur.findFirst({
      where: { id, role: { not: 'ADMIN_PLATEFORME' } },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        fonction: true,
        brancheType: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
        paroisse: { select: { id: true, nom: true } },
      },
    })

    if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })
    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('GET /api/admin/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const existant = await trouverCible(id)
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const body = await request.json()
    const { nom, prenom, email, role, actif, fonction, brancheType } = body as {
      nom?: string
      prenom?: string
      email?: string
      role?: string
      actif?: boolean
      fonction?: string | null
      brancheType?: string | null
    }

    // Pas de réaffectation de paroisse dans cette itération : seuls nom, prenom,
    // email, role, actif, fonction et brancheType sont modifiables via cette route.
    // `role` est toujours un rôle PAROISSIAL, jamais une valeur de district —
    // ROLES_ASSIGNABLES_PAROISSE les exclut (voir lib/roles.ts) : une affectation
    // district (roleDistrict) se gère exclusivement via /admin/districts/[id]/commissaire
    // ou /district/utilisateurs.
    if (role !== undefined && !ROLES_ASSIGNABLES_PAROISSE.includes(role)) {
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })
    }
    if (nom !== undefined && (typeof nom !== 'string' || !nom.trim())) {
      return NextResponse.json({ erreur: 'Le nom est invalide' }, { status: 400 })
    }
    if (prenom !== undefined && (typeof prenom !== 'string' || !prenom.trim())) {
      return NextResponse.json({ erreur: 'Le prénom est invalide' }, { status: 400 })
    }
    if (email !== undefined && email !== null && typeof email !== 'string') {
      return NextResponse.json({ erreur: 'L’adresse e-mail est invalide' }, { status: 400 })
    }

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    // brancheType/fonction recalculés sur le RÔLE FINAL (nouveau si fourni,
    // sinon existant) — un utilisateur qui change de rôle ne doit jamais
    // conserver une branche héritée d'un rôle précédent.
    const roleFinal = role !== undefined ? role : existant.role
    const estBrancheFinal = ROLES_BRANCHE.includes(roleFinal)
    if (estBrancheFinal && brancheType === undefined && !existant.brancheType) {
      return NextResponse.json({ erreur: 'La branche est requise pour ce rôle' }, { status: 400 })
    }
    if (estBrancheFinal && brancheType === null) {
      return NextResponse.json({ erreur: 'La branche est requise pour ce rôle' }, { status: 400 })
    }
    const brancheTypeFinal = estBrancheFinal
      ? ((brancheType !== undefined ? brancheType : existant.brancheType) as BrancheType)
      : null
    const fonctionFinal = fonction !== undefined ? fonction?.trim() || null : existant.fonction
    const emailNettoye = email?.trim() ?? ''

    if (email !== undefined && emailNettoye) {
      const doublon = await prisma.utilisateur.findFirst({
        where: { email: { equals: emailNettoye, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      })
      if (doublon) return NextResponse.json({ erreur: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
    }

    const { paroisseId: paroisseIdCible, ...utilisateur } = await prisma.utilisateur.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom: nom.trim() } : {}),
        ...(prenom !== undefined ? { prenom: prenom.trim() } : {}),
        ...(email !== undefined ? { email: emailNettoye || null } : {}),
        ...(role !== undefined ? { role: role as RoleUtilisateur } : {}),
        ...(actif !== undefined ? { actif } : {}),
        fonction: fonctionFinal,
        brancheType: brancheTypeFinal,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        fonction: true,
        brancheType: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
        paroisseId: true,
        paroisse: { select: { id: true, nom: true } },
      },
    })

    if (role !== undefined && role !== existant.role) {
      await enregistrerAudit({
        paroisseId: paroisseIdCible,
        acteurId: session.user.id,
        action: 'UTILISATEUR_ROLE_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { ancienRole: existant.role, nouveauRole: role },
      })
    }
    if (actif !== undefined && actif !== existant.actif) {
      await enregistrerAudit({
        paroisseId: paroisseIdCible,
        acteurId: session.user.id,
        action: actif ? 'UTILISATEUR_REACTIVE' : 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }

    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('PUT /api/admin/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const existant = await trouverCible(id)
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const { paroisseId: paroisseIdCible, ...utilisateur } = await prisma.utilisateur.update({
      where: { id },
      data: { actif: false },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
        paroisseId: true,
        paroisse: { select: { id: true, nom: true } },
      },
    })

    await enregistrerAudit({
      paroisseId: paroisseIdCible,
      acteurId: session.user.id,
      action: 'UTILISATEUR_DESACTIVE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('DELETE /api/admin/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
