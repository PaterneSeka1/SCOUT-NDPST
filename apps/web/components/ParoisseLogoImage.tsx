'use client'

import Image from 'next/image'
import { LOGO_PAR_DEFAUT } from '@/lib/identite'
import { useSiteInfo } from '@/components/useSiteInfo'

// Tailles prédéfinies (px)
const TAILLES = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 56,
} as const

type Taille = keyof typeof TAILLES

// ──────────────────────────────────────────────────────────────────
// Composant "muet" : affiche le logo si logoUrl fourni, sinon le logo
// officiel de la paroisse.
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

  return (
    <Image
      src={logoUrl || LOGO_PAR_DEFAUT}
      alt="Logo de la paroisse"
      width={px}
      height={px}
      unoptimized
      className={`object-contain ${className}`}
      style={{ width: px, height: px }}
    />
  )
}

// ──────────────────────────────────────────────────────────────────
// Variante pour les pages client hors layout (connexion, mot de passe) :
// le logo vient de l'identité publique, requête partagée par useSiteInfo.
// ──────────────────────────────────────────────────────────────────
export function ParoisseLogoImageAuto({
  taille = 'md',
  className = '',
}: {
  taille?: Taille
  className?: string
}) {
  const { logoUrl } = useSiteInfo()
  return <ParoisseLogoImage logoUrl={logoUrl} taille={taille} className={className} />
}
