import 'server-only'
import { DELAI_API_INTERNE_MS, urlApiInterne } from './api-interne'
import { logger } from './logger'

// Lecture des routes publiques de l'API (/api/public/*) depuis les pages
// serveur du site. Les données publiées changent rarement : courte mise en
// cache côté Next (revalidation), jamais de données privées ici.
export async function lirePublic<T>(chemin: string, { revalidate = 60 }: { revalidate?: number } = {}): Promise<T | null> {
  try {
    const reponse = await fetch(`${urlApiInterne()}/api/public${chemin}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(DELAI_API_INTERNE_MS),
    })
    if (reponse.status === 404) return null
    if (!reponse.ok) throw new Error(`Statut ${reponse.status}`)
    return (await reponse.json()) as T
  } catch (erreur) {
    logger.error('api_publique.indisponible', erreur, { chemin })
    return null
  }
}
