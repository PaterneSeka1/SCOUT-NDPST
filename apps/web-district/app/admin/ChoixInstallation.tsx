'use client'

import { COOKIE_INSTALLATION, INSTALLATION_LOCALE } from '@/lib/installations'

export interface OptionInstallation {
  id: string
  nom: string
}

// Choix de l'installation administrée. Mémorisé dans un cookie lu par le
// middleware, qui relaie alors les routes d'administration vers l'API de
// cette installation. Rechargement complet : aucune donnée de l'installation
// précédente ne reste affichée.
export function ChoixInstallation({
  installations,
  cible,
  nomDistrict,
}: {
  installations: OptionInstallation[]
  cible: string
  nomDistrict: string
}) {
  if (installations.length === 0) return null

  const choisir = (id: string) => {
    const securise = window.location.protocol === 'https:' ? '; secure' : ''
    document.cookie = `${COOKIE_INSTALLATION}=${encodeURIComponent(id)}; path=/; samesite=lax; max-age=2592000${securise}`
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- rechargement complet : le relais /api doit relire le cookie d'installation
    window.location.assign('/admin')
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/55">Installation administrée</span>
      <select
        value={cible}
        onChange={(e) => choisir(e.target.value)}
        className="w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white focus:ring-2 focus:ring-white/40 focus:outline-none"
      >
        <option value={INSTALLATION_LOCALE} className="text-gray-900">
          {nomDistrict}
        </option>
        {installations.map((i) => (
          <option key={i.id} value={i.id} className="text-gray-900">
            {i.nom}
          </option>
        ))}
      </select>
    </label>
  )
}
