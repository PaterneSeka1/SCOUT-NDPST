'use client'

// Widgets flottants (activités, calendrier, documents), affichés en bas à
// droite du tableau de bord — même principe que le panneau de widgets de
// l'Intranet, réduit aux volets utiles au domaine scout : les prochaines
// activités de la paroisse, les événements à venir du mois (activités +
// réunions) et les documents arrivant à échéance (horloge/météo écartées,
// jugées sans valeur ajoutée ici). Le calendrier n'existe plus en page
// pleine largeur (/dashboard/calendrier supprimée) : ce widget en est
// l'unique point d'accès.
// Repose entièrement sur des routes déjà existantes (/api/dashboard/kpis,
// /api/calendrier, /api/documents/expirations) et sur les libellés déjà
// centralisés dans lib/ — aucune nouvelle route ni nouveau modèle de données.
import { useEffect, useLayoutEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_BRANCHES } from '@/lib/branches'
import { LABELS_TYPE_DOCUMENT } from '@/lib/documents'
import { ROLES_TOUT_STAFF } from '@/lib/roles'
import { ICONES_TYPE_ACTIVITE, ICONES_TYPE_DOCUMENT, ClipboardList, Clock, Paperclip } from '@/lib/icons'

type ActiviteWidget = {
  id: string
  titre: string
  dateDebut: string
  type: string
  brancheType: string | null
  lieu: string | null
  _count: { presences: number }
}

type DocumentEcheance = {
  id: string
  type: string
  dateExpiration: string | null
  expire: boolean
  scout: { id: string; nom: string; prenom: string; matricule: string | null; brancheType: string | null }
}

type EvenementCalendrier = {
  id: string
  source: 'activite' | 'reunion'
  titre: string
  debut: string
  lieu: string | null
  brancheType: string | null
  meta: string
}

const CLES_WIDGETS = ['activites', 'calendrier', 'documents'] as const
type CleWidget = (typeof CLES_WIDGETS)[number]

const LIBELLES_WIDGETS: Record<CleWidget, string> = {
  activites: 'Activités',
  calendrier: 'Calendrier',
  documents: 'Documents',
}

const VISIBILITE_DEFAUT: Record<CleWidget, boolean> = {
  activites: true,
  calendrier: true,
  documents: true,
}

