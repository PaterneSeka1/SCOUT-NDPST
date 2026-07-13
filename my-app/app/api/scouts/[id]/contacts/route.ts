import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { logger } from '@/lib/logger'
import { paroisseIdRequise } from '@/lib/session'
import type { BrancheType } from '@/app/generated/prisma/client'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const paroisseId = paroisseIdRequise(session)

    // Un responsable de branche ne peut gérer les contacts d'urgence que des
    // scouts de sa propre branche (contact d'urgence = donnée sensible d'un
    // mineur, même cloisonnement que la fiche du scout elle-même).
    let brancheRequise: string | undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
      brancheRequise = bt
    }

    const scout = await prisma.scout.findFirst({
      where: { id, paroisseId, ...(brancheRequise ? { brancheType: brancheRequise as BrancheType } : {}) },
      select: { id: true },
    })

    if (!scout) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { nom, prenom, telephone, relation, principal } = body as {
      nom?: string
      prenom?: string
      telephone?: string
      relation?: string
      principal?: boolean
    }

    if (!nom?.trim()) {
      return NextResponse.json({ error: 'Le nom du contact est requis' }, { status: 400 })
    }
    if (!telephone?.trim()) {
      return NextResponse.json({ error: 'Le téléphone du contact est requis' }, { status: 400 })
    }

    // Si le nouveau contact est principal, retirer le statut des autres
    if (principal) {
      await prisma.contactUrgence.updateMany({
        where: { scoutId: id, principal: true },
        data: { principal: false },
      })
    }

    const contact = await prisma.contactUrgence.create({
      data: {
        nom: nom.trim(),
        prenom: prenom?.trim() || null,
        telephone: telephone.trim(),
        relation: relation?.trim() || null,
        principal: principal ?? false,
        scoutId: id,
      },
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    logger.error('POST /api/scouts/[id]/contacts', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
