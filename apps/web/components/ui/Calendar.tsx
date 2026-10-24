'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from '@/lib/icons'

export interface EvenementCalendrier {
  id: string
  titre: string
  date: Date
  href?: string
  ton?: 'primaire' | 'accent' | 'neutre'
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const TONS = {
  primaire: 'bg-foret-50 text-foret-700',
  accent: 'bg-terracotta-50 text-terracotta-700',
  neutre: 'bg-stone-100 text-stone-700',
}

function cleJour(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** Calendrier mensuel (semaine du lundi), liste d'événements sur mobile. */
export function Calendar({
  mois,
  onMois,
  evenements,
}: {
  mois: Date
  onMois: (mois: Date) => void
  evenements: EvenementCalendrier[]
}) {
  const jours = useMemo(() => {
    const premier = new Date(mois.getFullYear(), mois.getMonth(), 1)
    const decalage = (premier.getDay() + 6) % 7
    const debut = new Date(premier)
    debut.setDate(premier.getDate() - decalage)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(debut)
      d.setDate(debut.getDate() + i)
      return d
    })
  }, [mois])

  const parJour = useMemo(() => {
    const index = new Map<string, EvenementCalendrier[]>()
    for (const e of evenements) {
      const cle = cleJour(e.date)
      index.set(cle, [...(index.get(cle) ?? []), e])
    }
    return index
  }, [evenements])

  const aujourdhui = cleJour(new Date())
  const titre = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(mois)
  const changer = (delta: number) => onMois(new Date(mois.getFullYear(), mois.getMonth() + delta, 1))
  const duMois = evenements
    .filter((e) => e.date.getMonth() === mois.getMonth() && e.date.getFullYear() === mois.getFullYear())
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900 capitalize">{titre}</h2>
        <div className="flex gap-1">
          <button type="button" onClick={() => changer(-1)} className="rounded-lg border border-stone-300 p-1.5 hover:bg-stone-50" aria-label="Mois précédent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMois(new Date())} className="rounded-lg border border-stone-300 px-3 text-sm hover:bg-stone-50">
            Aujourd’hui
          </button>
          <button type="button" onClick={() => changer(1)} className="rounded-lg border border-stone-300 p-1.5 hover:bg-stone-50" aria-label="Mois suivant">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
        <div className="grid grid-cols-7 bg-stone-50 text-center text-xs font-medium text-stone-500">
          {JOURS.map((j) => (
            <div key={j} className="py-2">
              {j}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {jours.map((d) => {
            const horsMois = d.getMonth() !== mois.getMonth()
            const evts = parJour.get(cleJour(d)) ?? []
            return (
              <div key={d.toISOString()} className={`min-h-24 border-t border-l border-stone-100 p-1.5 first:border-l-0 ${horsMois ? 'bg-stone-50/60' : 'bg-white'}`}>
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    cleJour(d) === aujourdhui ? 'bg-primaire font-semibold text-white' : horsMois ? 'text-stone-400' : 'text-stone-700'
                  }`}
                >
                  {d.getDate()}
                </span>
                <ul className="mt-1 space-y-1">
                  {evts.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <a href={e.href} title={e.titre} className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${TONS[e.ton ?? 'primaire']}`}>
                        {e.titre}
                      </a>
                    </li>
                  ))}
                  {evts.length > 3 && <li className="px-1 text-[11px] text-stone-500">+{evts.length - 3}</li>}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      <ul className="space-y-2 md:hidden">
        {duMois.length === 0 && <li className="py-6 text-center text-sm text-stone-500">Aucun événement ce mois-ci.</li>}
        {duMois.map((e) => (
          <li key={e.id}>
            <a href={e.href} className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3">
              <span className="w-12 shrink-0 text-center text-sm font-semibold text-primaire">{e.date.getDate()}</span>
              <span className="min-w-0 truncate text-sm text-stone-800">{e.titre}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
