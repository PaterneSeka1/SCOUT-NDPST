'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ParoisseLogoImageAuto } from '@/app/components/ParoisseLogoImage'
import { useSiteInfo } from '@/app/components/useSiteInfo'
import { BackLink } from '@/app/components/ui/BackLink'

// Page publique (hors matcher de proxy.ts) : demande d'un lien de
// réinitialisation. L'API répond de la même façon que le compte existe ou non.
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
      const data = (await res.json().catch(() => ({}))) as { erreur?: string }
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      setEnvoye(true)
    } catch {
      toast.error('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--cf)' }}>
      <div className="w-full max-w-md px-4">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div
              className="mb-4 inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              <ParoisseLogoImageAuto taille="lg" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--cp)' }}>
              Mot de passe oublié
            </h1>
            <p className="mt-1 text-sm text-gray-500">{nomSite}</p>
          </div>

          {envoye ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">E-mail envoyé</p>
                <p className="mt-1 text-sm text-gray-500">
                  Si un compte correspond à <strong>{email}</strong>, vous recevrez un lien de réinitialisation dans
                  quelques minutes.
                </p>
              </div>
              <p className="text-xs text-gray-400">Vérifiez également vos spams.</p>
              <Link
                href="/login"
                className="mt-2 inline-block w-full rounded-lg border border-gray-300 py-2.5 text-center text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-gray-600">
                Entrez l&apos;adresse e-mail associée à votre compte. Nous vous enverrons un lien pour réinitialiser
                votre mot de passe.
              </p>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="votre@email.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 transition focus:border-transparent focus:ring-2 focus:ring-(--ca) focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={soumission || !email.trim()}
                style={{ backgroundColor: 'var(--cp)' }}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {soumission ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Envoi en cours…
                  </>
                ) : (
                  'Envoyer le lien'
                )}
              </button>

              <div className="flex justify-center">
                <BackLink href="/login">Retour à la connexion</BackLink>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-gray-400">Association Scouts Catholiques de Côte d&apos;Ivoire</p>
        </div>
      </div>
    </div>
  )
}
