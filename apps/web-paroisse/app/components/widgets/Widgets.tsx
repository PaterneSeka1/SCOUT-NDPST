'use client'

// Widgets flottants (activités, documents), affichés en bas à droite du
// tableau de bord — même principe que le panneau de widgets de l'Intranet,
// réduit aux deux volets utiles au domaine scout : les prochaines activités
// de la paroisse et les documents arrivant à échéance (horloge/calendrier/
// météo écartés, jugés sans valeur ajoutée ici).
// Repose entièrement sur des routes déjà existantes (/api/dashboard/kpis,
// /api/documents/expirations) et sur les libellés déjà centralisés dans lib/
// — aucune nouvelle route ni nouveau modèle de données.
import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { LABELS_BRANCHES } from '@scout/shared'
import { LABELS_TYPE_DOCUMENT } from '@scout/shared'
import { ROLES_TOUT_STAFF } from '@scout/shared'
import { PERIMETRE_V1 } from '@scout/shared'
import { ICONES_TYPE_ACTIVITE, ICONES_TYPE_DOCUMENT, ClipboardList, Paperclip } from '@/lib/icons'

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

const CLES_WIDGETS = ['activites', 'documents'] as const
type CleWidget = (typeof CLES_WIDGETS)[number]

const LIBELLES_WIDGETS: Record<CleWidget, string> = {
  activites: 'Activités',
  documents: 'Documents',
}

const VISIBILITE_DEFAUT: Record<CleWidget, boolean> = {
  activites: true,
  documents: true,
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
    <div className={`${CARTE} pointer-events-auto flex max-h-[min(60vh,26rem)] w-80 flex-col p-4`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Activités</div>
          <div className="text-sm font-semibold text-gray-900">{sousTitre}</div>
        </div>
        <Link href="/dashboard" className="text-[11px] font-semibold hover:underline" style={{ color: 'var(--cp)' }}>
          Tableau de bord
        </Link>
      </div>

      {activites.length === 0 ? (
        <div className="py-2 text-xs text-gray-400">Aucune activité pour le moment.</div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1">
          {activites.map((a) => {
            const IconeActivite = ICONES_TYPE_ACTIVITE[a.type] ?? ClipboardList
            return (
              <div
                key={a.id}
                className="flex items-center gap-2.5 border-t border-gray-100 pt-2.5 first:border-t-0 first:pt-0"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(var(--cp-rgb), 0.1)', color: 'var(--cp)' }}
                >
                  <IconeActivite className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-gray-800">{a.titre}</div>
                  <div className="truncate text-[10px] text-gray-400">
                    {formatDateCourt(a.dateDebut)}
                    {a.lieu ? ` · ${a.lieu}` : ''}
                    {a.brancheType ? ` · ${LABELS_BRANCHES[a.brancheType] ?? a.brancheType}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-[10px] text-gray-400">{LABELS_TYPE_ACTIVITE[a.type] ?? a.type}</div>
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
    <div className={`${CARTE} pointer-events-auto flex max-h-[min(60vh,26rem)] w-80 flex-col p-4`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Documents</div>
          <div className="text-sm font-semibold text-gray-900">Échéances sous 7 jours</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            nbExpires > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {documents.length}
        </span>
      </div>

      {documents.length === 0 ? (
        <div className="py-2 text-xs text-gray-400">Aucun document à échéance proche.</div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1">
          {documents.map((d) => {
            const IconeDocument = ICONES_TYPE_DOCUMENT[d.type] ?? Paperclip
            return (
              <div
                key={d.id}
                className="flex items-center gap-2.5 border-t border-gray-100 pt-2.5 first:border-t-0 first:pt-0"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500">
                  <IconeDocument className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-gray-800">
                    {d.scout.prenom} {d.scout.nom}
                  </div>
                  <div className="truncate text-[10px] text-gray-400">
                    {LABELS_TYPE_DOCUMENT[d.type] ?? d.type}
                    {d.scout.matricule ? ` · ${d.scout.matricule}` : ''}
                  </div>
                </div>
                <div
                  className={`shrink-0 text-right text-[10px] font-medium ${d.expire ? 'text-red-600' : 'text-amber-600'}`}
                >
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

const subscribeHydratation = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function Widgets(props: { role: string; paroisseId: string | null }) {
  const hydrate = useSyncExternalStore(subscribeHydratation, getClientSnapshot, getServerSnapshot)
  return hydrate ? <WidgetsClient key={props.paroisseId} {...props} /> : null
}

function WidgetsClient({ role, paroisseId }: { role: string; paroisseId: string | null }) {
  // Documents hors périmètre V1 (voir lib/perimetreV1.ts) : widget masqué.
  const estStaff = ROLES_TOUT_STAFF.includes(role) && !PERIMETRE_V1
  const aUneParoisse = !!paroisseId

  const [visible, setVisible] = useState<Record<CleWidget, boolean>>(() => {
    try {
      const stocke = localStorage.getItem(CLE_STOCKAGE_VISIBILITE)
      return stocke ? { ...VISIBILITE_DEFAUT, ...JSON.parse(stocke) } : VISIBILITE_DEFAUT
    } catch {
      return VISIBILITE_DEFAUT
    }
  })
  const [activites, setActivites] = useState<ActiviteWidget[]>([])
  const [sousTitreActivites, setSousTitreActivites] = useState('Activités récentes')
  const [documents, setDocuments] = useState<DocumentEcheance[]>([])

  const clesDisponibles = CLES_WIDGETS.filter((cle) => {
    if (cle === 'activites') return aUneParoisse
    if (cle === 'documents') return estStaff
    return true
  })

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
    <div className="pointer-events-none fixed right-6 bottom-6 z-40 hidden flex-col items-end gap-2 lg:flex print:hidden">
      {/* Bascules d'affichage */}
      {clesDisponibles.length > 1 && (
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
          {clesDisponibles.map((cle) => (
            <button
              key={cle}
              onClick={() => basculerWidget(cle)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-md backdrop-blur-sm transition-all ${
                visible[cle]
                  ? 'border-transparent text-white'
                  : 'border-gray-200/50 bg-white/70 text-gray-500 hover:bg-white/90'
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

      {clesDisponibles.includes('documents') && visible.documents && <DocumentsWidget documents={documents} />}
    </div>
  )
}
