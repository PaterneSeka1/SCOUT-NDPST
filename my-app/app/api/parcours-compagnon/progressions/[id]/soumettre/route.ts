import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { autoriseDeclarationParcoursCompagnon } from '@/lib/parcoursCompagnonPermissions'
import { chargerProgressionAvecScout } from '@/lib/parcoursCompagnonService'

type RouteParams = { params: Promise<{ id: string }> }

const STATUTS_NON_SOUMISSIBLES = ['SOUMISE', 'VALIDEE', 'ANNULEE']

// POST — déclare une activité comme réalisée et la soumet à validation. Gère
// aussi bien la première soumission que la resoumission après rejet (le
// rejet précédent reste tracé dans JournalAudit, jamais supprimé).
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params
    const progression = await chargerProgressionAvecScout(id)

    if (!progression || !(await autoriseDeclarationParcoursCompagnon(session, progression.parcours.scout))) {
      return NextResponse.json({ erreur: 'Activité de progression introuvable' }, { status: 404 })
    }

    if (STATUTS_NON_SOUMISSIBLES.includes(progression.statut)) {
      return NextResponse.json(
        { erreur: 'Cette activité ne peut pas être soumise dans son état actuel' },
        { status: 409 },
      )
    }

    const body = await request.json()
    const { dateRealisationDeclaree, commentaire, preuveUrl } = body as {
      dateRealisationDeclaree?: string
      commentaire?: string
      preuveUrl?: string
    }

    if (!dateRealisationDeclaree || Number.isNaN(Date.parse(dateRealisationDeclaree))) {
      return NextResponse.json(
        { erreur: 'dateRealisationDeclaree est requise et doit être une date valide' },
        { status: 400 },
      )
    }

    const dateDeclaree = new Date(dateRealisationDeclaree)
    if (dateDeclaree > new Date()) {
      return NextResponse.json({ erreur: 'La date de réalisation ne peut pas être dans le futur' }, { status: 400 })
    }

    const estResoumission = progression.statut === 'REJETEE'

    const progressionMiseAJour = await prisma.progressionCompagnon.update({
      where: { id: progression.id },
      data: {
        statut: 'SOUMISE',
        dateRealisationDeclaree: dateDeclaree,
        commentaireDeclaration: commentaire?.trim() || null,
        preuveUrl: preuveUrl?.trim() || null,
        numeroSoumission: { increment: 1 },
        soumisLe: new Date(),
        soumisParId: session.user.id,
        // Champs actifs du cycle de rejet précédent : n'ont plus cours une fois
        // resoumis, l'historique complet reste dans JournalAudit.
        motifRejet: null,
        rejeteLe: null,
        rejeteParId: null,
      },
    })

    await enregistrerAudit({
      paroisseId: progression.parcours.scout.paroisseId,
      acteurId: session.user.id,
      action: estResoumission ? 'PROGRESSION_COMPAGNON_RESOUMISE' : 'PROGRESSION_COMPAGNON_SOUMISE',
      entite: 'ProgressionCompagnon',
      entiteId: progression.id,
      details: { numeroSoumission: progressionMiseAJour.numeroSoumission, etapeActiviteId: progression.etapeActiviteId },
    })

    return NextResponse.json(progressionMiseAJour)
  } catch (error) {
    logger.error('POST /api/parcours-compagnon/progressions/[id]/soumettre', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
