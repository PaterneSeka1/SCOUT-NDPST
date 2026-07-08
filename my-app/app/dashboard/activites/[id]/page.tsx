'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useActivite, useSupprimerActivite } from '@/hooks/useActivites'
import { LABELS_TYPE_ACTIVITE, COULEURS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import { confirmer } from '@/app/components/ConfirmDialog'

export default function PageDetailActivite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: activite, isLoading } = useActivite(id)
  const supprimerActivite = useSupprimerActivite()

  function formaterDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  async function handleSupprimer() {
    if (!activite) return
    const ok = await confirmer({
      titre: `Supprimer l'activité "${activite.titre}" ?`,
      description: 'Cette activité et toutes les présences qui y sont enregistrées seront définitivement supprimées. Cette action est irréversible.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimerActivite.mutateAsync(id)
      router.push('/dashboard/activites')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-gray-500">
        Chargement de l&apos;activité...
      </div>
    )
  }

  if (!activite) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-red-600 font-medium">Activité introuvable</p>
        <Link href="/dashboard/activites" className="text-sm text-[#1a4731] hover:underline mt-2 inline-block">
          Retour aux activités
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/activites"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Retour
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{activite.titre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_TYPE_ACTIVITE[activite.type] ?? 'bg-gray-100 text-gray-700'}`}>
                {LABELS_TYPE_ACTIVITE[activite.type] ?? activite.type}
              </span>
              {activite.brancheType && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_BRANCHES[activite.brancheType] ?? 'bg-gray-100 text-gray-700'}`}>
                  {LABELS_BRANCHES[activite.brancheType] ?? activite.brancheType}
                </span>
              )}
              {!activite.brancheType && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  Inter-branches
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/dashboard/activites/${id}/presences`}
            className="inline-flex items-center gap-1 bg-[#1a4731] text-white px-3 py-2 rounded-lg hover:bg-[#15392a] transition-colors text-sm font-medium"
          >
            Gérer les présences
          </Link>
          <Link
            href={`/dashboard/activites/${id}/modifier`}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Modifier
          </Link>
          <button
            onClick={handleSupprimer}
            disabled={supprimerActivite.isPending}
            className="px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      </div>

      {/* Infos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Informations</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Date de début</p>
            <p className="text-sm font-medium text-gray-900">{formaterDate(activite.dateDebut)}</p>
          </div>
          {activite.dateFin && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Date de fin</p>
              <p className="text-sm font-medium text-gray-900">{formaterDate(activite.dateFin)}</p>
            </div>
          )}
          {activite.lieu && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Lieu</p>
              <p className="text-sm font-medium text-gray-900">{activite.lieu}</p>
            </div>
          )}
        </div>

        {activite.description && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{activite.description}</p>
          </div>
        )}
      </div>

      {/* Résumé présences */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Présences</h2>
          <Link
            href={`/dashboard/activites/${id}/presences`}
            className="text-sm text-[#1a4731] hover:underline font-medium"
          >
            Voir la feuille →
          </Link>
        </div>

        {activite._count.presences === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">Aucune présence enregistrée</p>
            <Link
              href={`/dashboard/activites/${id}/presences`}
              className="inline-flex items-center gap-1 mt-2 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#15392a] transition-colors text-sm font-medium"
            >
              Prendre les présences
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-[#1a4731]">{activite._count.presences}</div>
            <div className="text-sm text-gray-600">présence(s) enregistrée(s)</div>
          </div>
        )}
      </div>
    </div>
  )
}
