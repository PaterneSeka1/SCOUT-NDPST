import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import {
  ROLES_PLATEFORME,
  ROLES_ASSIGNABLES_PAROISSE_SANS_CHEF,
  ROLES_BRANCHE,
  ROLES_TOUT_STAFF,
  ROLES_DISTRICT_ETENDU,
} from '@/lib/roles'
import { BrancheTypeSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

const SELECT_UTILISATEUR = {
  id: true,
  nom: true,
  prenom: true,
  matricule: true,
  telephone: true,
  email: true,
  role: true,
  fonction: true,
  brancheType: true,
  roleDistrict: true,
  fonctionDistrict: true,
  brancheTypeDistrict: true,
  actif: true,
  createdAt: true,
  paroisse: { select: { id: true, nom: true, district: { select: { id: true, nom: true } } } },
} as const

function nullableTexte(valeur: unknown): string | null | undefined {
  if (valeur === undefined) return undefined
  if (valeur === null) return null
  if (typeof valeur !== 'string') return null
  return valeur.trim() || null
}

function nullableBranche(valeur: unknown): string | null | undefined {
  const texte = nullableTexte(valeur)
  if (texte && !BrancheTypeSchema.safeParse(texte).success) return '__INVALIDE__'
  return texte
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const existant = await prisma.utilisateur.findFirst({
      where: { id, role: { not: 'ADMIN_PLATEFORME' } },
      select: {
        id: true,
        role: true,
        fonction: true,
        brancheType: true,
        roleDistrict: true,
        fonctionDistrict: true,
        brancheTypeDistrict: true,
        actif: true,
        matricule: true,
        telephone: true,
        paroisseId: true,
        paroisse: { select: { districtId: true } },
      },
    })
    if (!existant) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const body = await request.json()
    const { role, roleDistrict } = body as { role?: unknown; roleDistrict?: unknown }
    const brancheTypeParoisseCorps = (body as { brancheType?: unknown }).brancheType
    const brancheTypeDistrictCorps = (body as { brancheTypeDistrict?: unknown }).brancheTypeDistrict
    const fonctionDistrictCorps = (body as { fonctionDistrict?: unknown }).fonctionDistrict

    if (role !== undefined && typeof role !== 'string') {
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })
    }
    if (roleDistrict !== undefined && roleDistrict !== null && typeof roleDistrict !== 'string') {
      return NextResponse.json({ erreur: 'Rôle de district invalide' }, { status: 400 })
    }
    if (brancheTypeParoisseCorps !== undefined && brancheTypeParoisseCorps !== null && typeof brancheTypeParoisseCorps !== 'string') {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }
    if (brancheTypeDistrictCorps !== undefined && brancheTypeDistrictCorps !== null && typeof brancheTypeDistrictCorps !== 'string') {
      return NextResponse.json({ erreur: 'Branche de district invalide' }, { status: 400 })
    }
    if (fonctionDistrictCorps !== undefined && fonctionDistrictCorps !== null && typeof fonctionDistrictCorps !== 'string') {
      return NextResponse.json({ erreur: 'Fonction de district invalide' }, { status: 400 })
    }
    // Promouvoir vers CHEF_GROUPE est exclu ici SAUF si le rôle ne change pas :
    // cette nomination passe par le flux dédié
    // /api/admin/paroisses/[id]/chef-groupe/designer, qui gère l'unicité du
    // chef actif par paroisse de façon atomique (contrainte SQL, voir
    // prisma/schema.prisma) — une promotion via cette route provoquerait une
    // erreur de contrainte brute s'il existe déjà un chef actif.
    if (role !== undefined && role !== existant.role && !ROLES_ASSIGNABLES_PAROISSE_SANS_CHEF.includes(role)) {
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })
    }

    const roleFinal = role !== undefined ? role : existant.role
    const estRoleBranche = ROLES_BRANCHE.includes(roleFinal)
    const brancheParoisseDemandee = nullableBranche(brancheTypeParoisseCorps)
    if (brancheParoisseDemandee === '__INVALIDE__') {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    const brancheParoisseFinale = estRoleBranche
      ? (brancheParoisseDemandee !== undefined ? brancheParoisseDemandee : existant.brancheType)
      : null
    if (estRoleBranche && !brancheParoisseFinale) {
      return NextResponse.json({ erreur: 'La branche est requise pour ce rôle' }, { status: 400 })
    }

    if (roleFinal === 'PARENT' && !existant.telephone?.trim()) {
      return NextResponse.json({ erreur: 'Un parent doit avoir un numéro de téléphone avant cette nomination' }, { status: 400 })
    }
    if (roleFinal !== 'PARENT' && !existant.matricule?.trim()) {
      return NextResponse.json({ erreur: 'Un matricule est requis avant de nommer cette personne à ce rôle' }, { status: 400 })
    }

    const roleDistrictNormalise = nullableTexte(roleDistrict)
    if (roleDistrictNormalise && !ROLES_DISTRICT_ETENDU.includes(roleDistrictNormalise)) {
      return NextResponse.json({ erreur: 'Rôle de district invalide' }, { status: 400 })
    }
    const roleDistrictFinal = roleDistrict !== undefined ? roleDistrictNormalise : existant.roleDistrict

    const brancheDistrictDemandee = nullableBranche(brancheTypeDistrictCorps)
    if (brancheDistrictDemandee === '__INVALIDE__') {
      return NextResponse.json({ erreur: 'Branche de district invalide' }, { status: 400 })
    }
    const fonctionDistrictDemandee = nullableTexte(fonctionDistrictCorps)

    if (roleDistrictFinal) {
      if (!existant.actif) {
        return NextResponse.json({ erreur: 'Le compte doit être actif pour recevoir une affectation district' }, { status: 400 })
      }
      if (!ROLES_TOUT_STAFF.includes(roleFinal)) {
        return NextResponse.json({ erreur: 'Seul un membre du staff peut recevoir une affectation district' }, { status: 400 })
      }
      if (!existant.paroisseId || !existant.paroisse?.districtId) {
        return NextResponse.json({ erreur: 'La personne doit être rattachée à une paroisse avec district' }, { status: 400 })
      }
    }

    const brancheDistrictFinale =
      roleDistrictFinal === 'ASSISTANT_DISTRICT'
        ? brancheDistrictDemandee !== undefined
          ? brancheDistrictDemandee
          : existant.brancheTypeDistrict
        : null
    const fonctionDistrictFinale =
      roleDistrictFinal === 'ASSISTANT_DISTRICT' && !brancheDistrictFinale
        ? fonctionDistrictDemandee !== undefined
          ? fonctionDistrictDemandee
          : existant.fonctionDistrict
        : null

    let commissairesRemplaces: string[] = []
    const utilisateur = await prisma.$transaction(async (tx) => {
      if (roleDistrictFinal === 'COMMISSAIRE_DISTRICT' && existant.paroisse?.districtId) {
        const commissairesExistants = await tx.utilisateur.findMany({
          where: {
            roleDistrict: 'COMMISSAIRE_DISTRICT',
            paroisse: { districtId: existant.paroisse.districtId },
            NOT: { id },
          },
          select: { id: true },
        })
        commissairesRemplaces = commissairesExistants.map((u) => u.id)
        if (commissairesRemplaces.length > 0) {
          await tx.utilisateur.updateMany({
            where: { id: { in: commissairesRemplaces } },
            data: { roleDistrict: null, fonctionDistrict: null, brancheTypeDistrict: null },
          })
        }
      }

      return tx.utilisateur.update({
        where: { id },
        data: {
          role: roleFinal as RoleUtilisateur,
          brancheType: brancheParoisseFinale as BrancheType | null,
          roleDistrict: roleDistrictFinal as RoleUtilisateur | null,
          fonctionDistrict: fonctionDistrictFinale,
          brancheTypeDistrict: brancheDistrictFinale as BrancheType | null,
        },
        select: SELECT_UTILISATEUR,
      })
    })

    if (roleFinal !== existant.role) {
      await enregistrerAudit({
        paroisseId: existant.paroisseId,
        acteurId: session.user.id,
        action: 'UTILISATEUR_ROLE_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { ancienRole: existant.role, nouveauRole: roleFinal },
      })
    }

    const affectationDistrictChangee =
      roleDistrictFinal !== existant.roleDistrict ||
      fonctionDistrictFinale !== existant.fonctionDistrict ||
      brancheDistrictFinale !== existant.brancheTypeDistrict

    if (affectationDistrictChangee) {
      await enregistrerAudit({
        paroisseId: existant.paroisseId,
        acteurId: session.user.id,
        action: roleDistrictFinal
          ? existant.roleDistrict
            ? 'UTILISATEUR_ROLE_DISTRICT_MODIFIE'
            : 'UTILISATEUR_ROLE_DISTRICT_AFFECTE'
          : 'UTILISATEUR_ROLE_DISTRICT_RETIRE',
        entite: 'Utilisateur',
        entiteId: id,
        details: {
          ancienRoleDistrict: existant.roleDistrict,
          nouveauRoleDistrict: roleDistrictFinal,
          fonctionDistrict: fonctionDistrictFinale,
          brancheTypeDistrict: brancheDistrictFinale,
          commissairesRemplaces,
        },
      })
    }

    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('PUT /api/admin/utilisateurs/[id]/nominations', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
