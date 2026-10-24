'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ParoisseLogoImageAuto } from '@/components/ParoisseLogoImage'
import { useSiteInfo } from '@/components/useSiteInfo'
import { PasswordInput } from '@/components/PasswordInput'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@scout/shared'
import { BackLink } from '@/components/ui/BackLink'

function FormulaireReinitialisation() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''
  const { nomSite } = useSiteInfo()

  const [verificationToken, setVerificationToken] = useState<{ token: string; valide: boolean } | null>(null)
  const etatToken = !token
    ? 'invalide'
    : verificationToken?.token === token
      ? verificationToken.valide
        ? 'valide'
        : 'invalide'
      : 'verification'
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [soumission, setSoumission] = useState(false)
  const [succes, setSucces] = useState(false)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    fetch(`/api/auth/reinitialiser-motdepasse?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!controller.signal.aborted) setVerificationToken({ token, valide: Boolean(d.valide) })
      })
      .catch(() => {
        if (!controller.signal.aborted) setVerificationToken({ token, valide: false })
      })
    return () => controller.abort()
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
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      setSucces(true)
      setTimeout(() => router.push('/connexion'), 3000)
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
            <h1 className="text-xl font-bold" style={{ color: 'var(--cp)' }}>
              Nouveau mot de passe
            </h1>
            <p className="mt-1 text-sm text-stone-500">{nomSite}</p>
          </div>

          {etatToken === 'verification' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span
                className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }}
              />
              <p className="text-sm text-stone-500">Vérification du lien…</p>
            </div>
          )}

          {etatToken === 'invalide' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">Lien invalide ou expiré</p>
                <p className="mt-1 text-sm text-stone-500">
                  Ce lien de réinitialisation est invalide, a déjà été utilisé, ou a expiré (valable 1 heure).
                </p>
              </div>
              <Link
                href="/mot-de-passe-oublie"
                className="inline-block w-full rounded-lg py-2.5 text-center text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ backgroundColor: 'var(--cp)' }}
              >
                Faire une nouvelle demande
              </Link>
              <div className="flex justify-center">
                <BackLink href="/connexion">Retour à la connexion</BackLink>
              </div>
            </div>
          )}

          {etatToken === 'valide' && !succes && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="motDePasse" className="mb-1 block text-sm font-medium text-stone-700">
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
                  className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm transition focus:border-transparent focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': 'var(--ca)' } as React.CSSProperties}
                />
              </div>

              <div>
                <label htmlFor="confirmation" className="mb-1 block text-sm font-medium text-stone-700">
                  Confirmer le mot de passe
                </label>
                <PasswordInput
                  id="confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm transition focus:border-transparent focus:ring-2 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={soumission || !motDePasse || !confirmation}
                style={{ backgroundColor: 'var(--cp)' }}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {soumission ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Enregistrement…
                  </>
                ) : (
                  'Enregistrer le nouveau mot de passe'
                )}
              </button>
            </form>
          )}

          {succes && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">Mot de passe modifié</p>
                <p className="mt-1 text-sm text-stone-500">
                  Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé vers la connexion…
                </p>
              </div>
              <Link
                href="/connexion"
                className="inline-block w-full rounded-lg py-2.5 text-center text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ backgroundColor: 'var(--cp)' }}
              >
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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--cf)' }}>
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      }
    >
      <FormulaireReinitialisation />
    </Suspense>
  )
}
