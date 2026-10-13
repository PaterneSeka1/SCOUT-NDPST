import { ForbiddenException } from '@nestjs/common'
import type { UtilisateurSession } from './types'

// Les rôles paroissiaux (tout sauf ADMIN_PLATEFORME) ont toujours une paroisse
// associée — garanti en base par une contrainte CHECK sur Utilisateur. Filet
// de sécurité si un défaut de contrôle d'accès laissait passer un compte sans
// paroisse jusqu'à une route paroissiale.
export function paroisseIdRequise(utilisateur: UtilisateurSession): string {
  if (!utilisateur.paroisseId) {
    throw new ForbiddenException('Route réservée au personnel paroissial')
  }
  return utilisateur.paroisseId
}
