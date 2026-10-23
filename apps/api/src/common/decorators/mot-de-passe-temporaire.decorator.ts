import { SetMetadata } from '@nestjs/common'

export const CLE_MOT_DE_PASSE_TEMPORAIRE = 'motDePasseTemporaireAutorise'
// Un compte en activation ne peut accéder qu'à sa session et au changement du secret.
export const MotDePasseTemporaireAutorise = () => SetMetadata(CLE_MOT_DE_PASSE_TEMPORAIRE, true)
