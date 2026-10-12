import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { limiterTaux } from '@/lib/rateLimit'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const { token, motDePasse } = await req.json() as { token?: string; motDePasse?: string }
    const tokenNettoye = token?.trim()

    if (!tokenNettoye) return NextResponse.json({ erreur: 'Token manquant' }, { status: 400 })
    if (!motDePasse || !motDePasseValide(motDePasse)) {
      return NextResponse.json({ erreur: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'ip-inconnue'
    if (!limiterTaux(`reset-mdp:ip:${ip}`, 10, 15 * 60 * 1000).autorise) {
      logger.warn('reset_mdp.rate_limit', { ip })
      return NextResponse.json({ erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 })
    }

    const tokenRecord = await prisma.tokenReinitialisation.findUnique({
      where: { token: tokenNettoye },
      include: { utilisateur: { select: { id: true } } },
    })

    if (!tokenRecord || tokenRecord.utilise) {
      return NextResponse.json({ erreur: 'Ce lien est invalide ou a déjà été utilisé.' }, { status: 400 })
    }

    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json({ erreur: 'Ce lien a expiré. Veuillez faire une nouvelle demande.' }, { status: 400 })
    }

    const passwordHache = await hash(motDePasse, 12)

    // Consommation atomique du token : le passage à `utilise` n'aboutit que si
    // le token est encore valide à cet instant. Deux requêtes concurrentes avec
    // le même lien ne peuvent donc pas réinitialiser le mot de passe deux fois.
    const consomme = await prisma.$transaction(async (tx) => {
      const { count } = await tx.tokenReinitialisation.updateMany({
        where: { id: tokenRecord.id, utilise: false, expiresAt: { gt: new Date() } },
        data: { utilise: true },
      })
      if (count !== 1) return false

      await tx.utilisateur.update({
        where: { id: tokenRecord.utilisateurId },
        data: { password: passwordHache },
      })
      return true
    })

    if (!consomme) {
      return NextResponse.json({ erreur: 'Ce lien est invalide ou a déjà été utilisé.' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Mot de passe modifié avec succès.' })
  } catch (error) {
    logger.error('reset_mdp.erreur', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// Vérifier la validité d'un token (GET)
export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token')?.trim()
    if (!token) return NextResponse.json({ valide: false })

    const record = await prisma.tokenReinitialisation.findUnique({
      where: { token },
      select: { utilise: true, expiresAt: true },
    })

    const valide = !!(record && !record.utilise && record.expiresAt > new Date())
    return NextResponse.json({ valide })
  } catch {
    return NextResponse.json({ valide: false })
  }
}
