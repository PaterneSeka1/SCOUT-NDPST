/** Bandeau d'en-tête des pages intérieures du site public. */
export function EnTetePage({ surtitre, titre, description }: { surtitre?: string; titre: string; description?: string }) {
  return (
    <section className="motif-cercles relative overflow-hidden bg-sable-50 pt-28 pb-14 sm:pt-36 sm:pb-20">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        {surtitre && <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{surtitre}</p>}
        <h1 className="titre-display mt-3 text-4xl font-semibold text-stone-900 sm:text-5xl">{titre}</h1>
        {description && <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-stone-600">{description}</p>}
      </div>
    </section>
  )
}

/** Conteneur de section standard. */
export function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 ${className}`}>
      {children}
    </section>
  )
}

export function TitreSection({ surtitre, titre, description, align = 'gauche' }: { surtitre?: string; titre: string; description?: string; align?: 'gauche' | 'centre' }) {
  return (
    <div className={`mb-10 max-w-2xl ${align === 'centre' ? 'mx-auto text-center' : ''}`}>
      {surtitre && <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{surtitre}</p>}
      <h2 className="titre-display mt-2 text-3xl font-semibold text-stone-900 sm:text-4xl">{titre}</h2>
      {description && <p className="mt-3 text-base leading-relaxed text-stone-600">{description}</p>}
    </div>
  )
}
