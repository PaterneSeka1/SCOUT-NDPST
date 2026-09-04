'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Compass } from '@/lib/icons'

// Tailles prédéfinies (px)
const TAILLES = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 56,
} as const

type Taille = keyof typeof TAILLES

// ──────────────────────────────────────────────────────────────────
// Composant "muet" : affiche le logo si logoUrl fourni, sinon une icône
// de repli (boussole scoute).
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

  // Fallback : icône de repli, taille proportionnelle au conteneur
  const iconPx = Math.round(px * 0.55)
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <Compass style={{ width: iconPx, height: iconPx }} strokeWidth={1.75} />
    </span>
  )
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
