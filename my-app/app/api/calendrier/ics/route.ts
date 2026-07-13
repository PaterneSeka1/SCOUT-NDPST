import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genererICS } from '@/lib/calendrier'
import { limiterTaux } from '@/lib/rateLimit'
import { ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { logger } from '@/lib/logger'
import { paroisseIdRequise } from '@/lib/session'

const FENETRE_PASSEE_JOURS = 30
const FENETRE_FUTURE_JOURS = 180

// GET — flux iCal public authentifié par jeton (utilisable dans Google Calendar,
// Apple Calendar, Outlook…). Pas de session cookie : les applications calendrier
// externes ne peuvent pas s'authentifier de façon interactive. Le jeton (256 bits,
// généré via crypto.randomBytes) tient lieu de secret.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ erreur: 'Jeton manquant' }, { status: 400 })

    const forwardedFor = req.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0]?.trim() ?? 'ip-inconnue'
    const limite = limiterTaux(`calendrier-ics:ip:${ip}`, 30, 15 * 60 * 1000)
    if (!limite.autorise) {
      return NextResponse.json({ erreur: 'Trop de requêtes' }, { status: 429 })
    }

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { tokenCalendrier: token },
      select: { id: true, prenom: true, nom: true, role: true, actif: true, paroisseId: true },
    })
    if (!utilisateur || !utilisateur.actif) {
      return NextResponse.json({ erreur: 'Jeton invalide' }, { status: 404 })
    }
    const paroisseId = paroisseIdRequise({ user: utilisateur })

    let filtreBranche: string | null = null
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      filtreBranche = await getBrancheUtilisateur(utilisateur.id, paroisseId)
      // Compte mal configuré (rôle de branche sans PosteBranche assigné) :
      // flux vide plutôt que toute la paroisse par défaut.
      if (!filtreBranche) {
        return new NextResponse(genererICS(`SCOUT ASCCI — ${utilisateur.prenom} ${utilisateur.nom}`, []), {
          status: 200,
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'inline; filename="scout-ascci.ics"',
            'Cache-Control': 'private, max-age=1800',
          },
        })
      }
    }

    const maintenant = new Date()
    const debut = new Date(maintenant.getTime() - FENETRE_PASSEE_JOURS * 86400000)
    const fin = new Date(maintenant.getTime() + FENETRE_FUTURE_JOURS * 86400000)

    const condBranche = filtreBranche ? { OR: [{ brancheType: filtreBranche as never }, { brancheType: null }] } : {}

    const [activites, reunions] = await Promise.all([
      prisma.activite.findMany({
        where: {
          paroisseId,
          dateDebut: { gte: debut, lt: fin },
          ...condBranche,
        },
        select: { id: true, titre: true, description: true, dateDebut: true, dateFin: true, lieu: true },
      }),
      prisma.jourReunion.findMany({
        where: {
          paroisseId,
          // Cf. /api/calendrier : une réunion apparaît à sa date effective
          // (dateReportee si reportée), et une réunion annulée est exclue du
          // flux — sinon elle continuerait de s'afficher comme un rendez-vous
          // à honorer dans Google/Apple/Outlook Calendar.
          AND: [
            { OR: [{ dateReportee: null, dateHeure: { gte: debut, lt: fin } }, { dateReportee: { gte: debut, lt: fin } }] },
            condBranche,
          ],
          statut: { not: 'ANNULEE' },
        },
        select: { id: true, titre: true, dateHeure: true, dateReportee: true, dureeMinutes: true, lieu: true, notes: true },
      }),
    ])

    const evenements = [
      ...activites.map((a) => ({
        uid: `activite-${a.id}`,
        debut: a.dateDebut,
        fin: a.dateFin,
        titre: a.titre,
        lieu: a.lieu,
        description: a.description,
      })),
      ...reunions.map((r) => {
        const debutEffectif = r.dateReportee ?? r.dateHeure
        return {
          uid: `reunion-${r.id}`,
          debut: debutEffectif,
          fin: r.dureeMinutes ? new Date(debutEffectif.getTime() + r.dureeMinutes * 60000) : null,
          titre: r.titre ?? 'Réunion',
          lieu: r.lieu,
          description: r.notes,
        }
      }),
    ]

    const ics = genererICS(`SCOUT ASCCI — ${utilisateur.prenom} ${utilisateur.nom}`, evenements)

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="scout-ascci.ics"',
        'Cache-Control': 'private, max-age=1800',
      },
    })
  } catch (error) {
    logger.error('GET /api/calendrier/ics', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
