import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { logger } from '@/lib/logger'
import { recalculerStatutsProgressionsCompagnon } from '@/lib/parcoursCompagnonService'

function secretsCorrespondent(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

// GET — recalcule les statuts temporels (A_VENIR/EN_COURS/EN_RETARD) de toute
// activité de progression Compagnons pas encore soumise/validée/rejetée/annulée,
// et journalise une alerte de retard (au plus une fois par 24h, voir
// dejaAlerteRecemment). Même patron que /api/cron/rappels-documents : endpoint
// destiné à un déclencheur externe (cron du serveur), authentifié par secret
// partagé plutôt que par session. Cadence recommandée : quotidienne.
export async function GET(req: NextRequest) {
  try {
    const secretAttendu = process.env.CRON_SECRET
    if (!secretAttendu) {
      return NextResponse.json({ erreur: 'CRON_SECRET non configuré côté serveur' }, { status: 500 })
    }
    const secretRecu = req.headers.get('x-cron-secret')
    if (!secretRecu || !secretsCorrespondent(secretRecu, secretAttendu)) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const resultat = await recalculerStatutsProgressionsCompagnon()
    return NextResponse.json(resultat)
  } catch (error) {
    logger.error('GET /api/cron/recalcul-progressions-compagnons', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
