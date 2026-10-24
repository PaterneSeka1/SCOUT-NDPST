// Accents visuels des branches (tokens --color-branche-* et --color-encre-*
// de globals.css). La couleur « marque » sert aux traits, pastilles et
// graphiques ; la couleur « encre » (contraste AA) à tout texte coloré. Le nom
// de la branche est toujours affiché à côté : la couleur n'est jamais seule.

// Noms de variables écrits en entier : Tailwind n'émet que les variables de
// thème qu'il retrouve littéralement dans les sources.
const MARQUES: Record<string, string> = {
  OISILLONS: 'var(--color-branche-oisillons)',
  LOUVETEAUX: 'var(--color-branche-louveteaux)',
  ECLAIREURS: 'var(--color-branche-eclaireurs)',
  CHEMINOTS: 'var(--color-branche-cheminots)',
  COMPAGNONS: 'var(--color-branche-compagnons)',
  RESSOURCES_ADULTES: 'var(--color-branche-ressources)',
}

const ENCRES: Record<string, string> = {
  OISILLONS: 'var(--color-encre-oisillons)',
  LOUVETEAUX: 'var(--color-encre-louveteaux)',
  ECLAIREURS: 'var(--color-encre-eclaireurs)',
  CHEMINOTS: 'var(--color-encre-cheminots)',
  COMPAGNONS: 'var(--color-encre-compagnons)',
  RESSOURCES_ADULTES: 'var(--color-encre-ressources)',
}

/** Couleur de marque d'une branche ; la couleur primaire du groupe à défaut. */
export function accentBranche(type: string | null | undefined): string {
  return (type && MARQUES[type]) || 'var(--cp)'
}

/** Couleur de texte d'une branche (contraste AA sur papier et blanc). */
export function encreBranche(type: string | null | undefined): string {
  return (type && ENCRES[type]) || 'var(--cp)'
}

/** Variables CSS à poser en style inline : `--accent-branche` et `--encre-branche`. */
export function styleAccent(type: string | null | undefined): React.CSSProperties {
  return { '--accent-branche': accentBranche(type), '--encre-branche': encreBranche(type) } as React.CSSProperties
}
