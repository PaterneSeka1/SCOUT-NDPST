import { NextResponse, type NextRequest } from 'next/server'
import { apiHorsPerimetreV1, pageHorsPerimetreV1 } from '@scout/shared'

const COOKIE_ACCES = 'scout_acces'
const COOKIE_SESSION = 'scout_session'

function urlApiInterne(): string {
  return (process.env.API_URL_INTERNE ?? 'http://127.0.0.1:4000').replace(/\/$/, '')
}

// Middleware du frontend paroissial :
// 1. périmètre produit V1 (voir @scout/shared perimetreV1) : fonctionnalités
//    masquées bloquées avant toute logique, même par appel direct ;
// 2. rafraîchissement transparent du jeton d'accès (durée de vie courte) à
//    partir du cookie de session, avant le rendu d'une page ou le relais d'un
//    appel /api vers l'API — les pages et les fetch() n'ont rien à gérer ;
// 3. redirection vers /login des pages protégées sans session.
// L'autorisation réelle reste faite par l'API sur chaque appel.
export default async function proxy(req: NextRequest) {
  const chemin = req.nextUrl.pathname
  const estApi = chemin.startsWith('/api/')

  if (estApi && apiHorsPerimetreV1(chemin)) {
    return NextResponse.json({ erreur: 'Fonctionnalité indisponible' }, { status: 404 })
  }
  if (!estApi && pageHorsPerimetreV1(chemin)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const acces = req.cookies.get(COOKIE_ACCES)?.value
  const session = req.cookies.get(COOKIE_SESSION)?.value
  const estRouteAuth = chemin.startsWith('/api/auth/')

  let reponse: NextResponse | null = null
  let accesDisponible = !!acces

  if (!acces && session && !estRouteAuth) {
    const rafraichi = await rafraichir(req, session)
    if (rafraichi) {
      // Le nouveau jeton est injecté dans la requête en cours (pour la page
      // ou l'appel relayé à l'API) et renvoyé au navigateur pour les suivantes.
      const entetes = new Headers(req.headers)
      entetes.set('cookie', remplacerCookie(req.headers.get('cookie') ?? '', COOKIE_ACCES, rafraichi.jetonAcces))
      reponse = NextResponse.next({ request: { headers: entetes } })
      for (const ligne of rafraichi.setCookies) reponse.headers.append('set-cookie', ligne)
      accesDisponible = true
    } else {
      reponse = NextResponse.next()
      reponse.cookies.delete(COOKIE_SESSION)
    }
  }

  if (chemin.startsWith('/dashboard') && !accesDisponible) {
    const login = new URL('/login', req.url)
    login.searchParams.set('callbackUrl', chemin)
    const redirection = NextResponse.redirect(login)
    if (reponse) for (const ligne of reponse.headers.getSetCookie()) redirection.headers.append('set-cookie', ligne)
    return redirection
  }

  return reponse ?? NextResponse.next()
}

async function rafraichir(
  req: NextRequest,
  jetonSession: string,
): Promise<{ jetonAcces: string; setCookies: string[] } | null> {
  try {
    const reponse = await fetch(`${urlApiInterne()}/api/auth/rafraichir`, {
      method: 'POST',
      headers: {
        cookie: `${COOKIE_SESSION}=${encodeURIComponent(jetonSession)}`,
        'user-agent': req.headers.get('user-agent') ?? '',
        ...(req.headers.get('x-forwarded-for') ? { 'x-forwarded-for': req.headers.get('x-forwarded-for')! } : {}),
      },
      cache: 'no-store',
    })
    if (!reponse.ok) return null
    const setCookies = reponse.headers.getSetCookie()
    const ligneAcces = setCookies.find((c) => c.startsWith(`${COOKIE_ACCES}=`))
    if (!ligneAcces) return null
    const jetonAcces = decodeURIComponent(ligneAcces.slice(COOKIE_ACCES.length + 1).split(';')[0])
    return { jetonAcces, setCookies }
  } catch {
    return null
  }
}

function remplacerCookie(entete: string, nom: string, valeur: string): string {
  const autres = entete
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith(`${nom}=`))
  return [...autres, `${nom}=${encodeURIComponent(valeur)}`].join('; ')
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
