import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TypeAutorisationCamp } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF as ROLES_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { estCheminLocalValide } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { paroisseIdRequise } from '@/lib/session'

type RouteParams = { params: Promise<{ id: string }> }

async function peutAgirSurScout(
  role: string,
  userId: string,
  paroisseId: string,
  scoutId: string,
  scoutBranche: string,
): Promise<boolean> {
  if (ROLES_STAFF.includes(role)) {
    // Un responsable de branche ne peut agir que sur les scouts de sa propre branche.
    if (ROLES_BRANCHE.includes(role)) {
      const bt = await getBrancheUtilisateur(userId, paroisseId)
      return bt === scoutBranche
    }
    return true
  }
  // Le rôle n'est jamais la condition d'accès pour un lien de parenté : un
  // compte staff ou SCOUT (Ressources Adultes) par ailleurs parent d'un
  // scout de la paroisse (LienParentScout) peut agir sur les autorisations
  // de camp de cet enfant, au même titre qu'un compte PARENT dédié.
  const lien = await prisma.lienParentScout.findFirst({
    where: { parentId: userId, scoutId },
  })
  return !!lien
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    const paroisseId = paroisseIdRequise(session)

    const { id: activiteId } = await params

    const activite = await prisma.activite.findFirst({
      where: { id: activiteId, paroisseId },
    })
    if (!activite) return NextResponse.json({ erreur: 'Activité introuvable' }, { status: 404 })
    if (activite.type !== 'CAMP') {
      return NextResponse.json({ erreur: "Cette confirmation ne concerne que les activités de type Camp" }, { status: 400 })
    }

    const body = await request.json()
    const { scoutId, type, mode, documentUrl, documentNomFichier } = body as {
      scoutId?: string
      type?: string
      mode?: 'CONFIRMATION' | 'DOCUMENT'
      documentUrl?: string
      documentNomFichier?: string
    }

    if (!scoutId || !type || !(type in TypeAutorisationCamp)) {
      return NextResponse.json({ erreur: 'Scout et type sont requis' }, { status: 400 })
    }
    if (mode === 'DOCUMENT' && (!documentUrl?.trim() || !documentNomFichier?.trim())) {
      return NextResponse.json({ erreur: 'Le document est requis pour ce mode' }, { status: 400 })
    }
    if (mode === 'DOCUMENT' && !estCheminLocalValide(documentUrl?.trim())) {
      return NextResponse.json({ erreur: 'documentUrl doit être un chemin local (ex : /api/fichiers/…)' }, { status: 400 })
    }

    const scout = await prisma.scout.findFirst({
      where: { id: scoutId, paroisseId },
    })
    if (!scout) return NextResponse.json({ erreur: 'Scout introuvable' }, { status: 404 })

    if (!(await peutAgirSurScout(session.user.role, session.user.id, paroisseId, scoutId, scout.brancheType))) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const autorisation = await prisma.autorisationCamp.upsert({
      where: { activiteId_scoutId_type: { activiteId, scoutId, type: type as TypeAutorisationCamp } },
      create: {
        activiteId,
        scoutId,
        type: type as TypeAutorisationCamp,
        confirmeLe: new Date(),
        confirmeParId: session.user.id,
        documentUrl: mode === 'DOCUMENT' ? documentUrl!.trim() : null,
        documentNomFichier: mode === 'DOCUMENT' ? documentNomFichier!.trim() : null,
      },
      update: {
        confirmeLe: new Date(),
        confirmeParId: session.user.id,
        documentUrl: mode === 'DOCUMENT' ? documentUrl!.trim() : null,
        documentNomFichier: mode === 'DOCUMENT' ? documentNomFichier!.trim() : null,
      },
    })

    return NextResponse.json(autorisation, { status: 201 })
  } catch (error) {
    logger.error('POST /api/activites/[id]/autorisations', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    const paroisseId = paroisseIdRequise(session)

    const { id: activiteId } = await params

    const activite = await prisma.activite.findFirst({
      where: { id: activiteId, paroisseId },
    })
    if (!activite) return NextResponse.json({ erreur: 'Activité introuvable' }, { status: 404 })

    const body = await request.json()
    const { scoutId, type } = body as { scoutId?: string; type?: string }
    if (!scoutId || !type || !(type in TypeAutorisationCamp)) {
      return NextResponse.json({ erreur: 'Scout et type sont requis' }, { status: 400 })
    }

    const existante = await prisma.autorisationCamp.findFirst({
      where: { activiteId, scoutId, type: type as TypeAutorisationCamp },
      include: { scout: { select: { brancheType: true } } },
    })
    if (!existante) return NextResponse.json({ erreur: 'Autorisation introuvable' }, { status: 404 })

    // L'auteur d'origine peut toujours retirer sa propre confirmation (ex. un
    // parent qui se rend compte d'une erreur) ; sinon, même cloisonnement par
    // branche que pour la création (voir peutAgirSurScout ci-dessus).
    const estAuteur = existante.confirmeParId === session.user.id
    const autorise = estAuteur || (await peutAgirSurScout(session.user.role, session.user.id, paroisseId, scoutId, existante.scout.brancheType))
    if (!autorise) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    await prisma.autorisationCamp.delete({ where: { id: existante.id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('DELETE /api/activites/[id]/autorisations', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
