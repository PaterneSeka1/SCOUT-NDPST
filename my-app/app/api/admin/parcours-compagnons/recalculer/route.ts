import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { recalculerStatutsProgressionsCompagnon } from '@/lib/parcoursCompagnonService'

// POST — déclenchement manuel du recalcul des statuts temporels, réservé à
// l'administrateur plateforme (ex : après un incident sur le cron externe).
// Utilise exactement la même logique que la route cron.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const resultat = await recalculerStatutsProgressionsCompagnon()
    return NextResponse.json(resultat)
  } catch (error) {
    logger.error('POST /api/admin/parcours-compagnons/recalculer', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
