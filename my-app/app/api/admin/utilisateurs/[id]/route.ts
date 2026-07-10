import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import { ROLES_PLATEFORME, ROLES_ASSIGNABLES_PAROISSE, ROLES_DISTRICT_ETENDU, ROLES_BRANCHE } from '@/lib/roles'
import { normaliserDistrict } from '@/lib/district'
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
    select: { id: true, role: true, actif: true, fonction: true, brancheType: true, paroisse: { select: { district: true } } },
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
    if (role !== undefined && !ROLES_ASSIGNABLES_PAROISSE.includes(role)) {
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })
    }

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    // brancheType/fonction recalculés sur le RÔLE FINAL (nouveau si fourni,
    // sinon existant) — un utilisateur qui change de rôle ne doit jamais
    // conserver une branche/fonction héritée d'un rôle précédent.
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
      : roleFinal === 'ASSISTANT_DISTRICT' && brancheType
        ? (brancheType as BrancheType)
        : null
    const fonctionFinal =
      roleFinal === 'ASSISTANT_DISTRICT' && !brancheTypeFinal
        ? (fonction !== undefined ? fonction?.trim() || null : existant.fonction)
        : null

    // Un rôle de district n'a de sens que si le périmètre du district (dérivé du
    // district de la paroisse d'ancrage, inchangée par cette route) est résoluble.
    if (role !== undefined && ROLES_DISTRICT_ETENDU.includes(role) && !normaliserDistrict(existant.paroisse?.district)) {
      return NextResponse.json(
        { erreur: "La paroisse d'ancrage de cet utilisateur n'a pas de district renseigné — renseignez-le avant d'y rattacher un rôle de district" },
        { status: 400 },
      )
    }

    if (email !== undefined && email !== null && email !== '') {
      const doublon = await prisma.utilisateur.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      })
      if (doublon) return NextResponse.json({ erreur: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
    }

    const { paroisseId: paroisseIdCible, ...utilisateur } = await prisma.utilisateur.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom } : {}),
        ...(prenom !== undefined ? { prenom } : {}),
        ...(email !== undefined ? { email } : {}),
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
