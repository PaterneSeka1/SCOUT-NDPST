'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ParoisseLogoImageAuto } from '@/app/components/ParoisseLogoImage'
import { useSiteInfo } from '@/app/components/useSiteInfo'
import { PasswordInput } from '@/app/components/PasswordInput'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { BackLink } from '@/app/components/ui/BackLink'

function FormulaireReinitialisation() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''
  const { nomSite } = useSiteInfo()

  const [etatToken, setEtatToken] = useState<'verification' | 'valide' | 'invalide'>('verification')
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [soumission, setSoumission] = useState(false)
  const [succes, setSucces] = useState(false)

  useEffect(() => {
    if (!token) { setEtatToken('invalide'); return }
    fetch(`/api/auth/reinitialiser-motdepasse?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => setEtatToken(d.valide ? 'valide' : 'invalide'))
      .catch(() => setEtatToken('invalide'))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!motDePasseValide(motDePasse)) {
      toast.error(REGLE_MOT_DE_PASSE)
      return
    }
    if (motDePasse !== confirmation) {
      toast.error('Les mots de passe ne correspondent pas.')
      return
    }

    setSoumission(true)
    try {
      const res = await fetch('/api/auth/reinitialiser-motdepasse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, motDePasse }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      setSucces(true)
      setTimeout(() => router.push('/login'), 3000)
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
            <h1 className="text-xl font-bold" style={{ color: 'var(--cp)' }}>Nouveau mot de passe</h1>
            <p className="text-sm text-gray-500 mt-1">{nomSite}</p>
          </div>

          {etatToken === 'verification' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="w-8 h-8 border-t-transparent rounded-full animate-spin border-2" style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }} />
              <p className="text-sm text-gray-500">Vérification du lien…</p>
            </div>
          )}

          {etatToken === 'invalide' && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Lien invalide ou expiré</p>
                <p className="text-sm text-gray-500 mt-1">
                  Ce lien de réinitialisation est invalide, a déjà été utilisé, ou a expiré (valable 1 heure).
                </p>
              </div>
              <Link href="/mot-de-passe-oublie"
                className="inline-block w-full text-center py-2.5 text-white rounded-lg hover:brightness-110 transition-all text-sm font-semibold"
                style={{ backgroundColor: 'var(--cp)' }}>
                Faire une nouvelle demande
              </Link>
              <div className="flex justify-center">
                <BackLink href="/login">Retour à la connexion</BackLink>
              </div>
            </div>
          )}

          {etatToken === 'valide' && !succes && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-700 mb-1">
                  Nouveau mot de passe
                </label>
                <PasswordInput
                  id="motDePasse"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                  autoFocus
                  placeholder={REGLE_MOT_DE_PASSE}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                  style={{ '--tw-ring-color': 'var(--ca)' } as React.CSSProperties}
                />
              </div>

              <div>
                <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmer le mot de passe
                </label>
                <PasswordInput
                  id="confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                />
              </div>

              <button
                type="submit"
                disabled={soumission || !motDePasse || !confirmation}
                style={{ backgroundColor: 'var(--cp)' }}
                className="w-full py-3 px-4 hover:brightness-110 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                {soumission ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enregistrement…
                  </>
                ) : 'Enregistrer le nouveau mot de passe'}
              </button>
            </form>
          )}

          {succes && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Mot de passe modifié</p>
                <p className="text-sm text-gray-500 mt-1">
                  Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé vers la connexion…
                </p>
              </div>
              <Link href="/login"
                className="inline-block w-full text-center py-2.5 text-white rounded-lg hover:brightness-110 transition-all text-sm font-semibold"
                style={{ backgroundColor: 'var(--cp)' }}>
                Se connecter
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PageReinitialiserMotDePasse() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cf)' }}>
        <span className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FormulaireReinitialisation />
    </Suspense>
  )
}
