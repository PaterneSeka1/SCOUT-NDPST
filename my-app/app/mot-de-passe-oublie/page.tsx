'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ParoisseLogoImageAuto } from '@/app/components/ParoisseLogoImage'
import { useSiteInfo } from '@/app/components/useSiteInfo'

export default function PageMotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [soumission, setSoumission] = useState(false)
  const [envoye, setEnvoye] = useState(false)
  const { nomSite } = useSiteInfo()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSoumission(true)
    try {
      const res = await fetch('/api/auth/mot-de-passe-oublie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      setEnvoye(true)
    } catch {
      toast.error('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cf)' }}>
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 overflow-hidden" style={{ backgroundColor: 'var(--cp)' }}>
              <ParoisseLogoImageAuto taille="lg" />
            </div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cp)' }}>Mot de passe oublié</h1>
            <p className="text-sm text-gray-500 mt-1">{nomSite}</p>
          </div>

          {envoye ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Email envoyé</p>
                <p className="text-sm text-gray-500 mt-1">
                  Si un compte correspond à <strong>{email}</strong>, vous recevrez un lien de réinitialisation dans quelques minutes.
                </p>
              </div>
              <p className="text-xs text-gray-400">Vérifiez également vos spams.</p>
              <Link href="/login"
                className="inline-block w-full text-center py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm mt-2">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-gray-600">
                Entrez l&apos;adresse email associée à votre compte. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="votre@email.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27ae60] focus:border-transparent transition text-gray-700 placeholder-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={soumission || !email.trim()}
                style={{ backgroundColor: 'var(--cp)' }}
                className="w-full py-3 px-4 hover:brightness-110 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                {soumission ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Envoi en cours…
                  </>
                ) : 'Envoyer le lien'}
              </button>

              <Link href="/login"
                className="block text-center text-sm text-gray-500 hover:text-gray-700 transition-colors">
                ← Retour à la connexion
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
