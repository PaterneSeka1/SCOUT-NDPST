import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { compare, hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

// Différent de /api/utilisateurs/[id]/password (réinitialisation par un
// administrateur) : ici l'appelant ne peut agir que sur son propre compte
// (session.user.id, jamais un id transmis) et doit prouver qu'il connaît son
// mot de passe actuel avant de le changer.
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    const { motDePasseActuel, nouveauMotDePasse } = body as {
      motDePasseActuel?: string
      nouveauMotDePasse?: string
    }

    if (!motDePasseActuel || !nouveauMotDePasse) {
      return NextResponse.json(
        { erreur: 'Le mot de passe actuel et le nouveau mot de passe sont requis' },
        { status: 400 },
      )
    }

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    })
    if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

    const motDePasseCorrect = await compare(motDePasseActuel, utilisateur.password)
    if (!motDePasseCorrect) {
      return NextResponse.json({ erreur: 'Mot de passe actuel incorrect' }, { status: 400 })
    }

    if (!motDePasseValide(nouveauMotDePasse)) {
      return NextResponse.json({ erreur: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    const passwordHache = await hash(nouveauMotDePasse, 12)

    await prisma.utilisateur.update({
      where: { id: session.user.id },
      data: { password: passwordHache },
    })

    await enregistrerAudit({
      paroisseId: session.user.paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_MOT_DE_PASSE_MODIFIE',
      entite: 'Utilisateur',
      entiteId: session.user.id,
    })

    return NextResponse.json({ message: 'Mot de passe mis à jour' })
  } catch (error) {
    logger.error('PUT /api/me/password', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
