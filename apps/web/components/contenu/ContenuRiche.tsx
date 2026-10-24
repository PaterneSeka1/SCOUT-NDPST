import { analyserContenu } from '@scout/shared'

/**
 * Rendu du texte éditorial structuré (actualités, branches, histoire). Aucun
 * HTML n'est interprété : chaque bloc devient un élément React échappé.
 */
export function ContenuRiche({ texte, className = '' }: { texte: string | null | undefined; className?: string }) {
  if (!texte?.trim()) return null
  return (
    <div className={`space-y-4 leading-relaxed text-stone-700 ${className}`}>
      {analyserContenu(texte).map((bloc, i) => {
        switch (bloc.type) {
          case 'titre':
            return bloc.niveau === 2 ? (
              <h2 key={i} className="titre-display pt-2 text-2xl font-semibold text-stone-900">
                {bloc.texte}
              </h2>
            ) : (
              <h3 key={i} className="pt-1 text-lg font-semibold text-stone-900">
                {bloc.texte}
              </h3>
            )
          case 'liste':
            return (
              <ul key={i} className="list-disc space-y-1 pl-6 marker:text-accent">
                {bloc.elements.map((e, j) => (
                  <li key={j}>{e}</li>
                ))}
              </ul>
            )
          case 'citation':
            return (
              <blockquote key={i} className="border-l-4 border-or-500/60 bg-sable-50 px-4 py-3 text-stone-800 italic">
                {bloc.texte}
              </blockquote>
            )
          default:
            return <p key={i}>{bloc.texte}</p>
        }
      })}
    </div>
  )
}
