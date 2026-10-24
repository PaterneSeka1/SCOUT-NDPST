// Pagination serveur commune : page et limite lues dans la query string,
// toujours bornées (une limite démesurée ne doit jamais charger toute une table).

export interface Pagination {
  page: number
  limite: number
  skip: number
}

function entier(valeur: unknown, defaut: number): number {
  const lu = typeof valeur === 'string' ? parseInt(valeur, 10) : NaN
  return Number.isFinite(lu) ? lu : defaut
}

export function lirePagination(requete: Record<string, unknown>, limiteDefaut = 20, limiteMax = 100): Pagination {
  const page = Math.max(1, entier(requete.page, 1))
  const limite = Math.min(limiteMax, Math.max(1, entier(requete.limite, limiteDefaut)))
  return { page, limite, skip: (page - 1) * limite }
}

export function metaPagination({ page, limite }: Pagination, total: number) {
  return { page, limite, total, totalPages: Math.max(1, Math.ceil(total / limite)) }
}

/** Paramètre texte de query string (Express peut fournir un tableau ou un objet). */
export function texteRequete(valeur: unknown, max = 100): string | undefined {
  if (typeof valeur !== 'string') return undefined
  const texte = valeur.trim().slice(0, max)
  return texte || undefined
}
