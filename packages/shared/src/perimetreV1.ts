// Périmètre produit V1 — l'application est centrée sur l'espace de la
// paroisse : Chef de Groupe, maîtrise de groupe (adjoint/assistants) et
// encadrement de branche. Tout le reste (espace district, programmes,
// progression/badges, documents et rappels, autorisations de camp, espaces
// parent et scout, calendrier iCal, cartes QR, rapports) reste dans le code et en base, mais est MASQUÉ :
//   - côté serveur, par proxy.ts (404 JSON pour les routes API, redirection
//     pour les pages) — c'est la vraie barrière, l'interface ne fait que suivre ;
//   - côté interface, par les tests `PERIMETRE_V1` dans les menus et les fiches.
//
// Pour réactiver une fonctionnalité : retirer son motif des listes ci-dessous
// (et, si besoin, le test `PERIMETRE_V1` correspondant dans l'interface).
// Pour tout réactiver d'un coup : passer PERIMETRE_V1 à `false`.
// Aucun schéma Prisma n'est modifié : les données existantes sont conservées.
export const PERIMETRE_V1 = true

const PAGES_HORS_V1: RegExp[] = [
  /^\/district(\/|$)/,
  /^\/dashboard\/(parents|documents|programmes|rapports|mes-enfants|ma-progression)(\/|$)/,
  /^\/dashboard\/scouts\/[^/]+\/carte(\/|$)/,
  // Apparence plateforme : réactivée pour l'application district, où
  // l'administrateur plateforme règle l'identité visuelle.
  /^\/admin\/rapports(\/|$)/,
]

const API_HORS_V1: RegExp[] = [
  /^\/api\/district(\/|$)/,
  /^\/api\/programmes(\/|$)/,
  /^\/api\/ma-progression(\/|$)/,
  /^\/api\/scouts\/[^/]+\/(progressions|documents|compte)(\/|$)/,
  /^\/api\/documents(\/|$)/,
  /^\/api\/cron\/rappels-documents(\/|$)/,
  /^\/api\/activites\/[^/]+\/autorisations(\/|$)/,
  /^\/api\/mes-enfants(\/|$)/,
  /^\/api\/calendrier(\/|$)/,
  /^\/api\/rapports(\/|$)/,
  /^\/api\/admin\/rapports\/export(\/|$)/,
  // Cotisations détaillées (montants, paiements partiels) : remplacées en V1
  // par le simple marquage cotisant / non cotisant de /api/cotisations/statuts.
  /^\/api\/cotisations(\/(?!statuts\/?$)[^/]+)?\/?$/,
]

export function pageHorsPerimetreV1(chemin: string): boolean {
  return PERIMETRE_V1 && PAGES_HORS_V1.some((motif) => motif.test(chemin))
}

export function apiHorsPerimetreV1(chemin: string): boolean {
  return PERIMETRE_V1 && API_HORS_V1.some((motif) => motif.test(chemin))
}
