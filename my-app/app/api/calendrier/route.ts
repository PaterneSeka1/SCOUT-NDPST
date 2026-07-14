import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { logger } from '@/lib/logger'
import { paroisseIdRequise } from '@/lib/session'

// GET — événements (activités + réunions) du mois demandé, pour la vue calendrier du dashboard.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }
    const paroisseId = paroisseIdRequise(session)

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
      filtreBranche = await getBrancheUtilisateur(session.user.id, paroisseId)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!filtreBranche) return NextResponse.json({ evenements: [] })
    }

    const condBranche = filtreBranche ? { OR: [{ brancheType: filtreBranche as never }, { brancheType: null }] } : {}

    const [activites, reunions] = await Promise.all([
      prisma.activite.findMany({
        where: {
          paroisseId,
          dateDebut: { gte: debutMois, lt: finMois },
          ...condBranche,
        },
        select: { id: true, titre: true, description: true, dateDebut: true, dateFin: true, lieu: true, type: true, brancheType: true },
        orderBy: { dateDebut: 'asc' },
      }),
      prisma.jourReunion.findMany({
        where: {
          paroisseId,
          // Une réunion apparaît à sa date effective (dateReportee si reportée,
          // sinon dateHeure), pas à sa date d'origine — sinon une réunion
          // reportée hors du mois consulté resterait affichée à son ancienne date.
          AND: [
            { OR: [{ dateReportee: null, dateHeure: { gte: debutMois, lt: finMois } }, { dateReportee: { gte: debutMois, lt: finMois } }] },
            condBranche,
          ],
          // Une réunion annulée n'a plus lieu : elle ne doit pas apparaître
          // comme un événement à venir/passé dans le calendrier.
          statut: { not: 'ANNULEE' },
        },
        select: { id: true, titre: true, dateHeure: true, dateReportee: true, dureeMinutes: true, lieu: true, statut: true, brancheType: true, notes: true },
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
      ...reunions.map((r) => {
        const debut = r.dateReportee ?? r.dateHeure
        return {
          id: r.id,
          source: 'reunion' as const,
          titre: r.titre ?? 'Réunion',
          description: r.notes,
          debut,
          fin: r.dureeMinutes ? new Date(debut.getTime() + r.dureeMinutes * 60000) : null,
          lieu: r.lieu,
          brancheType: r.brancheType,
          meta: r.statut,
        }
      }),
    ].sort((a, b) => a.debut.getTime() - b.debut.getTime())

    return NextResponse.json({ evenements })
  } catch (error) {
    logger.error('GET /api/calendrier', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
