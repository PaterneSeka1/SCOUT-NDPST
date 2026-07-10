'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_ROLES, COULEURS_ROLES, ROLES_ASSIGNABLES_PAROISSE, libelleRoleAvecFonction } from '@/lib/roles'

interface UtilisateurListe {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
  role: string
  fonction: string | null
  brancheType: string | null
  actif: boolean
  createdAt: string
  paroisse: { id: string; nom: string }
}

interface ParoisseOption {
  id: string
  nom: string
  ville: string
  diocese: string
  actif: boolean
}

const ROLES_FILTRE = ROLES_ASSIGNABLES_PAROISSE

export default function UtilisateursPlateformePage() {
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurListe[]>([])
  const [paroisses, setParoisses] = useState<ParoisseOption[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [chargement, setChargement] = useState(true)

  const [recherche, setRecherche] = useState('')
  const [rechercheDebounce, setRechercheDebounce] = useState('')
  const [roleFiltre, setRoleFiltre] = useState('')
  const [paroisseFiltre, setParoisseFiltre] = useState('')
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleRechercheChange = (valeur: string) => {
    setRecherche(valeur)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => { setRechercheDebounce(valeur); setPage(1) }, 300)
    setDebounceTimer(timer)
  }

  useEffect(() => {
    fetch('/api/admin/paroisses')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then(setParoisses)
      .catch(() => toast.error('Impossible de charger la liste des paroisses.'))
  }, [])

  const charger = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (rechercheDebounce) params.set('recherche', rechercheDebounce)
    if (roleFiltre) params.set('role', roleFiltre)
    if (paroisseFiltre) params.set('paroisseId', paroisseFiltre)

    fetch(`/api/admin/utilisateurs?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data) => {
        setUtilisateurs(data.utilisateurs)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      })
      .catch(() => toast.error('Impossible de charger les utilisateurs.'))
      .finally(() => setChargement(false))
  }, [page, rechercheDebounce, roleFiltre, paroisseFiltre])

  useEffect(() => { charger() }, [charger])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} utilisateur{total !== 1 ? 's' : ''} sur l&apos;ensemble des paroisses
          </p>
        </div>
        <Link
          href="/admin/utilisateurs/nouveau"
          className="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 transition"
          style={{ backgroundColor: 'var(--cp)' }}
        >
          + Nouvel utilisateur
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Rechercher (nom, prénom, matricule)…"
          value={recherche}
          onChange={(e) => handleRechercheChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        />
        <select
          value={roleFiltre}
          onChange={(e) => { setRoleFiltre(e.target.value); setPage(1) }}
          className="sm:w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        >
          <option value="">Tous les rôles</option>
          {ROLES_FILTRE.map((role) => (
            <option key={role} value={role}>{LABELS_ROLES[role]}</option>
          ))}
        </select>
        <select
          value={paroisseFiltre}
          onChange={(e) => { setParoisseFiltre(e.target.value); setPage(1) }}
          className="sm:w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        >
          <option value="">Toutes les paroisses</option>
          {paroisses.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nom / Prénom</th>
                <th className="px-4 py-3">Paroisse</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Matricule / Téléphone</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {utilisateurs.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => (window.location.href = `/admin/utilisateurs/${u.id}`)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.nom} {u.prenom}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{u.paroisse.nom}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      COULEURS_ROLES[u.role] ?? 'bg-gray-100 text-gray-700'
                    }`}>
                      {libelleRoleAvecFonction(u.role, u.fonction, u.brancheType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {u.matricule ? <span className="font-mono">{u.matricule}</span> : (u.telephone ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                </tr>
              ))}
              {utilisateurs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucun utilisateur trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-gray-500">
            {total} utilisateur{total !== 1 ? 's' : ''} — p. {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-colors hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-colors hover:bg-gray-50"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
