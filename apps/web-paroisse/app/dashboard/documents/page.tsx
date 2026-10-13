'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_TYPE_DOCUMENT } from '@scout/shared'
import { LABELS_BRANCHES } from '@scout/shared'
import { ICONES_TYPE_DOCUMENT, CheckCircle2, Paperclip } from '@/lib/icons'
import { EmptyState } from '@/app/components/ui/EmptyState'

interface DocumentExpiration {
  id: string
  type: string
  nomFichier: string
  dateExpiration: string | null
  valide: boolean
  expire: boolean
  scout: { id: string; nom: string; prenom: string; matricule: string | null; brancheType: string }
}

function joursRestants(dateExpiration: string): number {
  const ms = new Date(dateExpiration).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export default function PageDocumentsExpirations() {
  const [documents, setDocuments] = useState<DocumentExpiration[]>([])
  const [joursAvant, setJoursAvant] = useState(30)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch(`/api/documents/expirations?joursAvant=${joursAvant}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) {
          toast.error(data.erreur)
          return
        }
        setDocuments(data.documents ?? [])
      })
      .catch(() => toast.error('Impossible de charger les documents'))
      .finally(() => setChargement(false))
  }, [joursAvant])

  const expires = documents.filter((d) => d.expire)
  const aVenir = documents.filter((d) => !d.expire)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Documents à renouveler</h1>
        <p className="mt-0.5 text-sm text-gray-500">Certificats médicaux et autres documents arrivant à expiration</p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Fenêtre de vigilance :</label>
          <select
            value={joursAvant}
            onChange={(e) => {
              setChargement(true)
              setJoursAvant(Number(e.target.value))
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-(--cp) focus:outline-none"
          >
            <option value={15}>15 jours</option>
            <option value={30}>30 jours</option>
            <option value={60}>60 jours</option>
            <option value={90}>90 jours</option>
          </select>
        </div>

        {chargement ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Aucun document à renouveler pour le moment." />
        ) : (
          <div className="space-y-6">
            {expires.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-red-700">Déjà expirés ({expires.length})</h2>
                {expires.map((d) => (
                  <LigneDocument key={d.id} doc={d} />
                ))}
              </div>
            )}
            {aVenir.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-amber-700">À renouveler bientôt ({aVenir.length})</h2>
                {aVenir.map((d) => (
                  <LigneDocument key={d.id} doc={d} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LigneDocument({ doc }: { doc: DocumentExpiration }) {
  const jours = doc.dateExpiration ? joursRestants(doc.dateExpiration) : null
  const IconeDocument = ICONES_TYPE_DOCUMENT[doc.type] ?? Paperclip
  return (
    <Link
      href={`/dashboard/scouts/${doc.scout.id}`}
      className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
        <IconeDocument className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {doc.scout.prenom} {doc.scout.nom}
        </p>
        <p className="text-xs text-gray-500">
          {LABELS_TYPE_DOCUMENT[doc.type] ?? doc.type} ·{' '}
          {LABELS_BRANCHES[doc.scout.brancheType] ?? doc.scout.brancheType}
          {doc.scout.matricule ? ` · ${doc.scout.matricule}` : ''}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${doc.expire ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
      >
        {doc.expire ? `Expiré depuis ${Math.abs(jours ?? 0)} j` : `Expire dans ${jours} j`}
      </span>
    </Link>
  )
}
