// Installations autonomes (autre base, autre API) que l'administrateur
// plateforme gère depuis cette console, en plus de l'installation district
// elle-même. Elles acceptent ses jetons grâce à la clé publique du district
// (voir apps/api/src/auth/cles-admin.ts).
//
// Configuration serveur uniquement (jamais exposée au navigateur) :
//   INSTALLATIONS_GEREES='[{"id":"paroisse-wiradjuri","nom":"Paroisse Wiradjuri","api":"http://127.0.0.1:4000"}]'

export const COOKIE_INSTALLATION = 'scout_installation'
// Valeur du cookie pour l'installation district elle-même.
export const INSTALLATION_LOCALE = 'locale'

export interface InstallationGeree {
  id: string
  nom: string
  api: string
}

let cache: InstallationGeree[] | null = null

export function installationsGerees(): InstallationGeree[] {
  if (cache) return cache
  const brut = process.env.INSTALLATIONS_GEREES?.trim()
  if (!brut) return (cache = [])
  let liste: unknown
  try {
    liste = JSON.parse(brut)
  } catch {
    throw new Error('INSTALLATIONS_GEREES : JSON invalide (voir apps/web-district/.env.example).')
  }
  if (!Array.isArray(liste)) throw new Error('INSTALLATIONS_GEREES : une liste est attendue.')
  cache = liste.map((element, index) => {
    const { id, nom, api } = (element ?? {}) as Record<string, unknown>
    if (typeof id !== 'string' || !/^[a-z0-9-]{3,40}$/.test(id) || id === INSTALLATION_LOCALE) {
      throw new Error(`INSTALLATIONS_GEREES[${index}].id invalide.`)
    }
    if (typeof nom !== 'string' || !nom.trim()) throw new Error(`INSTALLATIONS_GEREES[${index}].nom manquant.`)
    if (typeof api !== 'string' || !/^https?:\/\//.test(api)) throw new Error(`INSTALLATIONS_GEREES[${index}].api invalide.`)
    return { id, nom: nom.trim(), api: api.replace(/\/$/, '') }
  })
  return cache
}

export function installationParId(id: string | undefined): InstallationGeree | null {
  if (!id || id === INSTALLATION_LOCALE) return null
  return installationsGerees().find((i) => i.id === id) ?? null
}

// Routes relayées vers l'installation choisie : administration et dépôt de
// fichiers publics (logo, image d'accueil). Tout le reste (connexion,
// session, profil) concerne toujours l'installation district.
export function routeAdministrable(chemin: string): boolean {
  return chemin.startsWith('/api/admin/') || chemin === '/api/upload'
}
