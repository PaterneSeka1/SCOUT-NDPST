// Accents visuels des branches (tokens --color-branche-* de globals.css).
// Une couleur n'est jamais le seul porteur d'information : le nom de la
// branche est toujours affiché à côté.

const ACCENTS: Record<string, string> = {
  OISILLONS: 'var(--color-branche-oisillons)',
  LOUVETEAUX: 'var(--color-branche-louveteaux)',
  ECLAIREURS: 'var(--color-branche-eclaireurs)',
  CHEMINOTS: 'var(--color-branche-cheminots)',
  COMPAGNONS: 'var(--color-branche-compagnons)',
  RESSOURCES_ADULTES: 'var(--color-branche-ressources)',
}

/** Couleur d'accent d'une branche ; la couleur primaire du groupe à défaut. */
export function accentBranche(type: string | null | undefined): string {
  return (type && ACCENTS[type]) || 'var(--cp)'
}

/** Variable CSS à poser en style inline pour les classes `[--accent]`. */
export function styleAccent(type: string | null | undefined): React.CSSProperties {
  return { '--accent-branche': accentBranche(type) } as React.CSSProperties
}
