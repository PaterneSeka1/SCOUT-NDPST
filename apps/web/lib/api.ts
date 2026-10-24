// Appels à l'API depuis le navigateur (relais /api du frontend, cookies de
// session transmis automatiquement). Les erreurs de l'API ({ erreur }) sont
// converties en messages compréhensibles, jamais en détail technique.

export class ErreurApi extends Error {
  constructor(
    message: string,
    readonly statut: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

const MESSAGES_STATUT: Record<number, string> = {
  401: 'Votre session a expiré. Reconnectez-vous.',
  403: "Vous n'avez pas les droits nécessaires pour cette action.",
  404: "L'élément demandé est introuvable.",
  413: 'Fichier trop volumineux.',
  429: 'Trop de demandes. Réessayez dans quelques minutes.',
}

export async function lireErreur(reponse: Response): Promise<ErreurApi> {
  let corps: { erreur?: unknown; message?: unknown; code?: unknown } = {}
  try {
    corps = await reponse.json()
  } catch {
    // Corps non JSON : message générique.
  }
  const message =
    (typeof corps.erreur === 'string' && corps.erreur) ||
    (typeof corps.message === 'string' && corps.message) ||
    MESSAGES_STATUT[reponse.status] ||
    'Une erreur est survenue. Réessayez dans quelques instants.'
  return new ErreurApi(message, reponse.status, typeof corps.code === 'string' ? corps.code : undefined)
}

/** Requête JSON vers /api/… ; rejette une ErreurApi en cas d'échec. */
export async function api<T = unknown>(chemin: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...reste } = init
  let reponse: Response
  try {
    reponse = await fetch(chemin.startsWith('/api') ? chemin : `/api${chemin}`, {
      ...reste,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : reste.body,
      cache: 'no-store',
    })
  } catch {
    throw new ErreurApi('Connexion impossible. Vérifiez votre réseau.', 0)
  }
  if (!reponse.ok) throw await lireErreur(reponse)
  if (reponse.status === 204) return undefined as T
  const type = reponse.headers.get('content-type') ?? ''
  return (type.includes('application/json') ? await reponse.json() : await reponse.text()) as T
}

/** Construit une query string en ignorant les valeurs vides. */
export function requete(params: Record<string, string | number | boolean | null | undefined>): string {
  const recherche = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') recherche.set(cle, String(valeur))
  }
  const texte = recherche.toString()
  return texte ? `?${texte}` : ''
}

export interface Pagination {
  page: number
  limite: number
  total: number
  totalPages: number
}

/** Téléverse un fichier (photo, document, image publique ou de galerie). */
export async function televerser(fichier: File, visibilite: 'privee' | 'publique' | 'galerie'): Promise<string> {
  const formulaire = new FormData()
  formulaire.append('fichier', fichier)
  formulaire.append('visibilite', visibilite)
  const { url } = await api<{ url: string }>('/api/upload', { method: 'POST', body: formulaire })
  return url
}
