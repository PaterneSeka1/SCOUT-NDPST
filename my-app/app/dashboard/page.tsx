'use client'

import { useSession } from 'next-auth/react'

type StatCard = {
  titre: string
  valeur: number | string
  icone: string
  couleur: string
}

const cardsAdmin: StatCard[] = [
  { titre: 'Scouts actifs', valeur: 0, icone: '⚜️', couleur: 'bg-[#1a4731]' },
  { titre: 'Activités ce mois', valeur: 0, icone: '📅', couleur: 'bg-[#27ae60]' },
  { titre: 'Taux de présence', valeur: '0 %', icone: '✅', couleur: 'bg-[#f39c12]' },
  { titre: 'Branches actives', valeur: 0, icone: '🌿', couleur: 'bg-blue-600' },
]

const cardsGroupe: StatCard[] = [
  { titre: 'Scouts actifs', valeur: 0, icone: '⚜️', couleur: 'bg-[#1a4731]' },
  { titre: 'Activités ce mois', valeur: 0, icone: '📅', couleur: 'bg-[#27ae60]' },
  { titre: 'Branches', valeur: 0, icone: '🌿', couleur: 'bg-[#f39c12]' },
]

const cardsBranche: StatCard[] = [
  { titre: 'Scouts dans la branche', valeur: 0, icone: '⚜️', couleur: 'bg-[#1a4731]' },
  { titre: 'Activités ce mois', valeur: 0, icone: '📅', couleur: 'bg-[#27ae60]' },
  { titre: 'Présences ce mois', valeur: 0, icone: '✅', couleur: 'bg-[#f39c12]' },
]

const cardsParent: StatCard[] = [
  { titre: 'Mes enfants', valeur: 0, icone: '👨‍👧‍👦', couleur: 'bg-[#1a4731]' },
  { titre: 'Prochaines activités', valeur: 0, icone: '📅', couleur: 'bg-[#27ae60]' },
]

const cardsScout: StatCard[] = [
  { titre: 'Badges obtenus', valeur: 0, icone: '🏅', couleur: 'bg-[#1a4731]' },
  { titre: 'Activités participées', valeur: 0, icone: '📅', couleur: 'bg-[#27ae60]' },
]

function getCards(role: string): StatCard[] {
  if (role === 'ADMIN_PAROISSE') return cardsAdmin
  if (['CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE'].includes(role)) return cardsGroupe
  if (['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE'].includes(role)) return cardsBranche
  if (role === 'PARENT') return cardsParent
  if (role === 'SCOUT') return cardsScout
  return cardsAdmin
}

function libelleRole(role: string): string {
  const libelles: Record<string, string> = {
    ADMIN_PAROISSE: 'Administrateur de paroisse',
    CHEF_GROUPE: 'Chef de groupe',
    ADJOINT_GROUPE: 'Adjoint de groupe',
    ASSISTANT_GROUPE: 'Assistant de groupe',
    RESPONSABLE_BRANCHE: 'Responsable de branche',
    ADJOINT_BRANCHE: 'Adjoint de branche',
    ASSISTANT_BRANCHE: 'Assistant de branche',
    PARENT: 'Parent',
    SCOUT: 'Scout',
  }
  return libelles[role] ?? role
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const cards = getCards(role)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-xl font-bold text-[#1a4731]">
          Bienvenue, {session?.user?.prenom} {session?.user?.nom} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Profil : <span className="font-medium text-[#27ae60]">{libelleRole(role)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.titre}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4"
          >
            <div
              className={`w-12 h-12 ${card.couleur} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}
            >
              {card.icone}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{card.valeur}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.titre}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Activités récentes</h2>
        <p className="text-sm text-gray-400 text-center py-8">
          Aucune activité récente pour le moment.
        </p>
      </div>
    </div>
  )
}
