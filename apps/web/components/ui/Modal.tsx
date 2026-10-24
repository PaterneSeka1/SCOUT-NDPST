'use client'

import { useEffect, useRef } from 'react'
import { X } from '@/lib/icons'

/**
 * Fenêtre modale native (<dialog>) : piège du focus, Échap et retour du focus
 * gérés par le navigateur. `variante="tiroir"` l'ancre à droite (Drawer).
 */
export function Modal({
  ouvert,
  onFermer,
  titre,
  description,
  children,
  pied,
  variante = 'centre',
  taille = 'md',
}: {
  ouvert: boolean
  onFermer: () => void
  titre: string
  description?: string
  children: React.ReactNode
  pied?: React.ReactNode
  variante?: 'centre' | 'tiroir'
  taille?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const dialogue = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialogue.current
    if (!d) return
    if (ouvert && !d.open) d.showModal()
    if (!ouvert && d.open) d.close()
  }, [ouvert])

  const largeur = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[taille]
  const position =
    variante === 'tiroir'
      ? `m-0 ml-auto h-dvh max-h-none w-full ${largeur} rounded-none`
      : `m-auto max-h-[90dvh] w-[calc(100%-2rem)] ${largeur} rounded-xl`

  return (
    <dialog
      ref={dialogue}
      aria-labelledby="titre-modale"
      onCancel={(e) => {
        e.preventDefault()
        onFermer()
      }}
      onClick={(e) => {
        if (e.target === dialogue.current) onFermer()
      }}
      className={`${position} flex-col bg-white p-0 shadow-flottante backdrop:bg-stone-900/50 open:flex`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 id="titre-modale" className="text-base font-semibold text-stone-900">
            {titre}
          </h2>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
        <button type="button" onClick={onFermer} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="scrollbar-fine flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {pied && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3">{pied}</div>}
    </dialog>
  )
}

export function Drawer(props: Omit<React.ComponentProps<typeof Modal>, 'variante'>) {
  return <Modal {...props} variante="tiroir" />
}
