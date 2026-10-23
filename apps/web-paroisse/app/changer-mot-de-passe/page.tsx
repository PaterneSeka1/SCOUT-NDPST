'use client'

import { useState } from 'react'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@scout/shared'
import { PasswordInput } from '@/app/components/PasswordInput'
import { signOut } from '@/lib/session-client'

export default function ChangerMotDePassePage() {
  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)
  const [termine, setTermine] = useState(false)

  async function soumettre(event: React.FormEvent) {
    event.preventDefault()
    setErreur('')
    if (!motDePasseValide(nouveau)) { setErreur(REGLE_MOT_DE_PASSE); return }
    if (nouveau !== confirmation) { setErreur('Les mots de passe ne correspondent pas.'); return }
    if (actuel === nouveau) { setErreur('Choisissez un mot de passe différent du mot de passe temporaire.'); return }
    setChargement(true)
    try {
      const reponse = await fetch('/api/auth/changer-mot-de-passe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motDePasseActuel: actuel, nouveauMotDePasse: nouveau }),
      })
      const data = await reponse.json().catch(() => ({}))
      if (!reponse.ok) {
        setErreur(reponse.status === 401 ? 'Votre session a expiré. Déconnectez-vous puis reconnectez-vous.' : data.erreur ?? 'Le changement a échoué. Vérifiez votre mot de passe actuel.')
        return
      }
      setActuel(''); setNouveau(''); setConfirmation(''); setTermine(true)
    } catch { setErreur('Connexion impossible. Réessayez dans quelques instants.') }
    finally { setChargement(false) }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--cf) p-4">
      <section className="w-full max-w-md space-y-5 rounded-xl bg-white p-6 shadow-lg" aria-labelledby="titre-motdepasse">
        <h1 id="titre-motdepasse" className="text-xl font-bold">Définir mon mot de passe</h1>
        {termine ? <>
          <p role="status">Votre mot de passe personnel est enregistré. Reconnectez-vous pour ouvrir votre espace.</p>
          <a href="/login" className="inline-block rounded-lg bg-(--cp) px-4 py-2 text-white">Se reconnecter</a>
        </> : <>
          <p className="text-sm text-gray-600">Remplacez votre mot de passe temporaire pour accéder à votre espace.</p>
          <form onSubmit={soumettre} className="space-y-4" aria-describedby={erreur ? 'erreur-motdepasse' : undefined}>
            <div>
              <label htmlFor="actuel" className="mb-1 block text-sm font-medium">Mot de passe actuel ou temporaire</label>
              <PasswordInput id="actuel" value={actuel} onChange={(e) => setActuel(e.target.value)} required autoComplete="current-password" className="w-full rounded-lg border p-3" />
            </div>
            <div>
              <label htmlFor="nouveau" className="mb-1 block text-sm font-medium">Nouveau mot de passe personnel</label>
              <PasswordInput id="nouveau" value={nouveau} onChange={(e) => setNouveau(e.target.value)} required autoComplete="new-password" aria-describedby="regle-motdepasse" className="w-full rounded-lg border p-3" />
              <p id="regle-motdepasse" className="mt-1 text-xs text-gray-600">{REGLE_MOT_DE_PASSE}</p>
            </div>
            <div>
              <label htmlFor="confirmation" className="mb-1 block text-sm font-medium">Confirmer le nouveau mot de passe</label>
              <PasswordInput id="confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required autoComplete="new-password" className="w-full rounded-lg border p-3" />
            </div>
            {erreur && <p id="erreur-motdepasse" role="alert" className="text-sm text-red-700">{erreur}</p>}
            <button disabled={chargement} className="w-full rounded-lg bg-(--cp) px-4 py-3 text-white disabled:opacity-60">{chargement ? 'Enregistrement…' : 'Enregistrer et me reconnecter'}</button>
          </form>
          <button type="button" onClick={() => void signOut()} className="text-sm underline">Me déconnecter</button>
        </>}
      </section>
    </main>
  )
}
