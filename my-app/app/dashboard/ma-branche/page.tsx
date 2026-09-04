'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'
import { formatMontantFCFA, anneeScolaireCourante } from '@/lib/cotisations'
import { ArrowRight, ICONES_TYPE_ACTIVITE } from '@/lib/icons'

interface Scout {
  id: string; prenom: string; nom: string; matricule: string | null; actif: boolean; photo: string | null
}
interface Activite {
  id: string; titre: string; type: string; dateDebut: string
}
interface Reunion {
  id: string; titre: string | null; dateHeure: string; dateReportee: string | null; statut: string
}
interface DocumentExpiration {
  id: string
}
interface Cotisation {
  statut: string; montant: number
}

export default function PageMaBranche() {
  const { data: session } = useSession()
  const [scouts, setScouts] = useState<Scout[]>([])
  const [activites, setActivites] = useState<Activite[]>([])
  const [prochaineReunion, setProchaineReunion] = useState<Reunion | null>(null)
  const [documentsARenouveler, setDocumentsARenouveler] = useState<DocumentExpiration[]>([])
  const [cotisationsEnAttente, setCotisationsEnAttente] = useState<Cotisation[]>([])
  const [brancheType, setBrancheType] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    // useSession() démarre en état 'loading' (session === undefined) : sans ce
    // garde, l'effet tournait une première fois sans utilisateur connu, ne
    // trouvait jamais le poste, et affichait une erreur qui restait bloquée
    // à l'écran même une fois la session résolue et les données chargées.
    if (!session?.user) return

    setErreur('')
    fetch('/api/me/branche')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { setErreur(data.erreur); return }
        if (!data.brancheType) { setErreur('Aucune branche assignée à votre compte'); setChargement(false); return }
        const type = data.brancheType
        setBrancheType(type)
        return Promise.all([
          fetch(`/api/scouts?limite=100`).then((r) => r.json()),
          fetch(`/api/activites?limite=10`).then((r) => r.json()),
          fetch('/api/reunions').then((r) => r.json()),
          fetch('/api/documents/expirations?joursAvant=30').then((r) => r.json()),
          fetch(`/api/cotisations?anneeScolaire=${anneeScolaireCourante()}`).then((r) => r.json()),
        ])
      })
      .then((results) => {
        if (!results) return
        const [scoutsData, activitesData, reunionsData, documentsData, cotisationsData] = results
        setScouts(scoutsData.scouts ?? [])
        setActivites(activitesData.activites ?? [])

        const maintenant = new Date()
        const aVenir = (reunionsData ?? [])
          .filter((r: Reunion) => (r.statut === 'PLANIFIEE' || r.statut === 'REPORTEE') && new Date(r.dateReportee ?? r.dateHeure) >= maintenant)
          .sort((a: Reunion, b: Reunion) => new Date(a.dateReportee ?? a.dateHeure).getTime() - new Date(b.dateReportee ?? b.dateHeure).getTime())
        setProchaineReunion(aVenir[0] ?? null)

        setDocumentsARenouveler(documentsData.documents ?? [])
        setCotisationsEnAttente((cotisationsData.cotisations ?? []).filter((c: Cotisation) => c.statut === 'EN_ATTENTE'))
      })
      .catch(() => setErreur('Impossible de charger les données'))
      .finally(() => setChargement(false))
  }, [session])

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[var(--cp)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erreur) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>

  const couleur = brancheType ? COULEURS_BRANCHES[brancheType] : 'bg-gray-100 text-gray-700'
  const [bgCls, textCls] = couleur.split(' ')
  const totalCotisationsDues = cotisationsEnAttente.reduce((s, c) => s + c.montant, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ma branche</h1>
        {brancheType && (
          <span className={`inline-block mt-1 text-sm font-medium px-3 py-0.5 rounded-full ${bgCls} ${textCls}`}>
            {LABELS_BRANCHES[brancheType] ?? brancheType}
          </span>
        )}
      </div>

      {/* Actions du jour */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href={prochaineReunion ? `/dashboard/reunions/${prochaineReunion.id}/presences` : '/dashboard/reunions'}
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[var(--cp)]/40 transition-colors"
        >
          <p className="text-xs font-medium text-gray-500">Prochaine réunion</p>
          {prochaineReunion ? (
            <>
              <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{prochaineReunion.titre ?? 'Réunion'}</p>
              <p className="inline-flex items-center gap-1 text-xs text-[var(--cp)] mt-0.5">
                {new Date(prochaineReunion.dateReportee ?? prochaineReunion.dateHeure).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}Prendre les présences <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Aucune réunion planifiée</p>
          )}
        </Link>

        <Link href="/dashboard/documents" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[var(--cp)]/40 transition-colors">
          <p className="text-xs font-medium text-gray-500">Documents à renouveler</p>
          <p className={`text-2xl font-bold mt-1 ${documentsARenouveler.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {documentsARenouveler.length}
          </p>
          {documentsARenouveler.length > 0 && (
            <p className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">À vérifier <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></p>
          )}
        </Link>

        <Link href="/dashboard/cotisations" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[var(--cp)]/40 transition-colors">
          <p className="text-xs font-medium text-gray-500">Cotisations en attente</p>
          <p className={`text-2xl font-bold mt-1 ${cotisationsEnAttente.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {cotisationsEnAttente.length}
          </p>
          {cotisationsEnAttente.length > 0 && (
            <p className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">{formatMontantFCFA(totalCotisationsDues)} dus <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></p>
          )}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liste des scouts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Scouts de ma branche ({scouts.length})</h2>
            <Link href="/dashboard/scouts" className="inline-flex items-center gap-1 text-xs text-[var(--cp)] hover:underline">Voir tout <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></Link>
          </div>
          {scouts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun scout dans cette branche</p>
          ) : (
            <div className="space-y-2">
              {scouts.slice(0, 12).map((s) => (
                <Link key={s.id} href={`/dashboard/scouts/${s.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0 overflow-hidden">
                    {s.photo ? <img src={s.photo} className="w-full h-full object-cover" alt="" /> : `${s.prenom[0]}${s.nom[0]}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.prenom} {s.nom}</p>
                    <p className="text-xs text-gray-400">{s.matricule ?? 'Sans matricule'}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${s.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.actif ? 'Actif' : 'Inactif'}
                  </span>
                </Link>
              ))}
              {scouts.length > 12 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{scouts.length - 12} autres</p>
              )}
            </div>
          )}
        </div>

        {/* Activités récentes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Activités récentes</h2>
            <Link href="/dashboard/activites" className="inline-flex items-center gap-1 text-xs text-[var(--cp)] hover:underline">Voir tout <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></Link>
          </div>
          {activites.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucune activité enregistrée</p>
          ) : (
            <div className="space-y-3">
              {activites.map((a) => (
                <Link key={a.id} href={`/dashboard/activites/${a.id}`}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-[var(--cp)]/10 flex items-center justify-center flex-shrink-0">
                    {(() => {
                      const IconeType = ICONES_TYPE_ACTIVITE[a.type] ?? ICONES_TYPE_ACTIVITE.AUTRE
                      return <IconeType className="h-4 w-4 text-[var(--cp)]" strokeWidth={2} />
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.titre}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}{LABELS_TYPE_ACTIVITE[a.type] ?? a.type}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
