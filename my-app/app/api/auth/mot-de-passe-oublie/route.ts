import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { envoyerEmailReinitialisation } from '@/lib/email'
import { limiterTaux } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

const MAX_DEMANDES = 5
const FENETRE_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string }

    if (!email?.trim()) {
      return NextResponse.json({ erreur: 'Email requis' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'ip-inconnue'
    const parIp = limiterTaux(`mdp-oublie:ip:${ip}`, MAX_DEMANDES, FENETRE_MS)
    const parEmail = limiterTaux(`mdp-oublie:email:${email.trim().toLowerCase()}`, MAX_DEMANDES, FENETRE_MS)
    if (!parIp.autorise || !parEmail.autorise) {
      logger.warn('mdp_oublie.rate_limit', { ip, parIp: !parIp.autorise, parEmail: !parEmail.autorise })
      return NextResponse.json({ erreur: 'Trop de demandes. Réessayez dans quelques minutes.' }, { status: 429 })
    }

    // Réponse toujours identique pour ne pas révéler si l'email existe
    const reponse = { message: 'Si un compte correspond à cet email, un lien de réinitialisation a été envoyé.' }

    const utilisateur = await prisma.utilisateur.findFirst({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, prenom: true, email: true },
    })

    if (!utilisateur || !utilisateur.email) return NextResponse.json(reponse)

    // Invalider les anciens tokens
    await prisma.tokenReinitialisation.updateMany({
      where: { utilisateurId: utilisateur.id, utilise: false },
      data: { utilise: true },
    })

    // Créer un nouveau token (1 heure)
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.tokenReinitialisation.create({
      data: { token, utilisateurId: utilisateur.id, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const lien = `${baseUrl}/reinitialiser-motdepasse?token=${token}`

    await envoyerEmailReinitialisation(utilisateur.email, utilisateur.prenom, lien)

    return NextResponse.json(reponse)
  } catch (error) {
    logger.error('mdp_oublie.erreur', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
