import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import type { RequeteAuthentifiee, UtilisateurSession } from '../types'

export const UtilisateurCourant = createParamDecorator((_data: unknown, ctx: ExecutionContext): UtilisateurSession => {
  const requete = ctx.switchToHttp().getRequest<RequeteAuthentifiee>()
  if (!requete.utilisateur) throw new UnauthorizedException('Non authentifié')
  return requete.utilisateur
})
