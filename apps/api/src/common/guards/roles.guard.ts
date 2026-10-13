import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CLE_ROLES, CLE_ROLES_DISTRICT } from '../decorators/roles.decorator'
import type { RequeteAuthentifiee } from '../types'

// Garde globale, exécutée après AuthGuard : applique @Roles (rôle paroissial)
// et @RolesDistrict (affectation district). Sans métadonnée, la route reste
// accessible à tout utilisateur authentifié — les contrôles de propriété
// (branche, paroisse) restent du ressort des services.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexte: ExecutionContext): boolean {
    const cibles = [contexte.getHandler(), contexte.getClass()]
    const roles = this.reflector.getAllAndOverride<string[] | undefined>(CLE_ROLES, cibles)
    const rolesDistrict = this.reflector.getAllAndOverride<string[] | undefined>(CLE_ROLES_DISTRICT, cibles)
    if (!roles && !rolesDistrict) return true

    const utilisateur = contexte.switchToHttp().getRequest<RequeteAuthentifiee>().utilisateur
    if (!utilisateur) throw new ForbiddenException('Accès refusé')

    if (roles && !roles.includes(utilisateur.role)) throw new ForbiddenException('Accès refusé')
    if (rolesDistrict && !(utilisateur.roleDistrict && rolesDistrict.includes(utilisateur.roleDistrict))) {
      throw new ForbiddenException('Accès refusé')
    }
    return true
  }
}
