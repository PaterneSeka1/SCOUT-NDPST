import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import { ROLES_DISTRICT as ROLES_AUTORISES, ROLES_ASSIGNABLES_DISTRICT } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'
import { getParoissesDuDistrict, DistrictInvalideError } from '@/lib/district'
import { BrancheTypeSchema } from '@/lib/validation'

type RouteParams = { params: Promise<{ id: string }> }

function versReponse(u: {
  id: string; nom: string; prenom: string; matricule: string | null; telephone: string | null
  email: string | null; role: string; roleDistrict: string | null; fonctionDistrict: string | null
  brancheTypeDistrict: string | null; actif: boolean; paroisse: { id: string; nom: string } | null
  createdAt: Date; updatedAt: Date
}) {
  return {
    id: u.id,
    nom: u.nom,
    prenom: u.prenom,
    matricule: u.matricule,
    telephone: u.telephone,
    email: u.email,
    role: u.roleDistrict,
    fonction: u.fonctionDistrict,
    brancheType: u.brancheTypeDistrict,
    roleParoisse: u.role,
    paroisse: u.paroisse,
    actif: u.actif,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }
}

const SELECT_MEMBRE = {
  id: true, nom: true, prenom: true, matricule: true, telephone: true,
  email: true, role: true, roleDistrict: true, fonctionDistrict: true, brancheTypeDistrict: true,
  actif: true, paroisse: { select: { id: true, nom: true } },
  createdAt: true, updatedAt: true,
} as const

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!session.user.roleDistrict || !ROLES_AUTORISES.includes(session.user.roleDistrict)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseId)
    const paroisseIds = paroisses.map((p) => p.id)
    const { id } = await params

    // Scopé sur toutes les paroisses du district (pas seulement celle
    // d'ancrage du Commissaire) : un Adjoint/Assistant conserve sa paroisse
    // d'origine, qui peut différer de celle du Commissaire.
    const utilisateur = await prisma.utilisateur.findFirst({
      where: { id, paroisseId: { in: paroisseIds }, roleDistrict: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] } },
      select: SELECT_MEMBRE,
    })

    if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    return NextResponse.json(versReponse(utilisateur))
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('GET /api/district/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// Modifie l'affectation district (rôle/fonction/branche) d'un membre déjà
// affecté — n'a jamais d'effet sur son rôle paroissial (role), géré ailleurs
// (voir /dashboard/utilisateurs, par le Chef de Groupe de sa propre paroisse).
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!session.user.roleDistrict || !ROLES_AUTORISES.includes(session.user.roleDistrict)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseId)
    const paroisseIds = paroisses.map((p) => p.id)
    const { id } = await params

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId: { in: paroisseIds }, roleDistrict: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] } },
      select: { id: true, roleDistrict: true, actif: true, fonctionDistrict: true, paroisseId: true },
    })
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const body = await request.json()
    const { role, fonction, brancheType } = body as {
      role?: string; fonction?: string | null; brancheType?: string | null
    }

    if (role !== undefined && !ROLES_ASSIGNABLES_DISTRICT.includes(role))
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success)
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })

    // fonction n'a de sens que pour ASSISTANT_DISTRICT : si le rôle final
    // (après cette modification) n'est pas ASSISTANT_DISTRICT, on la force à
    // null même si elle n'a pas été envoyée — un ADJOINT_DISTRICT ne doit
    // jamais conserver une fonction héritée d'un rôle précédent.
    const roleFinal = role !== undefined ? role : existant.roleDistrict
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
        ...(role !== undefined ? { roleDistrict: role as RoleUtilisateur } : {}),
        ...(fonctionFinale !== undefined ? { fonctionDistrict: fonctionFinale } : {}),
        ...(brancheFinale !== undefined ? { brancheTypeDistrict: brancheFinale } : {}),
      },
      select: SELECT_MEMBRE,
    })

    if (role !== undefined && role !== existant.roleDistrict) {
      await enregistrerAudit({
        paroisseId: existant.paroisseId,
        acteurId: session.user.id,
        action: 'UTILISATEUR_ROLE_DISTRICT_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { ancienRoleDistrict: existant.roleDistrict, nouveauRoleDistrict: role },
      })
    }

    return NextResponse.json(versReponse(utilisateur))
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('PUT /api/district/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// Retire un membre de l'équipe du district : efface uniquement l'affectation
// district (roleDistrict/fonctionDistrict/brancheTypeDistrict), sans jamais
// désactiver le compte — la personne continue de travailler normalement dans
// sa paroisse via son rôle paroissial (role), inchangé.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!session.user.roleDistrict || !ROLES_AUTORISES.includes(session.user.roleDistrict)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseId)
    const paroisseIds = paroisses.map((p) => p.id)
    const { id } = await params

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId: { in: paroisseIds }, roleDistrict: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] } },
      select: { id: true, paroisseId: true },
    })
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data: { roleDistrict: null, fonctionDistrict: null, brancheTypeDistrict: null },
      select: SELECT_MEMBRE,
    })

    await enregistrerAudit({
      paroisseId: existant.paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_ROLE_DISTRICT_RETIRE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return NextResponse.json(versReponse(utilisateur))
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('DELETE /api/district/utilisateurs/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
