import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { peutGererContenus } from '@scout/shared'
import { CLE_EDITEUR_CONTENU, CLE_ROLES } from '../decorators/roles.decorator'
import type { RequeteAuthentifiee } from '../types'

// Garde globale, exécutée après AuthGuard : applique @Roles et
// @EditeurContenu. Sans métadonnée, la route reste accessible à tout
// utilisateur authentifié — les contrôles de propriété (branche, scout)
// restent du ressort des services.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexte: ExecutionContext): boolean {
    const cibles = [contexte.getHandler(), contexte.getClass()]
    const roles = this.reflector.getAllAndOverride<string[] | undefined>(CLE_ROLES, cibles)
    const editeur = this.reflector.getAllAndOverride<boolean | undefined>(CLE_EDITEUR_CONTENU, cibles)
    if (!roles && !editeur) return true

    const utilisateur = contexte.switchToHttp().getRequest<RequeteAuthentifiee>().utilisateur
    if (!utilisateur) throw new ForbiddenException('Accès refusé')

    if (roles && !roles.includes(utilisateur.role)) throw new ForbiddenException('Accès refusé')
    if (editeur && !peutGererContenus(utilisateur)) throw new ForbiddenException('Accès refusé')
    return true
  }
}
