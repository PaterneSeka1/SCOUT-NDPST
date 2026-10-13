import 'server-only'
import { cookies } from 'next/headers'

// URL de l'API joignable depuis le serveur Next.js (réseau interne, jamais
// exposée au navigateur, qui passe par le proxy /api de ce frontend).
export function urlApiInterne(): string {
  return (process.env.API_URL_INTERNE ?? 'http://127.0.0.1:4000').replace(/\/$/, '')
}

// Appel à l'API depuis un composant serveur ou une route : transmet les
// cookies de la requête en cours (dont le jeton d'accès, éventuellement
// rafraîchi par le middleware juste avant).
export async function appelApiServeur(chemin: string, init: RequestInit = {}): Promise<Response> {
  const jar = await cookies()
  const entetes = new Headers(init.headers)
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ')
  if (cookieHeader) entetes.set('cookie', cookieHeader)
  return fetch(`${urlApiInterne()}${chemin}`, { ...init, headers: entetes, cache: 'no-store' })
}
