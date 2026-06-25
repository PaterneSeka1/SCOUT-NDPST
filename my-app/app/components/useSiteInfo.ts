'use client'

import { useEffect, useState } from 'react'

export type SiteInfo = {
  logoUrl: string | null
  nomSite: string
  sousTitreSite: string
}

const DEFAUT: SiteInfo = {
  logoUrl: null,
  nomSite: 'SCOUT ASCCI',
  sousTitreSite: "Côte d'Ivoire",
}

// Mise en cache simple pour éviter de multiples requêtes sur la même page
let cache: SiteInfo | null = null

export function useSiteInfo(): SiteInfo {
  const [info, setInfo] = useState<SiteInfo>(cache ?? DEFAUT)

  useEffect(() => {
    if (cache) { setInfo(cache); return }
    fetch('/api/public/logo')
      .then((r) => r.json())
      .then((d: Partial<SiteInfo>) => {
        const result: SiteInfo = {
          logoUrl: d.logoUrl ?? null,
          nomSite: d.nomSite ?? DEFAUT.nomSite,
          sousTitreSite: d.sousTitreSite ?? DEFAUT.sousTitreSite,
        }
        cache = result
        setInfo(result)
      })
      .catch(() => setInfo(DEFAUT))
  }, [])

  return info
}
