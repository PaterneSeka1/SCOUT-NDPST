'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

// Tailles prédéfinies (px)
const TAILLES = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 56,
} as const

type Taille = keyof typeof TAILLES

// ──────────────────────────────────────────────────────────────────
// Composant "muet" : affiche le logo si logoUrl fourni, sinon ⚜️
// ──────────────────────────────────────────────────────────────────
export function ParoisseLogoImage({
  logoUrl,
  taille = 'md',
  className = '',
}: {
  logoUrl?: string | null
  taille?: Taille
  className?: string
}) {
  const px = TAILLES[taille]

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt="Logo de la paroisse"
        width={px}
        height={px}
        unoptimized
        className={`object-contain ${className}`}
        style={{ width: px, height: px }}
      />
    )
  }

  // Fallback : fleur de lys emoji
  const textCls = taille === 'xl' || taille === 'lg' ? 'text-3xl' : taille === 'sm' ? 'text-base' : 'text-2xl'
  return <span className={`${textCls} ${className}`}>⚜️</span>
}

// ──────────────────────────────────────────────────────────────────
// Composant auto-fetching pour les pages client (login, sidebar…)
// Interroge /api/public/logo et affiche le résultat
// ──────────────────────────────────────────────────────────────────
export function ParoisseLogoImageAuto({
  taille = 'md',
  className = '',
}: {
  taille?: Taille
  className?: string
}) {
  // undefined = en cours | null = pas de logo | string = URL
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    fetch('/api/public/logo')
      .then((r) => r.json())
      .then((d: { logoUrl: string | null }) => setLogoUrl(d.logoUrl ?? null))
      .catch(() => setLogoUrl(null))
  }, [])

  if (logoUrl === undefined) {
    // Skeleton pendant le chargement
    const px = TAILLES[taille]
    return (
      <span
        className="block rounded animate-pulse bg-white/20"
        style={{ width: px, height: px }}
      />
    )
  }

  return <ParoisseLogoImage logoUrl={logoUrl} taille={taille} className={className} />
}
