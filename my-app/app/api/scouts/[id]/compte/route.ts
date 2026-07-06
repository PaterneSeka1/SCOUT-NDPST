import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { ROLES_GROUPE_ETENDU as ROLES_AUTORISES } from '@/lib/roles'

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

    const scout = await prisma.scout.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true, nom: true, prenom: true, matricule: true, utilisateurId: true },
    })

    if (!scout) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    if (!scout.matricule) {
      return NextResponse.json(
        { error: 'Le scout doit avoir un matricule avant de créer un compte' },
        { status: 400 },
      )
    }

    if (scout.utilisateurId) {
      return NextResponse.json(
        { error: 'Ce scout possède déjà un compte utilisateur' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const { password, telephone } = body as { password?: string; telephone?: string }

    if (!password || !motDePasseValide(password)) {
      return NextResponse.json({ error: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    // Vérifier que le matricule n'est pas déjà utilisé par un utilisateur
    const matriculeExistant = await prisma.utilisateur.findUnique({
      where: { matricule: scout.matricule },
      select: { id: true },
    })
    if (matriculeExistant) {
      return NextResponse.json(
        { error: 'Ce matricule est déjà utilisé par un compte existant' },
        { status: 400 },
      )
    }

    const passwordHache = await hash(password, 12)

    const utilisateur = await prisma.$transaction(async (tx) => {
      const nouvelUtilisateur = await tx.utilisateur.create({
        data: {
          nom: scout.nom,
          prenom: scout.prenom,
          matricule: scout.matricule,
          telephone: telephone?.trim() || null,
          role: 'SCOUT',
          password: passwordHache,
          paroisseId: session.user.paroisseId,
        },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          role: true,
          actif: true,
        },
      })

      await tx.scout.update({
        where: { id },
        data: { utilisateurId: nouvelUtilisateur.id },
      })

      return nouvelUtilisateur
    })

    return NextResponse.json(utilisateur, { status: 201 })
  } catch (error) {
    console.error('[POST /api/scouts/[id]/compte]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
