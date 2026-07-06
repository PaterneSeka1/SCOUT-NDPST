import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { logger } from '@/lib/logger'

async function getBrancheUtilisateur(userId: string, paroisseId: string) {
  const poste = await prisma.posteBranche.findFirst({
    where: { utilisateurId: userId, paroisseId },
    select: { brancheType: true },
    orderBy: { createdAt: 'asc' },
  })
  return poste?.brancheType ?? null
}

// GET — événements (activités + réunions) du mois demandé, pour la vue calendrier du dashboard.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const moisParam = searchParams.get('mois') // format "YYYY-MM"
    const reference = moisParam ? new Date(`${moisParam}-01T00:00:00.000Z`) : new Date()
    if (isNaN(reference.getTime())) {
      return NextResponse.json({ erreur: 'Paramètre mois invalide' }, { status: 400 })
    }

    const debutMois = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1))
    const finMois = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1))

    let filtreBranche: string | null = null
    if (ROLES_BRANCHE.includes(session.user.role)) {
      filtreBranche = await getBrancheUtilisateur(session.user.id, session.user.paroisseId)
    }

    const [activites, reunions] = await Promise.all([
      prisma.activite.findMany({
        where: {
          paroisseId: session.user.paroisseId,
          dateDebut: { gte: debutMois, lt: finMois },
          ...(filtreBranche ? { OR: [{ brancheType: filtreBranche as never }, { brancheType: null }] } : {}),
        },
        select: { id: true, titre: true, description: true, dateDebut: true, dateFin: true, lieu: true, type: true, brancheType: true },
        orderBy: { dateDebut: 'asc' },
      }),
      prisma.jourReunion.findMany({
        where: {
          paroisseId: session.user.paroisseId,
          dateHeure: { gte: debutMois, lt: finMois },
          ...(filtreBranche ? { OR: [{ brancheType: filtreBranche as never }, { brancheType: null }] } : {}),
        },
        select: { id: true, titre: true, dateHeure: true, dureeMinutes: true, lieu: true, statut: true, brancheType: true, notes: true },
        orderBy: { dateHeure: 'asc' },
      }),
    ])

    const evenements = [
      ...activites.map((a) => ({
        id: a.id,
        source: 'activite' as const,
        titre: a.titre,
        description: a.description,
        debut: a.dateDebut,
        fin: a.dateFin,
        lieu: a.lieu,
        brancheType: a.brancheType,
        meta: a.type,
      })),
      ...reunions.map((r) => ({
        id: r.id,
        source: 'reunion' as const,
        titre: r.titre ?? 'Réunion',
        description: r.notes,
        debut: r.dateHeure,
        fin: r.dureeMinutes ? new Date(r.dateHeure.getTime() + r.dureeMinutes * 60000) : null,
        lieu: r.lieu,
        brancheType: r.brancheType,
        meta: r.statut,
      })),
    ].sort((a, b) => a.debut.getTime() - b.debut.getTime())

    return NextResponse.json({ evenements })
  } catch (error) {
    logger.error('GET /api/calendrier', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
