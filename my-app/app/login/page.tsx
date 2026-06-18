'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setChargement(false)

    if (result?.error) {
      setErreur('Email ou mot de passe incorrect.')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f2418]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1a4731] mb-4">
              <span className="text-3xl">⚜️</span>
            </div>
            <h1 className="text-2xl font-bold text-[#1a4731]">SCOUT ASCCI</h1>
            <p className="text-sm text-gray-500 mt-1">
              Suivi pédagogique — Côte d&apos;Ivoire
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="exemple@paroisse.ci"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27ae60] focus:border-transparent transition"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27ae60] focus:border-transparent transition"
              />
            </div>

            {erreur && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {erreur}
              </div>
            )}

            <button
              type="submit"
              disabled={chargement}
              className="w-full py-3 px-4 bg-[#1a4731] hover:bg-[#27ae60] text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Association Scouts Catholiques de Côte d&apos;Ivoire
          </p>
        </div>
      </div>
    </div>
  )
}
