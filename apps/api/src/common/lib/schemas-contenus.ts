import { estUrlFichierValide } from '@scout/shared'
import { z } from 'zod'
import { urlPubliqueBase } from './storage'

// Briques Zod des contenus publics et de la configuration. Elles ne portent
// que la forme des données ; existence et droits restent dans les services.

/** Texte facultatif borné : absent → inchangé, null ou vide → null. */
export function texteFacultatif(cle: string, max: number) {
  return z
    .string({ error: `Le champ ${cle} est invalide` })
    .max(max, `Le champ ${cle} dépasse ${max} caractères`)
    .nullish()
    .transform((valeur) => (valeur === undefined ? undefined : valeur?.trim() || null))
}

/** Texte obligatoire, nettoyé et borné. */
export function texteRequis(cle: string, max: number) {
  return z
    .string({ error: `Le champ ${cle} est obligatoire` })
    .trim()
    .min(1, `Le champ ${cle} est obligatoire`)
    .max(max, `Le champ ${cle} dépasse ${max} caractères`)
}

/**
 * Image publique : chemin local servi par l'API ou URL du stockage public
 * configuré côté serveur (jamais une origine fournie par le client).
 */
export function urlImagePublique(cle: string) {
  return texteFacultatif(cle, 500).refine(
    (url) => url == null || estUrlFichierValide(url, urlPubliqueBase()),
    `Le champ ${cle} doit être une image téléversée sur la plateforme`,
  )
}

/** Date ISO facultative (YYYY-MM-DD ou date-heure), null pour effacer. */
export function dateFacultative(cle: string) {
  return z
    .string({ error: `Le champ ${cle} est invalide` })
    .nullish()
    .transform((valeur, ctx) => {
      if (valeur === undefined) return undefined
      if (!valeur) return null
      const date = new Date(valeur)
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: 'custom', message: `Le champ ${cle} n'est pas une date valide` })
        return z.NEVER
      }
      return date
    })
}
