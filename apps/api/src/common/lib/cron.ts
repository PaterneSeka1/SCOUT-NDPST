import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common'
import { timingSafeEqual } from 'crypto'
import { env } from '../../config/env'

// Comparaison en temps constant : la durée ne dépend pas du nombre de
// caractères corrects, ce qui empêche de deviner le secret par mesure de temps.
export function secretsCorrespondent(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

// Tâches planifiées (routes /cron/*) : publiques au sens de la session, mais
// réservées au déclencheur du serveur, qui présente le secret partagé
// CRON_SECRET dans l'en-tête x-cron-secret.
export function verifierSecretCron(secretRecu: string | undefined): void {
  const secretAttendu = env().CRON_SECRET
  if (!secretAttendu) throw new InternalServerErrorException('CRON_SECRET non configuré côté serveur')
  if (!secretRecu || !secretsCorrespondent(secretRecu, secretAttendu)) {
    throw new UnauthorizedException('Non autorisé')
  }
}
