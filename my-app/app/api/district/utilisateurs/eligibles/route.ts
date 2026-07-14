import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur } from '@/app/generated/prisma/client'
import { ROLES_DISTRICT as ROLES_AUTORISES, ROLES_TOUT_STAFF } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { paroisseIdRequise } from '@/lib/session'
import { getParoissesDuDistrict, DistrictInvalideError } from '@/lib/district'

// Pool des personnes que le Commissaire de District peut ajouter à son équipe
// (voir POST /api/district/utilisateurs) : tout le staff (ROLES_TOUT_STAFF)
// actif d'une des paroisses du district, pas déjà affecté au district.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!session.user.roleDistrict || !ROLES_AUTORISES.includes(session.user.roleDistrict)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const paroisseId = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseId)
    const paroisseIds = paroisses.map((p) => p.id)

    const personnel = await prisma.utilisateur.findMany({
      where: {
        role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] },
        actif: true,
        roleDistrict: null,
        paroisseId: { in: paroisseIds },
      },
      select: { id: true, nom: true, prenom: true, matricule: true, role: true, paroisse: { select: { id: true, nom: true } } },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    return NextResponse.json({ personnel })
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('GET /api/district/utilisateurs/eligibles', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
