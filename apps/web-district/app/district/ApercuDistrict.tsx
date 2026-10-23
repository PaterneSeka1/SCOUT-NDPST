import type { EtatApercuDistrict } from '@/lib/apercu-district'

const ERREURS = {
  'session-expiree': ['Session expirée', 'Reconnectez-vous pour consulter les indicateurs.'],
  'fonctionnalite-indisponible': ['Espace district indisponible', 'Cet espace est désactivé sur cette installation.'],
  interdit: ['Accès interdit', 'Votre affectation ne permet pas de consulter ces indicateurs.'],
  indisponible: ['Indicateurs indisponibles', 'Le service ne peut pas fournir les indicateurs pour le moment.'],
  invalide: ['Indicateurs incohérents', 'Les données reçues ne permettent pas de présenter des statistiques fiables.'],
  reseau: ['Connexion au service impossible', 'La connexion a échoué ou le délai de réponse a été dépassé.'],
} as const

export function ApercuDistrict({ etat }: { etat: EtatApercuDistrict }) {
  if (etat.statut !== 'disponible') {
    const [titre, message] = ERREURS[etat.statut]
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-bold">{titre}</h1>
        <p role="alert">{message}</p>
        {etat.statut === 'session-expiree' ? (
          <a className="inline-block rounded-lg bg-(--cp) px-4 py-2 font-semibold text-white" href="/login?callbackUrl=%2Fdistrict">Se reconnecter</a>
        ) : etat.statut !== 'interdit' && etat.statut !== 'fonctionnalite-indisponible' ? (
          <a className="inline-block rounded-lg bg-(--cp) px-4 py-2 font-semibold text-white" href="/district">Réessayer</a>
        ) : null}
      </main>
    )
  }

  const { nomDistrict, totaux, paroisses } = etat.donnees
  const indicateurs = [
    ['Paroisses rattachées', totaux.paroisses],
    ['Paroisses actives', totaux.paroissesActives],
    ['Scouts enregistrés', totaux.scouts],
    ['Comptes utilisateurs', totaux.utilisateurs],
    ['Activités ce mois', totaux.activitesMois],
  ] as const

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">District {nomDistrict}</h1>
        <p className="text-sm text-gray-600">Données de cette installation uniquement. Les autres installations ne sont pas incluses.</p>
      </header>
      <section aria-labelledby="indicateurs-district">
        <h2 id="indicateurs-district" className="mb-3 text-lg font-semibold">Vue d’ensemble locale</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {indicateurs.map(([libelle, valeur]) => (
            <div key={libelle} className="rounded-xl border border-gray-200 bg-white p-4">
              <dt className="text-sm text-gray-600">{libelle}</dt>
              <dd className="mt-2 text-2xl font-bold text-gray-900">{valeur.toLocaleString('fr-FR')}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="paroisses-district" className="space-y-3">
        <h2 id="paroisses-district" className="text-lg font-semibold">Paroisses rattachées</h2>
        {paroisses.length === 0 ? <p>Aucune paroisse rattachée dans cette installation.</p> : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Effectifs enregistrés par paroisse dans cette installation</caption>
              <thead className="bg-gray-50 text-gray-700">
                <tr>{['Paroisse', 'Ville', 'Statut', 'Scouts', 'Comptes'].map((libelle) => <th key={libelle} scope="col" className="px-4 py-3 font-semibold">{libelle}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paroisses.map((paroisse) => (
                  <tr key={paroisse.id}>
                    <th scope="row" className="px-4 py-3 font-medium">{paroisse.nom}</th>
                    <td className="px-4 py-3">{paroisse.ville}</td>
                    <td className="px-4 py-3">{paroisse.actif ? 'Active' : 'Désactivée'}</td>
                    <td className="px-4 py-3">{paroisse.scouts.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3">{paroisse.utilisateurs.toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
