'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ParoisseLogoImageAuto } from '@/components/ParoisseLogoImage'
import { useSiteInfo } from '@/components/useSiteInfo'
import { PasswordInput } from '@/components/PasswordInput'
import { ArrowLeft, Loader2 } from '@/lib/icons'

const CHAMP =
  'w-full rounded-md border border-ligne-forte bg-white px-4 py-3 text-[0.95rem] text-encre transition placeholder:text-encre-pale focus:border-primaire focus:ring-2 focus:ring-primaire/20 focus:outline-none'

export default function LoginPage() {
  const router = useRouter()
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const { nomSite, sousTitreSite } = useSiteInfo()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null)
    if (!identifiant.trim() || !password) {
      setErreur('Indiquez votre identifiant et votre mot de passe.')
      return
    }
    setChargement(true)
    try {
      const reponse = await fetch('/api/auth/connexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiant: identifiant.trim(), password }),
      })
      const data = (await reponse.json().catch(() => ({}))) as {
        erreur?: string
        utilisateur?: { doitChangerMotDePasse?: boolean }
      }

      if (!reponse.ok || !data.utilisateur) {
        setErreur(
          reponse.status === 429
            ? 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
            : (data.erreur ?? 'Identifiant ou mot de passe incorrect.'),
        )
      } else if (data.utilisateur.doitChangerMotDePasse) {
        router.push('/changer-mot-de-passe')
        router.refresh()
      } else {
        const destination = new URLSearchParams(window.location.search).get('callbackUrl')
        // Uniquement un chemin interne de l'espace privé : jamais vers un autre site.
        const interne = destination && /^\/(dashboard|admin)(\/|$)/.test(destination) && !destination.startsWith('//')
        router.push(interne ? destination : '/dashboard')
        router.refresh()
      }
    } catch {
      setErreur('Connexion impossible. Vérifiez votre accès à Internet, puis réessayez.')
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="grid min-h-dvh bg-papier lg:grid-cols-2">
      <aside className="relative isolate hidden overflow-hidden bg-profond p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="motif-topo-clair absolute inset-0 -z-10 opacity-[0.08]" aria-hidden />
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white focus-visible:outline-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour au site
        </Link>
        <div>
          <p className="signal text-sm text-or-300">Espace membres</p>
          <p className="titre-display mt-3 max-w-md text-4xl leading-tight font-semibold text-balance">{nomSite}</p>
          {sousTitreSite && <p className="mt-2 text-white/75">{sousTitreSite}</p>}
          <p className="mt-8 max-w-md leading-relaxed text-white/80">
            Gestion des scouts, des activités, des présences, des cotisations et de la progression de chaque branche.
          </p>
        </div>
        <p className="text-xs text-white/60">Accès réservé à la maîtrise et à l’administration du groupe.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-ligne">
              <ParoisseLogoImageAuto taille="md" />
            </span>
            <span className="titre-display text-lg leading-tight font-semibold text-encre">{nomSite}</span>
          </div>
          <h1 className="titre-display text-3xl font-semibold text-encre">Connexion</h1>
          <p className="mt-1 text-encre-douce">Accédez à l’espace de gestion du groupe.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {erreur && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {erreur}
              </p>
            )}
            <div>
              <label htmlFor="identifiant" className="mb-1.5 block text-sm font-medium text-encre">
                Matricule ou numéro de téléphone
              </label>
              <input
                id="identifiant"
                type="text"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                required
                autoComplete="username"
                aria-invalid={erreur ? true : undefined}
                className={CHAMP}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <label htmlFor="password" className="block text-sm font-medium text-encre">
                  Mot de passe
                </label>
                <Link href="/mot-de-passe-oublie" className="text-sm text-primaire underline-offset-4 hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                aria-invalid={erreur ? true : undefined}
                className={CHAMP}
              />
            </div>
            <button
              type="submit"
              disabled={chargement}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primaire px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {chargement && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {chargement ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          <Link href="/" className="mt-10 inline-flex items-center gap-2 text-sm text-encre-douce hover:text-encre lg:hidden">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour au site
          </Link>
        </div>
      </main>
    </div>
  )
}
