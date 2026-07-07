import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { BrancheType } from '@/app/generated/prisma/client'

// GET — documents déjà expirés ou arrivant à expiration dans les N prochains
// jours (30 par défaut), pour les scouts actifs de la paroisse. Un responsable
// de branche ne voit que les documents des scouts de sa propre branche.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const joursAvant = Math.max(0, parseInt(searchParams.get('joursAvant') ?? '30', 10))
    const seuil = new Date()
    seuil.setDate(seuil.getDate() + joursAvant)
    seuil.setHours(23, 59, 59, 999)

    let brancheType: string | null = null
    if (ROLES_BRANCHE.includes(session.user.role)) {
      brancheType = await getBrancheUtilisateur(session.user.id, session.user.paroisseId)
      // Compte mal configuré (rôle de branche sans PosteBranche assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!brancheType) return NextResponse.json({ documents: [] })
    }

    const documents = await prisma.document.findMany({
      where: {
        dateExpiration: { lte: seuil },
        scout: {
          paroisseId: session.user.paroisseId,
          actif: true,
          ...(brancheType ? { brancheType: brancheType as BrancheType } : {}),
        },
      },
      select: {
        id: true, type: true, nomFichier: true, dateExpiration: true, valide: true,
        scout: { select: { id: true, nom: true, prenom: true, matricule: true, brancheType: true } },
      },
      orderBy: { dateExpiration: 'asc' },
    })

    const aujourdhui = new Date()
    const resultat = documents.map((d) => ({
      ...d,
      expire: d.dateExpiration != null && d.dateExpiration < aujourdhui,
    }))

    return NextResponse.json({ documents: resultat })
  } catch (error) {
    logger.error('GET /api/documents/expirations', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
