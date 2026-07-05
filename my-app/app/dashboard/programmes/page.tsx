'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'

const BRANCHES: Record<string, string> = {
  OISILLONS: 'Oisillons', LOUVETEAUX: 'Louveteaux', ECLAIREURS: 'Éclaireurs',
  CHEMINOTS: 'Cheminots', COMPAGNONS: 'Compagnons',
}
const COULEURS_BRANCHE: Record<string, string> = {
  OISILLONS: 'bg-yellow-100 text-yellow-800',
  LOUVETEAUX: 'bg-blue-100 text-blue-800',
  ECLAIREURS: 'bg-green-100 text-green-800',
  CHEMINOTS: 'bg-orange-100 text-orange-800',
  COMPAGNONS: 'bg-purple-100 text-purple-800',
}

const ROLES_GROUPE = ['ADMIN_PAROISSE', 'CHEF_GROUPE']
const ROLES_BRANCHE = ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']

interface Programme {
  id: string
  titre: string
  description: string | null
  periodeDebut: string
  periodeFin: string
  brancheType: string | null
  _count: { lignes: number }
  creeParUtilisateur: { prenom: string; nom: string }
}

function formatPeriode(debut: string, fin: string) {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
  return `${new Date(debut).toLocaleDateString('fr-FR', opts)} → ${new Date(fin).toLocaleDateString('fr-FR', opts)}`
}

export default function PageProgrammes() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const estGroupe = ROLES_GROUPE.includes(role)
  const estBranche = ROLES_BRANCHE.includes(role)
  const peutCreer = estGroupe || estBranche

  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/programmes')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { toast.error(data.erreur); return }
        setProgrammes(data)
      })
      .catch(() => toast.error('Impossible de charger les programmes'))
      .finally(() => setChargement(false))
  }, [])

  const programmeGroupe = programmes.filter((p) => !p.brancheType)
  const programmesBranches = programmes.filter((p) => p.brancheType)

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Programmes d'activités</h1>
          <p className="text-sm text-gray-500 mt-0.5">Programme du groupe et programmes propres à chaque branche</p>
        </div>
        {peutCreer && (
          <Link href="/dashboard/programmes/nouveau"
            className="flex-shrink-0 flex items-center gap-1.5 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau programme
          </Link>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Programme du groupe</h2>
        {programmeGroupe.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun programme de groupe</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programmeGroupe.map((p) => <CarteProgramme key={p.id} programme={p} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Programmes des branches</h2>
        {programmesBranches.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun programme de branche</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programmesBranches.map((p) => <CarteProgramme key={p.id} programme={p} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function CarteProgramme({ programme: p }: { programme: Programme }) {
  return (
    <Link href={`/dashboard/programmes/${p.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:border-[#1a4731]/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{p.titre}</p>
            {p.brancheType ? (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${COULEURS_BRANCHE[p.brancheType] ?? 'bg-gray-100 text-gray-600'}`}>
                {BRANCHES[p.brancheType]}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 bg-gray-100 text-gray-600">Groupe</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{formatPeriode(p.periodeDebut, p.periodeFin)}</p>
          {p.description && <p className="text-xs text-gray-400 mt-1 truncate">{p.description}</p>}
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-xs font-medium text-gray-500">{p._count.lignes} thème{p._count.lignes !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </Link>
  )
}
