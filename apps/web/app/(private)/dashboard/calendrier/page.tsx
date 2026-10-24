'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES, LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { ErreurApi } from '@/lib/api'
import { accentBranche } from '@/lib/branches-visuel'
import { CalendarDays, MapPin } from '@/lib/icons'
import { cleMois, useEvenementsCalendrier, useLienAbonnementCalendrier, useRevoquerAbonnementCalendrier, type EvenementAgenda } from '@/hooks/useCalendrier'
import { Button, Calendar, EmptyState, ErrorState, PageHeader, Skeleton, confirmer } from '@/components/ui'

const FORMAT_JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const FORMAT_HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const FORMAT_MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

const lien = (e: EvenementAgenda) => (e.source === 'activite' ? `/dashboard/activites/${e.id}` : `/dashboard/reunions/${e.id}/presences`)

function Abonnement() {
  const [url, setUrl] = useState<string | null>(null)
  const generer = useLienAbonnementCalendrier()
  const revoquer = useRevoquerAbonnementCalendrier()

  async function obtenir() {
    try {
      setUrl((await generer.mutateAsync()).url)
    } catch (err) {
      toast.error(err instanceof ErreurApi ? err.message : 'Lien indisponible.')
    }
  }
  async function copier() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Lien copié.')
    } catch {
      toast.error('Copie impossible : sélectionnez le lien manuellement.')
    }
  }
  async function annuler() {
    if (!(await confirmer({ titre: 'Révoquer le lien d’abonnement ?', description: 'Les agendas déjà abonnés cesseront de se mettre à jour.', labelConfirmer: 'Révoquer', danger: true }))) return
    try {
      await revoquer.mutateAsync()
      setUrl(null)
      toast.success('Lien révoqué.')
    } catch (err) {
      toast.error(err instanceof ErreurApi ? err.message : 'Révocation impossible.')
    }
  }

  return (
    <section aria-labelledby="titre-abonnement" className="rounded-lg border border-ligne bg-white p-5">
      <h2 id="titre-abonnement" className="font-semibold text-encre">
        Synchroniser avec votre agenda
      </h2>
      <p className="mt-1 text-sm text-encre-douce">Un lien personnel (iCal) pour retrouver activités et réunions dans votre téléphone. Ne le partagez pas.</p>
      {url ? (
        <div className="mt-3 space-y-2">
          <label htmlFor="lien-ical" className="sr-only">
            Lien d’abonnement
          </label>
          <input id="lien-ical" readOnly value={url} onFocus={(e) => e.target.select()} className="w-full rounded-md border border-ligne bg-papier px-3 py-2 font-mono text-xs text-encre" />
          <div className="flex flex-wrap gap-2">
            <Button taille="sm" onClick={() => void copier()}>
              Copier le lien
            </Button>
            <Button taille="sm" variante="fantome" chargement={revoquer.isPending} onClick={() => void annuler()}>
              Révoquer
            </Button>
          </div>
        </div>
      ) : (
        <Button taille="sm" variante="secondaire" className="mt-3" chargement={generer.isPending} onClick={() => void obtenir()}>
          Obtenir mon lien
        </Button>
      )}
    </section>
  )
}

export default function PageCalendrier() {
  const [mois, setMois] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const requete = useEvenementsCalendrier(cleMois(mois))
  const evenements = [...(requete.data?.evenements ?? [])].sort((a, b) => a.debut.localeCompare(b.debut))

  return (
    <div>
      <PageHeader
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Calendrier' }]}
        titre="Calendrier"
        description="Activités et réunions du groupe, selon votre périmètre."
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          {requete.isError ? (
            <ErrorState message={requete.error.message} onReessayer={() => void requete.refetch()} className="rounded-lg border border-ligne bg-white" />
          ) : (
            <div className={`rounded-lg border border-ligne bg-white p-4 transition ${requete.isFetching ? 'opacity-70' : ''}`} aria-busy={requete.isFetching}>
              <Calendar
                mois={mois}
                onMois={setMois}
                evenements={evenements.map((e) => ({ id: `${e.source}-${e.id}`, titre: e.titre, date: new Date(e.debut), href: lien(e), ton: e.source === 'activite' ? 'accent' : 'primaire' }))}
              />
            </div>
          )}
        </div>
        <aside className="space-y-6 xl:col-span-4">
          <section aria-labelledby="titre-mois" className="rounded-lg border border-ligne bg-white">
            <h2 id="titre-mois" className="border-b border-ligne px-5 py-3.5 font-semibold text-encre first-letter:uppercase">
              {FORMAT_MOIS.format(mois)}
            </h2>
            {requete.isPending ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : evenements.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Rien de prévu ce mois-ci." />
            ) : (
              <ul className="max-h-[32rem] divide-y divide-ligne overflow-y-auto">
                {evenements.map((e) => (
                  <li key={`${e.source}-${e.id}`}>
                    <Link href={lien(e)} className="flex gap-3 px-5 py-3 hover:bg-papier">
                      <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: accentBranche(e.brancheType) }} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm text-encre-pale first-letter:uppercase">
                          {FORMAT_JOUR.format(new Date(e.debut))} · {FORMAT_HEURE.format(new Date(e.debut))}
                        </span>
                        <span className="block font-medium text-encre">{e.titre}</span>
                        <span className="text-sm text-encre-douce">
                          {e.source === 'activite' ? (LABELS_TYPE_ACTIVITE[e.meta] ?? 'Activité') : 'Réunion'} ·{' '}
                          {e.brancheType ? LABELS_BRANCHES[e.brancheType] : 'Tout le groupe'}
                        </span>
                        {e.lieu && (
                          <span className="mt-0.5 flex items-center gap-1 text-sm text-encre-pale">
                            <MapPin className="h-3.5 w-3.5" aria-hidden />
                            {e.lieu}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Abonnement />
        </aside>
      </div>
    </div>
  )
}
