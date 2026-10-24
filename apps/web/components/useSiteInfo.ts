'use client'

import { useEffect, useState } from 'react'
import { LOGO_PAR_DEFAUT, nomAffiche, sousTitreAffiche, type Identite } from '@/lib/identite'

export type SiteInfo = {
  logoUrl: string
  nomSite: string
  sousTitreSite: string
}

const DEFAUT: SiteInfo = { logoUrl: LOGO_PAR_DEFAUT, nomSite: 'Groupe scout', sousTitreSite: '' }

// Partage aussi la requête en cours entre les composants de la page.
let cache: SiteInfo | null = null
let requete: Promise<SiteInfo> | null = null

async function chargerSiteInfo(): Promise<SiteInfo> {
  if (cache) return cache
  if (!requete) {
    requete = fetch('/api/public/identite')
      .then((r) => {
        if (!r.ok) throw new Error("Impossible de charger l'identité du site")
        return r.json() as Promise<Identite>
      })
      .then((d) => {
        cache = { logoUrl: d.logoUrl || LOGO_PAR_DEFAUT, nomSite: nomAffiche(d), sousTitreSite: sousTitreAffiche(d) }
        return cache
      })
      .catch(() => {
        requete = null
        return DEFAUT
      })
  }
  return requete
}

/** Identité courte du site pour les composants client (pages d'authentification). */
export function useSiteInfo(): SiteInfo {
  const [info, setInfo] = useState<SiteInfo>(cache ?? DEFAUT)
  useEffect(() => {
    let actif = true
    chargerSiteInfo().then((i) => {
      if (actif) setInfo(i)
    })
    return () => {
      actif = false
    }
  }, [])
  return info
}
