import { SetMetadata } from '@nestjs/common'

export const CLE_PUBLIC = 'routePublique'

// Ouvre une route sans authentification. Toute route non marquée est protégée
// par AuthGuard (refus par défaut) : chaque usage doit être justifié.
export const Public = () => SetMetadata(CLE_PUBLIC, true)
