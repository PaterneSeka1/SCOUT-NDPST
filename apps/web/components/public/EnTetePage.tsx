/**
 * En-tête des pages intérieures du site public : aligné à gauche, compact
 * (le contenu reste visible sans défilement), avec un complément facultatif
 * à droite (repère chiffré, actions). Variante « foret » pour les pages
 * narratives (histoire, maîtrise) ; « papier » pour les pages de contenu.
 */
export function EnTetePage({
  surtitre,
  titre,
  description,
  complement,
  variante = 'papier',
  children,
}: {
  surtitre?: string
  titre: string
  description?: React.ReactNode
  complement?: React.ReactNode
  variante?: 'papier' | 'foret'
  children?: React.ReactNode
}) {
  const foret = variante === 'foret'
  return (
    <section className={`relative isolate overflow-hidden ${foret ? 'bg-profond text-white' : 'border-b border-ligne bg-papier'}`}>
      <div className={`absolute inset-0 -z-10 ${foret ? 'motif-topo-clair opacity-[0.07]' : 'motif-topo opacity-[0.05]'}`} aria-hidden />
      <div className="mx-auto max-w-7xl px-4 pt-10 pb-10 sm:px-6 sm:pt-14 sm:pb-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className={complement ? 'lg:col-span-8' : 'lg:col-span-10'}>
            {surtitre && <p className={`signal text-sm ${foret ? 'text-or-300' : 'text-accent'}`}>{surtitre}</p>}
            <h1 className={`titre-display mt-2 text-[2.15rem] leading-[1.08] font-semibold text-balance sm:text-5xl ${foret ? 'text-white' : 'text-encre'}`}>
              {titre}
            </h1>
            {description && (
              <div className={`mt-4 max-w-2xl text-lg leading-relaxed ${foret ? 'text-white/80' : 'text-encre-douce'}`}>{description}</div>
            )}
          </div>
          {complement && <div className="lg:col-span-4 lg:justify-self-end">{complement}</div>}
        </div>
        {children}
      </div>
    </section>
  )
}

/** Conteneur de section standard. */
export function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 ${className}`}>
      {children}
    </section>
  )
}

export function TitreSection({
  surtitre,
  titre,
  description,
  align = 'gauche',
  id,
  clair = false,
}: {
  surtitre?: string
  titre: string
  description?: string
  align?: 'gauche' | 'centre'
  id?: string
  clair?: boolean
}) {
  return (
    <div className={`max-w-2xl ${align === 'centre' ? 'mx-auto text-center' : ''}`}>
      {surtitre && <p className={`signal text-sm ${clair ? 'text-or-300' : 'text-accent'}`}>{surtitre}</p>}
      <h2 id={id} className={`titre-display mt-2 text-3xl leading-tight font-semibold text-balance sm:text-4xl ${clair ? 'text-white' : 'text-encre'}`}>
        {titre}
      </h2>
      {description && <p className={`mt-3 text-base leading-relaxed ${clair ? 'text-white/80' : 'text-encre-douce'}`}>{description}</p>}
    </div>
  )
}

/** Ligne d'en-tête de section : titre à gauche, lien « voir tout » à droite. */
export function EnTeteSection({ children, lien }: { children: React.ReactNode; lien?: React.ReactNode }) {
  return (
    <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      {children}
      {lien && <div className="shrink-0">{lien}</div>}
    </div>
  )
}
