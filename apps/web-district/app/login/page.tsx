'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ParoisseLogoImageAuto } from '@/app/components/ParoisseLogoImage'
import { useSiteInfo } from '@/app/components/useSiteInfo'
import { PasswordInput } from '@/app/components/PasswordInput'

export default function LoginPage() {
  const router = useRouter()
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [chargement, setChargement] = useState(false)
  const { nomSite } = useSiteInfo()

  // Redirigé ici par le layout /admin : session ouverte sans le rôle requis.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('refus')) {
      toast.error('Accès réservé aux administrateurs de la plateforme.')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)

    try {
      const reponse = await fetch('/api/auth/connexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiant, password }),
      })
      const data = (await reponse.json().catch(() => ({}))) as {
        erreur?: string
        utilisateur?: { role: string }
      }

      if (!reponse.ok) {
        toast.error(data.erreur ?? 'Identifiant ou mot de passe incorrect.')
      } else if (data.utilisateur?.role !== 'ADMIN_PLATEFORME') {
        // Compte paroissial : il relève du frontend de sa paroisse, la session
        // ouverte ici est refermée aussitôt.
        await fetch('/api/auth/deconnexion', { method: 'POST' })
        toast.error('Accès réservé aux administrateurs de la plateforme.')
      } else {
        const destination = new URLSearchParams(window.location.search).get('callbackUrl')
        // Uniquement un chemin interne : jamais de redirection vers un autre site.
        router.push(destination?.startsWith('/admin') ? destination : '/admin')
        router.refresh()
      }
    } catch {
      toast.error('Connexion impossible. Vérifiez votre accès à Internet, puis réessayez.')
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--cf)' }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div
              className="mb-4 inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              <ParoisseLogoImageAuto taille="lg" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--cp)' }}>
              {nomSite}
            </h1>
            <p className="mt-1 text-sm text-gray-500">Administration de la plateforme</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="identifiant" className="mb-1 block text-sm font-medium text-gray-700">
                Matricule ou numéro de téléphone
              </label>
              <input
                id="identifiant"
                type="text"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                required
                autoComplete="username"
                placeholder="Ex : 0545247O ou 0712345678"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 transition focus:border-transparent focus:ring-2 focus:ring-(--ca) focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 transition focus:border-transparent focus:ring-2 focus:ring-(--ca) focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={chargement}
              style={{ backgroundColor: 'var(--cp)' }}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {chargement ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Connexion en cours…
                </>
              ) : (
                'Se connecter'
              )}
            </button>

            <div className="text-center">
              <Link href="/mot-de-passe-oublie" className="text-sm text-gray-500 transition-colors hover:text-(--cp)">
                Mot de passe oublié ?
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">Association Scouts Catholiques de Côte d&apos;Ivoire</p>
        </div>
      </div>
    </div>
  )
}
