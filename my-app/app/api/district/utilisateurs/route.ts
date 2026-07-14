import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import { ROLES_DISTRICT as ROLES_AUTORISES, ROLES_ASSIGNABLES_DISTRICT, ROLES_TOUT_STAFF } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'
import { getParoissesDuDistrict, DistrictInvalideError } from '@/lib/district'
import { BrancheTypeSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    if (!session.user.roleDistrict || !ROLES_AUTORISES.includes(session.user.roleDistrict)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limite = Math.max(1, parseInt(searchParams.get('limite') ?? '20', 10))
    const rolesParam = searchParams.get('role')
    const roles = (rolesParam ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter((r) => ROLES_ASSIGNABLES_DISTRICT.includes(r))
    const recherche = searchParams.get('recherche') ?? undefined

    const paroisseId = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseId)
    const paroisseIds = paroisses.map((p) => p.id)

    // Scopé par les paroisses DU DISTRICT (pas seulement celle d'ancrage du
    // Commissaire) ET roleDistrict dans ROLES_ASSIGNABLES_DISTRICT — roleDistrict
    // est une affectation ADDITIVE au rôle paroissial (role) de la personne,
    // jamais un remplacement (voir prisma/schema.prisma).
    const where: Prisma.UtilisateurWhereInput = {
      paroisseId: { in: paroisseIds },
      roleDistrict: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] },
      ...(roles.length === 1 ? { roleDistrict: roles[0] as RoleUtilisateur } : {}),
      ...(roles.length > 1 ? { roleDistrict: { in: roles as RoleUtilisateur[] } } : {}),
      ...(recherche
        ? {
            OR: [
              { nom: { contains: recherche, mode: 'insensitive' } },
              { prenom: { contains: recherche, mode: 'insensitive' } },
              { matricule: { contains: recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [utilisateurs, total] = await Promise.all([
      prisma.utilisateur.findMany({
        where,
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          telephone: true,
          email: true,
          role: true,
          roleDistrict: true,
          fonctionDistrict: true,
          brancheTypeDistrict: true,
          actif: true,
          paroisse: { select: { id: true, nom: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limite,
        take: limite,
      }),
      prisma.utilisateur.count({ where }),
    ])

    const totalPages = Math.ceil(total / limite)

    return NextResponse.json({
      utilisateurs: utilisateurs.map((u) => ({
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
      })),
      total,
      page,
      totalPages,
    })
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('GET /api/district/utilisateurs', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// Ajoute un membre à l'équipe du district en affectant roleDistrict à un
// membre du staff (ROLES_TOUT_STAFF) déjà en poste et actif dans l'une des
// paroisses du district — jamais en créant un nouveau compte, et sans jamais
// toucher à son rôle paroissial (role) : il continue de l'exercer normalement,
// l'affectation district s'ajoute simplement à son compte existant.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    if (!session.user.roleDistrict || !ROLES_AUTORISES.includes(session.user.roleDistrict)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { utilisateurId, role, fonction, brancheType } = body as {
      utilisateurId?: string
      role?: string
      fonction?: string | null
      brancheType?: string | null
    }

    if (!utilisateurId?.trim() || !role) {
      return NextResponse.json({ erreur: 'Le membre à désigner et le rôle sont requis' }, { status: 400 })
    }

    // Seuls ADJOINT_DISTRICT et ASSISTANT_DISTRICT sont assignables par le
    // Commissaire de District à sa propre équipe — ni son propre rôle, ni
    // aucun rôle paroissial ou plateforme.
    if (!ROLES_ASSIGNABLES_DISTRICT.includes(role)) {
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })
    }

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    const paroisseId = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseId)
    const paroisseIds = paroisses.map((p) => p.id)

    const membre = await prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { id: true, role: true, roleDistrict: true, actif: true, paroisseId: true },
    })
    if (!membre) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    if (!ROLES_TOUT_STAFF.includes(membre.role) || !membre.actif) {
      return NextResponse.json({ erreur: "Seul un membre actif du staff d'une paroisse peut rejoindre l'équipe du district" }, { status: 400 })
    }
    if (membre.roleDistrict) {
      return NextResponse.json({ erreur: 'Cette personne fait déjà partie de l\'équipe du district' }, { status: 400 })
    }
    if (!membre.paroisseId || !paroisseIds.includes(membre.paroisseId)) {
      return NextResponse.json({ erreur: "Cette personne n'appartient pas à une paroisse de ce district" }, { status: 400 })
    }

    // brancheType (chargé d'une branche) et fonction (texte libre) sont
    // mutuellement exclusifs et n'ont de sens que pour ASSISTANT_DISTRICT —
    // ignorés/forcés à null pour ADJOINT_DISTRICT.
    const brancheTypeValeur = role === 'ASSISTANT_DISTRICT' && brancheType ? (brancheType as BrancheType) : null
    const fonctionValeur =
      role === 'ASSISTANT_DISTRICT' && !brancheTypeValeur ? (fonction?.trim() || null) : null

    const utilisateur = await prisma.utilisateur.update({
      where: { id: membre.id },
      data: {
        roleDistrict: role as RoleUtilisateur,
        fonctionDistrict: fonctionValeur,
        brancheTypeDistrict: brancheTypeValeur,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        roleDistrict: true,
        fonctionDistrict: true,
        brancheTypeDistrict: true,
        actif: true,
        paroisse: { select: { id: true, nom: true } },
        createdAt: true,
      },
    })

    await enregistrerAudit({
      paroisseId: membre.paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_ROLE_DISTRICT_AFFECTE',
      entite: 'Utilisateur',
      entiteId: utilisateur.id,
      details: { roleParoisse: utilisateur.role, roleDistrict: utilisateur.roleDistrict, fonctionDistrict: utilisateur.fonctionDistrict },
    })

    return NextResponse.json(
      {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        matricule: utilisateur.matricule,
        telephone: utilisateur.telephone,
        email: utilisateur.email,
        role: utilisateur.roleDistrict,
        fonction: utilisateur.fonctionDistrict,
        brancheType: utilisateur.brancheTypeDistrict,
        roleParoisse: utilisateur.role,
        paroisse: utilisateur.paroisse,
        actif: utilisateur.actif,
        createdAt: utilisateur.createdAt,
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('POST /api/district/utilisateurs', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
