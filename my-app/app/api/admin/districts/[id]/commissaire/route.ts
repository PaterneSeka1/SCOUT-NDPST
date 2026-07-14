import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur } from '@/app/generated/prisma/client'
import { ROLES_PLATEFORME, ROLES_TOUT_STAFF } from '@/lib/roles'
import { enregistrerAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

// Désigne un Commissaire de District en affectant roleDistrict à un membre du
// staff (ROLES_TOUT_STAFF) déjà en poste et actif dans l'une des paroisses du
// district — jamais en créant un nouveau compte, et sans jamais toucher à son
// rôle paroissial (role) : il continue de l'exercer normalement.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id: districtId } = await params
    const district = await prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
    if (!district) return NextResponse.json({ erreur: 'District introuvable' }, { status: 404 })

    const body = await request.json()
    const { utilisateurId } = body as { utilisateurId?: string }
    if (!utilisateurId?.trim()) {
      return NextResponse.json({ erreur: 'Le membre à désigner est requis' }, { status: 400 })
    }

    const membre = await prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { id: true, role: true, roleDistrict: true, actif: true, paroisseId: true, paroisse: { select: { districtId: true } } },
    })
    if (!membre) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    if (!ROLES_TOUT_STAFF.includes(membre.role) || !membre.actif) {
      return NextResponse.json({ erreur: "Seul un membre actif du staff d'une paroisse peut être désigné Commissaire de District" }, { status: 400 })
    }
    if (membre.roleDistrict) {
      return NextResponse.json({ erreur: 'Cette personne fait déjà partie de l\'équipe du district' }, { status: 400 })
    }
    if (membre.paroisse?.districtId !== districtId) {
      return NextResponse.json({ erreur: "Cette personne n'appartient pas à une paroisse de ce district" }, { status: 400 })
    }

    const commissaireExistant = await prisma.utilisateur.findFirst({
      where: { roleDistrict: 'COMMISSAIRE_DISTRICT', actif: true, paroisse: { districtId } },
      select: { id: true },
    })
    if (commissaireExistant) {
      return NextResponse.json(
        { erreur: 'Un Commissaire de District actif existe déjà pour ce district. Retirez-le de l\'équipe avant d\'en désigner un nouveau.' },
        { status: 409 },
      )
    }

    // Ne touche jamais à `role` (rôle paroissial) : la personne continue de
    // l'exercer normalement dans sa paroisse, l'affectation district s'ajoute
    // simplement à son compte existant.
    const commissaire = await prisma.utilisateur.update({
      where: { id: membre.id },
      data: { roleDistrict: 'COMMISSAIRE_DISTRICT' as RoleUtilisateur },
      select: {
        id: true, nom: true, prenom: true, matricule: true, telephone: true, email: true, actif: true, createdAt: true,
        role: true, roleDistrict: true, paroisseId: true,
      },
    })

    await enregistrerAudit({
      paroisseId: membre.paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_ROLE_DISTRICT_AFFECTE',
      entite: 'Utilisateur',
      entiteId: commissaire.id,
      details: { roleParoisse: commissaire.role, roleDistrict: commissaire.roleDistrict },
    })

    return NextResponse.json(
      {
        id: commissaire.id,
        nom: commissaire.nom,
        prenom: commissaire.prenom,
        matricule: commissaire.matricule,
        telephone: commissaire.telephone,
        email: commissaire.email,
        actif: commissaire.actif,
        createdAt: commissaire.createdAt,
        paroisseId: commissaire.paroisseId,
        roleParoisse: commissaire.role,
      },
      { status: 200 },
    )
  } catch (error) {
    logger.error('POST /api/admin/districts/[id]/commissaire', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
