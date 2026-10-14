import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { hash } from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@scout/shared'
import { PrismaService } from '../prisma/prisma.service'
import { env } from '../config/env'
import { envoyerEmailReinitialisation } from '../common/lib/email'
import { limiterTaux } from '../common/lib/rateLimit'
import { logger } from '../common/lib/logger'
import { AuthService } from './auth.service'

const MAX_DEMANDES = 5
const FENETRE_MS = 15 * 60 * 1000
const DUREE_LIEN_MS = 60 * 60 * 1000

const LIEN_INVALIDE = 'Ce lien est invalide ou a déjà été utilisé.'

// Seule l'empreinte du jeton est stockée (comme pour les sessions) : le jeton
// lui-même n'existe que dans l'e-mail envoyé.
function empreinte(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

@Injectable()
export class MotDePasseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  // Réponse toujours identique pour ne pas révéler si l'adresse existe.
  async demanderReinitialisation(email: string, ip: string): Promise<{ message: string }> {
    const parIp = await limiterTaux(`mdp-oublie:ip:${ip}`, MAX_DEMANDES, FENETRE_MS)
    const parEmail = await limiterTaux(`mdp-oublie:email:${email.toLowerCase()}`, MAX_DEMANDES, FENETRE_MS)
    if (!parIp.autorise || !parEmail.autorise) {
      logger.warn('mdp_oublie.rate_limit', { ip, parIp: !parIp.autorise, parEmail: !parEmail.autorise })
      throw new HttpException(
        { erreur: 'Trop de demandes. Réessayez dans quelques minutes.' },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const reponse = { message: 'Si un compte correspond à cet email, un lien de réinitialisation a été envoyé.' }

    // Recherche insensible à la casse : les adresses sont stockées telles que saisies.
    const utilisateur = await this.prisma.utilisateur.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, prenom: true, email: true },
    })
    if (!utilisateur?.email) return reponse

    await this.prisma.tokenReinitialisation.updateMany({
      where: { utilisateurId: utilisateur.id, utilise: false },
      data: { utilise: true },
    })

    const token = randomBytes(32).toString('hex')
    await this.prisma.tokenReinitialisation.create({
      data: {
        empreinte: empreinte(token),
        utilisateurId: utilisateur.id,
        expiresAt: new Date(Date.now() + DUREE_LIEN_MS),
      },
    })

    const lien = `${env().URL_FRONTEND_PAROISSE.replace(/\/$/, '')}/reinitialiser-motdepasse?token=${token}`
    await envoyerEmailReinitialisation(utilisateur.email, utilisateur.prenom, lien)
    return reponse
  }

  async verifierLien(token: string): Promise<{ valide: boolean }> {
    if (!token) return { valide: false }
    const record = await this.prisma.tokenReinitialisation.findUnique({
      where: { empreinte: empreinte(token) },
      select: { utilise: true, expiresAt: true },
    })
    return { valide: !!(record && !record.utilise && record.expiresAt > new Date()) }
  }

  async reinitialiser(token: string, motDePasse: string, ip: string): Promise<{ message: string }> {
    if (!token) throw new BadRequestException('Token manquant')
    if (!motDePasseValide(motDePasse)) throw new BadRequestException(REGLE_MOT_DE_PASSE)

    if (!(await limiterTaux(`reset-mdp:ip:${ip}`, 10, FENETRE_MS)).autorise) {
      logger.warn('reset_mdp.rate_limit', { ip })
      throw new HttpException(
        { erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const record = await this.prisma.tokenReinitialisation.findUnique({ where: { empreinte: empreinte(token) } })
    if (!record || record.utilise) throw new BadRequestException(LIEN_INVALIDE)
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Ce lien a expiré. Veuillez faire une nouvelle demande.')
    }

    const passwordHache = await hash(motDePasse, 12)

    // Consommation atomique : deux requêtes concurrentes avec le même lien ne
    // peuvent pas réinitialiser le mot de passe deux fois.
    const consomme = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.tokenReinitialisation.updateMany({
        where: { id: record.id, utilise: false, expiresAt: { gt: new Date() } },
        data: { utilise: true },
      })
      if (count !== 1) return false
      await tx.utilisateur.update({ where: { id: record.utilisateurId }, data: { password: passwordHache } })
      return true
    })
    if (!consomme) throw new BadRequestException(LIEN_INVALIDE)

    // Un mot de passe réinitialisé ferme toutes les sessions ouvertes,
    // y compris celle d'un éventuel tiers qui connaissait l'ancien.
    await this.auth.revoquerToutes(record.utilisateurId)
    return { message: 'Mot de passe modifié avec succès.' }
  }
}
