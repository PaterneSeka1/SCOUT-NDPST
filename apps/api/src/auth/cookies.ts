import type { CookieOptions, Response } from 'express'
import { env } from '../config/env'

export const COOKIE_ACCES = 'scout_acces'
export const COOKIE_SESSION = 'scout_session'

// Le cookie de session (jeton de rafraîchissement) doit être lisible par le
// middleware du frontend sur toutes les pages, pour rafraîchir le jeton
// d'accès avant le rendu : chemin racine. Il reste httpOnly et n'est accepté
// par l'API que sur POST /api/auth/rafraichir et /api/auth/deconnexion.
const CHEMIN_COOKIE_SESSION = '/'

function optionsCommunes(): CookieOptions {
  const { NODE_ENV, COOKIE_DOMAINE } = env()
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    ...(COOKIE_DOMAINE ? { domain: COOKIE_DOMAINE } : {}),
  }
}

export function poserCookieAcces(reponse: Response, jeton: string) {
  reponse.cookie(COOKIE_ACCES, jeton, {
    ...optionsCommunes(),
    path: '/',
    // Le navigateur supprime le cookie à l'expiration du jeton : son absence
    // signale au frontend qu'un rafraîchissement est nécessaire.
    maxAge: env().JWT_ACCESS_TTL_SECONDES * 1000,
  })
}

export function poserCookieSession(reponse: Response, jeton: string, expireLe: Date) {
  reponse.cookie(COOKIE_SESSION, jeton, {
    ...optionsCommunes(),
    path: CHEMIN_COOKIE_SESSION,
    expires: expireLe,
  })
}

export function effacerCookies(reponse: Response) {
  reponse.clearCookie(COOKIE_ACCES, { ...optionsCommunes(), path: '/' })
  reponse.clearCookie(COOKIE_SESSION, { ...optionsCommunes(), path: CHEMIN_COOKIE_SESSION })
}
