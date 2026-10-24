// Utilitaires du thème de l'installation (ConfigurationInstallation, réglé dans
// Administration > Identité et configuration). Charte par défaut tirée du logo
// du groupe : vert scout, terracotta, sable, crème et or discret.

export type Theme = {
  couleurPrimaire: string
  couleurAccent: string
  couleurFond: string
  couleurHover: string
}

export const THEME_DEFAUT: Theme = {
  couleurPrimaire: '#2f5d3a',
  couleurAccent: '#b5653f',
  couleurFond: '#1f3a28',
  couleurHover: '#c27a52',
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
