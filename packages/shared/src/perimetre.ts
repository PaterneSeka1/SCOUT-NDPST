// Périmètre produit — les espaces PARENT et SCOUT (mes enfants, ma
// progression, comptes familles, rappels par e-mail aux parents) restent
// fermés tant que les règles pédagogiques, les autorisations et la protection
// des données des mineurs n'ont pas été validées par le groupe. Le code et les
// données sont conservés.
//   - côté serveur, proxy.ts du frontend renvoie 404 (API) ou redirige (pages)
//     avant toute logique : c'est la vraie barrière, l'interface ne fait que suivre ;
//   - les rôles PARENT et SCOUT ne sont pas attribuables tant que le
//     périmètre est fermé (voir roles.ts).
// Pour ouvrir ces espaces : passer ESPACES_FAMILLES_ACTIFS à `true`.
export const ESPACES_FAMILLES_ACTIFS = false

const PAGES_FAMILLES: RegExp[] = [/^\/dashboard\/(parents|mes-enfants|ma-progression)(\/|$)/]

const API_FAMILLES: RegExp[] = [
  /^\/api\/ma-progression(\/|$)/,
  /^\/api\/mes-enfants(\/|$)/,
  /^\/api\/scouts\/[^/]+\/compte(\/|$)/,
  /^\/api\/cron\/rappels-documents(\/|$)/,
]

export function pageHorsPerimetre(chemin: string): boolean {
  return !ESPACES_FAMILLES_ACTIFS && PAGES_FAMILLES.some((motif) => motif.test(chemin))
}

export function apiHorsPerimetre(chemin: string): boolean {
  return !ESPACES_FAMILLES_ACTIFS && API_FAMILLES.some((motif) => motif.test(chemin))
}
