'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from '@/lib/icons'

export interface PhotoVisionneuse {
  id: string
  url: string
  legende: string | null
  texteAlt: string | null
}

/**
 * Grille de photos et visionneuse plein écran accessible : <dialog> modal
 * (focus piégé et Échap natifs), flèches du clavier, retour du focus sur la
 * vignette d'origine à la fermeture.
 */
export function Visionneuse({ photos, titreAlbum }: { photos: PhotoVisionneuse[]; titreAlbum: string }) {
  const [index, setIndex] = useState<number | null>(null)
  const dialogue = useRef<HTMLDialogElement>(null)
  const vignettes = useRef<(HTMLButtonElement | null)[]>([])
  const dernierIndex = useRef(0)
  const total = photos.length

  const ouvrir = (i: number) => {
    dernierIndex.current = i
    setIndex(i)
  }
  const fermer = useCallback(() => setIndex(null), [])
  const precedente = useCallback(() => setIndex((i) => (i === null ? i : (i - 1 + total) % total)), [total])
  const suivante = useCallback(() => setIndex((i) => (i === null ? i : (i + 1) % total)), [total])

  useEffect(() => {
    const d = dialogue.current
    if (!d) return
    if (index !== null && !d.open) d.showModal()
    if (index === null && d.open) {
      d.close()
      vignettes.current[dernierIndex.current]?.focus()
    }
  }, [index])

  useEffect(() => {
    if (index !== null) dernierIndex.current = index
  }, [index])

  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      precedente()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      suivante()
    }
  }

  const photo = index !== null ? photos[index] : null
  const alt = (p: PhotoVisionneuse, i: number) => p.texteAlt || p.legende || `Photo ${i + 1} sur ${total} — ${titreAlbum}`

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              ref={(el) => {
                vignettes.current[i] = el
              }}
              type="button"
              onClick={() => ouvrir(i)}
              className="group block aspect-square w-full overflow-hidden rounded-md bg-papier-fonce focus-visible:outline-offset-4"
              aria-label={`Agrandir : ${alt(p, i)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                loading="lazy"
                decoding="async"
                width={400}
                height={400}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogue}
        aria-label={`Visionneuse — ${titreAlbum}`}
        onCancel={(e) => {
          e.preventDefault()
          fermer()
        }}
        onClose={fermer}
        onKeyDown={surTouche}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#0d1410]/95 p-0 text-white backdrop:bg-black/80"
      >
        {photo && index !== null && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <p className="text-sm text-white/80" aria-live="polite">
                Photo {index + 1} sur {total}
              </p>
              <button
                type="button"
                onClick={fermer}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-white"
                aria-label="Fermer la visionneuse"
                autoFocus
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <figure className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-2 pb-4 sm:px-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={photo.id} src={photo.url} alt={alt(photo, index)} className="max-h-full max-w-full animate-apparition rounded-lg object-contain" />
              {photo.legende && (
                <figcaption className="mt-3 max-w-3xl px-4 text-center text-sm leading-relaxed text-white/85">{photo.legende}</figcaption>
              )}
            </figure>
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={precedente}
                  className="absolute top-1/2 left-2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-white sm:left-4"
                  aria-label="Photo précédente"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={suivante}
                  className="absolute top-1/2 right-2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-white sm:right-4"
                  aria-label="Photo suivante"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden />
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  )
}
