import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { limiterTaux } from '@/lib/rateLimit'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'

export async function POST(req: NextRequest) {
  try {
    const { token, motDePasse } = await req.json() as { token?: string; motDePasse?: string }

    if (!token?.trim()) return NextResponse.json({ erreur: 'Token manquant' }, { status: 400 })
    if (!motDePasse || !motDePasseValide(motDePasse)) {
      return NextResponse.json({ erreur: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'ip-inconnue'
    if (!limiterTaux(`reset-mdp:ip:${ip}`, 10, 15 * 60 * 1000).autorise) {
      return NextResponse.json({ erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 })
    }

    const tokenRecord = await prisma.tokenReinitialisation.findUnique({
      where: { token },
      include: { utilisateur: { select: { id: true } } },
    })

    if (!tokenRecord || tokenRecord.utilise) {
      return NextResponse.json({ erreur: 'Ce lien est invalide ou a déjà été utilisé.' }, { status: 400 })
    }

    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json({ erreur: 'Ce lien a expiré. Veuillez faire une nouvelle demande.' }, { status: 400 })
    }

    const passwordHache = await hash(motDePasse, 12)

    await prisma.$transaction([
      prisma.utilisateur.update({
        where: { id: tokenRecord.utilisateurId },
        data: { password: passwordHache },
      }),
      prisma.tokenReinitialisation.update({
        where: { token },
        data: { utilise: true },
      }),
    ])

    return NextResponse.json({ message: 'Mot de passe modifié avec succès.' })
  } catch (error) {
    console.error('[POST /api/auth/reinitialiser-motdepasse]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// Vérifier la validité d'un token (GET)
export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token')
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
