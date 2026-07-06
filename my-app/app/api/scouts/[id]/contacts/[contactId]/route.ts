import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES } from '@/lib/roles'

type RouteParams = { params: Promise<{ id: string; contactId: string }> }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id, contactId } = await params

    // Vérifier que le scout appartient à la paroisse
    const scout = await prisma.scout.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true },
    })

    if (!scout) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    const contact = await prisma.contactUrgence.findFirst({
      where: { id: contactId, scoutId: id },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { nom, prenom, telephone, relation, principal } = body as {
      nom?: string
      prenom?: string
      telephone?: string
      relation?: string
      principal?: boolean
    }

    // Si passage en principal, retirer le statut des autres
    if (principal === true && !contact.principal) {
      await prisma.contactUrgence.updateMany({
        where: { scoutId: id, principal: true, NOT: { id: contactId } },
        data: { principal: false },
      })
    }

    const contactMisAJour = await prisma.contactUrgence.update({
      where: { id: contactId },
      data: {
        ...(nom !== undefined ? { nom: nom.trim() } : {}),
        ...(prenom !== undefined ? { prenom: prenom?.trim() || null } : {}),
        ...(telephone !== undefined ? { telephone: telephone.trim() } : {}),
        ...(relation !== undefined ? { relation: relation?.trim() || null } : {}),
        ...(principal !== undefined ? { principal } : {}),
      },
    })

    return NextResponse.json(contactMisAJour)
  } catch (error) {
    console.error('[PUT /api/scouts/[id]/contacts/[contactId]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id, contactId } = await params

    // Vérifier que le scout appartient à la paroisse
    const scout = await prisma.scout.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true },
    })

    if (!scout) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    // Vérifier qu'il ne s'agit pas du dernier contact
    const nbContacts = await prisma.contactUrgence.count({ where: { scoutId: id } })

    if (nbContacts <= 1) {
      return NextResponse.json(
        { error: 'Impossible de supprimer le dernier contact d\'urgence' },
        { status: 400 },
      )
    }

    const contact = await prisma.contactUrgence.findFirst({
      where: { id: contactId, scoutId: id },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }

    await prisma.contactUrgence.delete({ where: { id: contactId } })

    return NextResponse.json({ message: 'Contact supprimé' })
  } catch (error) {
    console.error('[DELETE /api/scouts/[id]/contacts/[contactId]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
