'use client'

import { useEffect, useState } from 'react'
import { LOGO_OFFICIEL } from '@/lib/identite'

export type SiteInfo = {
  logoUrl: string
  nomSite: string
  sousTitreSite: string
}

const DEFAUT: SiteInfo = {
  logoUrl: LOGO_OFFICIEL,
  nomSite: 'SCOUT ASCCI',
  sousTitreSite: "Côte d'Ivoire",
}

// Partage aussi la requête en cours entre les composants de la page.
let cache: SiteInfo | null = null
let requete: Promise<SiteInfo> | null = null

async function chargerSiteInfo(): Promise<SiteInfo> {
  if (cache) return cache
  if (!requete) {
    requete = fetch('/api/public/logo')
      .then((r) => {
        if (!r.ok) throw new Error('Impossible de charger le logo')
        return r.json() as Promise<Partial<SiteInfo>>
      })
      .then((d) => {
        cache = {
          logoUrl: d.logoUrl || LOGO_OFFICIEL,
          nomSite: d.nomSite ?? DEFAUT.nomSite,
          sousTitreSite: d.sousTitreSite ?? DEFAUT.sousTitreSite,
        }
        return cache
      })
      .finally(() => {
        requete = null
      })
  }
  return requete
}

export function useSiteInfo(): SiteInfo {
  const [info, setInfo] = useState<SiteInfo>(cache ?? DEFAUT)

  useEffect(() => {
    let actif = true
    chargerSiteInfo()
      .then((result) => {
        if (actif) setInfo(result)
      })
      .catch(() => {
        if (actif) setInfo(DEFAUT)
      })
    return () => {
      actif = false
    }
  }, [])

  return info
}
