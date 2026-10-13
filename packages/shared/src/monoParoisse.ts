// Verrou produit V1 — l'application reste techniquement multi-paroisses
// (voir prisma/schema.prisma : District, Paroisse, ADMIN_PLATEFORME) mais la
// première version livrée ne doit servir qu'UNE seule paroisse. Plutôt que de
// retirer le modèle multi-paroisses (gros chantier, à refaire à l'identique
// dès qu'une 2e paroisse rejoindra la plateforme), on bloque simplement la
// création d'un 2e District/2e Paroisse et on masque la navigation
// correspondante côté admin plateforme.
//
// Pour repasser en multi-paroisses plus tard : mettre cette constante à
// `false` (aucune autre modification nécessaire, les garde-fous ci-dessous
// et la navigation redeviennent actifs automatiquement).
export const MONO_PAROISSE = false
