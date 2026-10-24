import 'server-only'
import { cookies } from 'next/headers'
import { DELAI_API_INTERNE_MS, urlApiInterne } from './api-interne'

// Appel à l'API depuis un composant serveur ou une route : transmet les
// cookies de la requête en cours (dont le jeton d'accès, éventuellement
// rafraîchi par le middleware juste avant). Un appel trop long est abandonné
// (rejet de la promesse, comme une erreur réseau) : les appelants le gèrent
// déjà via leur try/catch ou .catch().
export async function appelApiServeur(chemin: string, init: RequestInit = {}): Promise<Response> {
  const jar = await cookies()
  const entetes = new Headers(init.headers)
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ')
  if (cookieHeader) entetes.set('cookie', cookieHeader)
  const delai = AbortSignal.timeout(DELAI_API_INTERNE_MS)
  const signal = init.signal ? AbortSignal.any([init.signal, delai]) : delai
  return fetch(`${urlApiInterne()}${chemin}`, { ...init, headers: entetes, cache: 'no-store', signal })
}
