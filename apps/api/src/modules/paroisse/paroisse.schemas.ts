import { z } from 'zod'
import { estUrlFichierValide } from '@scout/shared'
import { urlPubliqueBase } from '../../common/lib/storage'

// Schéma du corps de PATCH /paroisse (fiche modifiable par la direction du
// groupe). Seuls les champs listés ici sont conservés : les couleurs et le
// district ne sont pas modifiables en libre-service (z.object retire toute
// autre clé).

// Tous ces champs sont des textes : absent = inchangé, null accepté (le
// service décide s'il efface le champ ou l'ignore).
function texte(champ: string) {
  return z.string({ error: `${champ} doit être une chaîne de caractères` }).nullish()
}

export const SchemaModificationParoisse = z.object(
  {
    nom: texte('nom'),
    ville: texte('ville'),
    diocese: texte('diocese'),
    ocean: texte('ocean'),
    adresse: texte('adresse'),
    telephone: texte('telephone'),
    email: texte('email'),
    // Le logo est affiché tel quel dans l'interface : seul un chemin local ou
    // une URL du stockage configuré côté serveur est accepté (jamais une
    // origine fournie par le client).
    logo: texte('logo').refine(
      (logo) => logo == null || logo.trim() === '' || estUrlFichierValide(logo.trim(), urlPubliqueBase()),
      'logo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
    ),
  },
  { error: 'Données invalides' },
)

export type CorpsModificationParoisse = z.infer<typeof SchemaModificationParoisse>
