'use client'

import { useState } from 'react'
import { ImageOff } from '@/lib/icons'

/**
 * Image publiée par l'API (chemin relayé /api/… ou stockage public) : balise
 * <img> native, chargement différé, dimensions portées par le conteneur.
 * En cas d'échec de chargement, un visuel neutre remplace l'image cassée.
 */
export function ImagePublique({
  src,
  alt,
  className = '',
  prioritaire = false,
}: {
  src: string
  alt: string
  className?: string
  prioritaire?: boolean
}) {
  const [echec, setEchec] = useState(false)
  if (echec) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-papier-fonce text-encre-pale" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <ImageOff className="h-7 w-7" strokeWidth={1.5} aria-hidden />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={prioritaire ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={prioritaire ? 'high' : undefined}
      onError={() => setEchec(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}
