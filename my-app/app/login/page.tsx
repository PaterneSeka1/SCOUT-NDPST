'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChargement(true)

    const result = await signIn('credentials', {
      identifiant,
      password,
      redirect: false,
    })

    setChargement(false)

    if (result?.error) {
      toast.error(
        result.error === 'CredentialsSignin'
          ? 'Identifiant ou mot de passe incorrect.'
          : result.error,
      )
    } else {
      const session = await getSession()
      router.push(session?.user?.role === 'ADMIN_PLATEFORME' ? '/admin' : '/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cf)' }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 overflow-hidden" style={{ backgroundColor: 'var(--cp)' }}>
              <ParoisseLogoImageAuto taille="lg" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--cp)' }}>{nomSite}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Suivi pédagogique — Côte d&apos;Ivoire
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="identifiant"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ca)] focus:border-transparent transition text-gray-700 placeholder-gray-400"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Mot de passe
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ca)] focus:border-transparent transition text-gray-700 placeholder-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={chargement}
              style={{ backgroundColor: 'var(--cp)' }}
              className="w-full py-3 px-4 hover:brightness-110 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {chargement ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Connexion en cours…
                </>
              ) : (
                'Se connecter'
              )}
            </button>

            <div className="text-center">
              <a href="/mot-de-passe-oublie" className="text-sm text-gray-500 hover:text-[var(--cp)] transition-colors">
                Mot de passe oublié ?
              </a>
            </div>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Association Scouts Catholiques de Côte d&apos;Ivoire
          </p>
        </div>
      </div>
    </div>
  )
}