// Format "YYYY-MM" attendu par /api/calendrier pour désigner le mois en cours.
function cleMoisCourant(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const CLE_STOCKAGE_VISIBILITE = 'sacci_widgets_visibles'

const CARTE = 'backdrop-blur-md bg-white/85 border border-gray-100/60 shadow-2xl rounded-2xl'

function formatDateCourt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function ActivitesWidget({ activites, sousTitre }: { activites: ActiviteWidget[]; sousTitre: string }) {
  return (
    <div className={`${CARTE} w-80 p-4 pointer-events-auto flex flex-col max-h-[min(60vh,26rem)]`}>
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activités</div>
          <div className="text-sm font-semibold text-gray-900">{sousTitre}</div>
        </div>
        <Link href="/dashboard" className="text-[11px] font-semibold hover:underline" style={{ color: 'var(--cp)' }}>
          Tableau de bord
        </Link>
      </div>

      {activites.length === 0 ? (
        <div className="text-xs text-gray-400 py-2">Aucune activité pour le moment.</div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1">
          {activites.map((a) => {
            const IconeActivite = ICONES_TYPE_ACTIVITE[a.type] ?? ClipboardList
            return (
            <div key={a.id} className="flex items-center gap-2.5 border-t border-gray-100 pt-2.5 first:border-t-0 first:pt-0">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(var(--cp-rgb), 0.1)', color: 'var(--cp)' }}
              >
                <IconeActivite className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-800 truncate">{a.titre}</div>
                <div className="text-[10px] text-gray-400 truncate">
                  {formatDateCourt(a.dateDebut)}
                  {a.lieu ? ` · ${a.lieu}` : ''}
                  {a.brancheType ? ` · ${LABELS_BRANCHES[a.brancheType] ?? a.brancheType}` : ''}
                </div>
              </div>
              <div className="text-[10px] text-gray-400 shrink-0">{LABELS_TYPE_ACTIVITE[a.type] ?? a.type}</div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatDateHeureCourt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const jour = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${jour} · ${heure}`
}

function CalendrierWidget({ evenements }: { evenements: EvenementCalendrier[] }) {
  return (
    <div className={`${CARTE} w-80 p-4 pointer-events-auto flex flex-col max-h-[min(60vh,26rem)]`}>
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Calendrier</div>
          <div className="text-sm font-semibold text-gray-900">Prochains événements</div>
        </div>
      </div>

      {evenements.length === 0 ? (
        <div className="text-xs text-gray-400 py-2">Aucun événement à venir ce mois-ci.</div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1">
          {evenements.map((e) => {
            const IconeEvenement = e.source === 'reunion' ? Clock : (ICONES_TYPE_ACTIVITE[e.meta] ?? ClipboardList)
            return (
              <div key={e.id} className="flex items-center gap-2.5 border-t border-gray-100 pt-2.5 first:border-t-0 first:pt-0">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(var(--cp-rgb), 0.1)', color: 'var(--cp)' }}
                >
                  <IconeEvenement className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-800 truncate">{e.titre}</div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {formatDateHeureCourt(e.debut)}
                    {e.lieu ? ` · ${e.lieu}` : ''}
                    {e.brancheType ? ` · ${LABELS_BRANCHES[e.brancheType] ?? e.brancheType}` : ''}
                  </div>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                    e.source === 'reunion' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}
                >
                  {e.source === 'reunion' ? 'Réunion' : 'Activité'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DocumentsWidget({ documents }: { documents: DocumentEcheance[] }) {
  const nbExpires = documents.filter((d) => d.expire).length

  return (
    <div className={`${CARTE} w-80 p-4 pointer-events-auto flex flex-col max-h-[min(60vh,26rem)]`}>
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Documents</div>
          <div className="text-sm font-semibold text-gray-900">Échéances sous 7 jours</div>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
            nbExpires > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {documents.length}
        </span>
      </div>

      {documents.length === 0 ? (
        <div className="text-xs text-gray-400 py-2">Aucun document à échéance proche.</div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1">
          {documents.map((d) => {
            const IconeDocument = ICONES_TYPE_DOCUMENT[d.type] ?? Paperclip
            return (
            <div key={d.id} className="flex items-center gap-2.5 border-t border-gray-100 pt-2.5 first:border-t-0 first:pt-0">
              <span className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                <IconeDocument className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-800 truncate">
                  {d.scout.prenom} {d.scout.nom}
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {LABELS_TYPE_DOCUMENT[d.type] ?? d.type}
                  {d.scout.matricule ? ` · ${d.scout.matricule}` : ''}
                </div>
              </div>
              <div className={`text-[10px] font-medium shrink-0 text-right ${d.expire ? 'text-red-600' : 'text-amber-600'}`}>
                {d.dateExpiration ? formatDateCourt(d.dateExpiration) : '—'}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Widgets({ role, paroisseId }: { role: string; paroisseId: string | null }) {
  const estStaff = ROLES_TOUT_STAFF.includes(role)
  const aUneParoisse = !!paroisseId

  const [visible, setVisible] = useState<Record<CleWidget, boolean>>(VISIBILITE_DEFAUT)
  const [activites, setActivites] = useState<ActiviteWidget[]>([])
  const [sousTitreActivites, setSousTitreActivites] = useState('Activités récentes')
  const [evenementsCalendrier, setEvenementsCalendrier] = useState<EvenementCalendrier[]>([])
  const [documents, setDocuments] = useState<DocumentEcheance[]>([])

  const clesDisponibles = CLES_WIDGETS.filter((cle) => {
    if (cle === 'activites') return aUneParoisse
    if (cle === 'calendrier') return estStaff
    if (cle === 'documents') return estStaff
    return true
  })

  useLayoutEffect(() => {
    try {
      const stocke = localStorage.getItem(CLE_STOCKAGE_VISIBILITE)
      if (stocke) setVisible({ ...VISIBILITE_DEFAUT, ...JSON.parse(stocke) })
    } catch {
      /* préférences par défaut conservées */
    }
  }, [])

  useEffect(() => {
    if (!aUneParoisse) return
    fetch('/api/dashboard/kpis')
      .then((r) => r.json())
      .then((d: { activitesRecentes?: ActiviteWidget[] }) => {
        setActivites(d.activitesRecentes ?? [])
        setSousTitreActivites(role === 'PARENT' ? 'Prochaines activités' : 'Activités récentes')
      })
      .catch(() => {
        /* widget activités reste utilisable, simplement vide */
      })
  }, [aUneParoisse, role])

  useEffect(() => {
    if (!estStaff) return
    fetch(`/api/calendrier?mois=${cleMoisCourant()}`)
      .then((r) => r.json())
      .then((d: { evenements?: EvenementCalendrier[] }) => {
        const maintenant = Date.now()
        const aVenir = (d.evenements ?? [])
          .filter((e) => new Date(e.debut).getTime() >= maintenant)
          .slice(0, 6)
        setEvenementsCalendrier(aVenir)
      })
      .catch(() => {
        /* widget calendrier reste masquable si l'appel échoue */
      })
  }, [estStaff])

  useEffect(() => {
    if (!estStaff) return
    fetch('/api/documents/expirations?joursAvant=7')
      .then((r) => r.json())
      .then((d: { documents?: DocumentEcheance[] }) => setDocuments(d.documents ?? []))
      .catch(() => {
        /* widget documents reste masquable si l'appel échoue */
      })
  }, [estStaff])

  function basculerWidget(cle: CleWidget) {
    setVisible((prec) => {
      const suivant = { ...prec, [cle]: !prec[cle] }
      try {
        localStorage.setItem(CLE_STOCKAGE_VISIBILITE, JSON.stringify(suivant))
      } catch {
        /* préférence non persistée, sans conséquence */
      }
      return suivant
    })
  }

  if (clesDisponibles.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 hidden lg:flex flex-col items-end gap-2 pointer-events-none print:hidden">
      {/* Bascules d'affichage */}
      {clesDisponibles.length > 1 && (
        <div className="flex gap-1.5 pointer-events-auto flex-wrap justify-end">
          {clesDisponibles.map((cle) => (
            <button
              key={cle}
              onClick={() => basculerWidget(cle)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all backdrop-blur-sm shadow-md border ${
                visible[cle] ? 'text-white border-transparent' : 'bg-white/70 border-gray-200/50 text-gray-500 hover:bg-white/90'
              }`}
              style={visible[cle] ? { backgroundColor: 'var(--cp)' } : undefined}
            >
              {LIBELLES_WIDGETS[cle]}
            </button>
          ))}
        </div>
      )}

      {clesDisponibles.includes('activites') && visible.activites && (
        <ActivitesWidget activites={activites} sousTitre={sousTitreActivites} />
      )}

      {clesDisponibles.includes('calendrier') && visible.calendrier && (
        <CalendrierWidget evenements={evenementsCalendrier} />
      )}

      {clesDisponibles.includes('documents') && visible.documents && <DocumentsWidget documents={documents} />}
    </div>
  )
}
