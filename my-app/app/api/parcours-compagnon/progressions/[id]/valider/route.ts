import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { autoriseValidationParcoursCompagnon } from '@/lib/parcoursCompagnonPermissions'
import { chargerProgressionAvecScout } from '@/lib/parcoursCompagnonService'
import { calculerAvancement } from '@/lib/parcoursCompagnon'

type RouteParams = { params: Promise<{ id: string }> }

// POST — valide une activité soumise : crée l'attribut correspondant s'il y en
// a un, recalcule l'avancement du parcours, et le clôt automatiquement si
// toutes les activités obligatoires sont désormais validées.
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params
    const progression = await chargerProgressionAvecScout(id)

    if (!progression || !(await autoriseValidationParcoursCompagnon(session, progression.parcours.scout))) {
      return NextResponse.json({ erreur: 'Activité de progression introuvable' }, { status: 404 })
    }

    if (progression.statut !== 'SOUMISE') {
      return NextResponse.json({ erreur: 'Seule une activité soumise peut être validée' }, { status: 409 })
    }
    if (progression.soumisParId === session.user.id) {
      return NextResponse.json({ erreur: 'Vous ne pouvez pas valider votre propre soumission' }, { status: 403 })
    }

    const maintenant = new Date()

    const resultat = await prisma.$transaction(async (tx) => {
      const progressionValidee = await tx.progressionCompagnon.update({
        where: { id: progression.id },
        data: { statut: 'VALIDEE', valideLe: maintenant, valideParId: session.user.id },
      })

      if (progression.etapeActivite.nomAttribut) {
        await tx.attributCompagnon.upsert({
          where: {
            parcoursId_etapeActiviteId: {
              parcoursId: progression.parcoursId,
              etapeActiviteId: progression.etapeActiviteId,
            },
          },
          create: {
            parcoursId: progression.parcoursId,
            etapeActiviteId: progression.etapeActiviteId,
            nom: progression.etapeActivite.nomAttribut,
            obtenuLe: maintenant,
            obtenuParId: session.user.id,
          },
          update: {},
        })
      }

      const toutesLesProgressions = await tx.progressionCompagnon.findMany({
        where: { parcoursId: progression.parcoursId },
        include: { etapeActivite: { select: { id: true, nom: true, etape: true, obligatoire: true, ordre: true } } },
      })

      const avancement = calculerAvancement(
        toutesLesProgressions.map((p) => ({
          statut: p.statut,
          dateLimiteTheorique: p.dateLimiteTheorique,
          etapeActivite: p.etapeActivite,
        })),
      )

      let parcoursTermine = false
      if (avancement.totalActivitesObligatoires > 0 && avancement.activitesValidees === avancement.totalActivitesObligatoires) {
        const parcoursActuel = await tx.parcoursCompagnon.findUniqueOrThrow({ where: { id: progression.parcoursId } })
        if (parcoursActuel.statut !== 'TERMINE') {
          await tx.parcoursCompagnon.update({
            where: { id: progression.parcoursId },
            data: { statut: 'TERMINE', dateFinReelle: maintenant },
          })
          parcoursTermine = true
        }
      }

      return { progressionValidee, avancement, parcoursTermine }
    })

    await enregistrerAudit({
      paroisseId: progression.parcours.scout.paroisseId,
      acteurId: session.user.id,
      action: 'PROGRESSION_COMPAGNON_VALIDEE',
      entite: 'ProgressionCompagnon',
      entiteId: progression.id,
      details: { etapeActiviteId: progression.etapeActiviteId },
    })

    if (resultat.parcoursTermine) {
      await enregistrerAudit({
        paroisseId: progression.parcours.scout.paroisseId,
        acteurId: session.user.id,
        action: 'PARCOURS_COMPAGNON_TERMINE',
        entite: 'ParcoursCompagnon',
        entiteId: progression.parcoursId,
      })
    }

    return NextResponse.json(resultat)
  } catch (error) {
    logger.error('POST /api/parcours-compagnon/progressions/[id]/valider', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
