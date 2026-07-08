// Utilitaires de thème partagés entre l'identité plateforme (ConfigurationPlateforme,
// gérée par ADMIN_PLATEFORME) et l'identité propre à chaque paroisse (couleurs sur
// le modèle Paroisse, gérées par son Chef de Groupe). Centralisé ici pour éviter
// trois copies de la même regex (app/layout.tsx, /api/admin/site-config, /api/paroisse).

export type Theme = {
  couleurPrimaire: string
  couleurAccent: string
  couleurFond: string
  couleurHover: string
}

export const THEME_DEFAUT: Theme = {
  couleurPrimaire: '#1a4731',
  couleurAccent: '#27ae60',
  couleurFond: '#0f2418',
  couleurHover: '#27ae60',
}

// Ces valeurs sont injectées telles quelles dans une balise <style> (voir
// app/layout.tsx, dangerouslySetInnerHTML) : sans ce contrôle strict, une
// valeur comme "#fff} </style><script>…</script>" permettrait une injection
// HTML/JS stockée, visible par tous les visiteurs du site.
export const COULEUR_HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function estCouleurHexValide(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && COULEUR_HEX_REGEX.test(valeur)
}

export function couleurSure(valeur: string | null | undefined, defaut: string): string {
  return valeur && COULEUR_HEX_REGEX.test(valeur) ? valeur : defaut
}

export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '39, 174, 96'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}
