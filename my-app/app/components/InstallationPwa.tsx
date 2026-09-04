'use client'

import { useEffect, useState } from 'react'
import { Smartphone, Share, X } from '@/lib/icons'

type EvenementInstallation = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CLE_STOCKAGE = 'pwa-installation-ecartee'

export function InstallationPwa({ nomSite, logoSite }: { nomSite: string; logoSite: string | null }) {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null)
  const [visible, setVisible] = useState(false)
  const [estIOS, setEstIOS] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const modeStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (modeStandalone || localStorage.getItem(CLE_STOCKAGE)) return

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    setEstIOS(ios)

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setEvenement(e as EvenementInstallation)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    // iOS Safari n'émet jamais "beforeinstallprompt" (pas d'installation
    // programmatique) : on affiche quand même les instructions manuelles,
    // après un court délai pour ne pas gêner l'arrivée sur le site.
    const minuteur = ios ? setTimeout(() => setVisible(true), 2500) : undefined

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      if (minuteur) clearTimeout(minuteur)
    }
  }, [])

  function ecarter() {
    setVisible(false)
    localStorage.setItem(CLE_STOCKAGE, '1')
  }

  async function installer() {
    if (!evenement) return
    await evenement.prompt()
    await evenement.userChoice
    setVisible(false)
    localStorage.setItem(CLE_STOCKAGE, '1')
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-6 sm:left-auto sm:w-96">
      <div className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
        <button
          onClick={ecarter}
          aria-label="Fermer"
          className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="flex items-start gap-3 pr-4">
          {logoSite ? (
            // Logo déjà validé/hébergé par l'app (config plateforme) — pas
            // besoin de next/image ici pour un simple aperçu 44x44.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSite}
              alt=""
              className="h-11 w-11 flex-shrink-0 rounded-xl border border-gray-100 object-contain"
            />
          ) : (
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              <Smartphone className="h-5 w-5" strokeWidth={2} />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Installer {nomSite}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              {estIOS ? (
                <>
                  Appuyez sur <strong>Partager</strong> (icône{' '}
                  <Share className="inline h-3.5 w-3.5 -translate-y-px" strokeWidth={2} aria-hidden />) puis{' '}
                  <strong>« Sur l&apos;écran d&apos;accueil »</strong> pour un accès rapide, même sans connexion.
                </>
              ) : (
                <>Ajoutez l&apos;application à votre écran d&apos;accueil pour y accéder en un geste.</>
              )}
            </p>
          </div>
        </div>

        {!estIOS && (
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={ecarter}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Plus tard
            </button>
            <button
              onClick={installer}
              className="rounded-lg px-4 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              Installer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
