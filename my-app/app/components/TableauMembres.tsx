'use client'

import Link from 'next/link'
import { COULEURS_ROLES, libelleRoleAvecFonction } from '@/lib/roles'

// Bloc partagé entre app/admin/districts/[id]/page.tsx et
// app/admin/paroisses/[id]/page.tsx : barre de recherche + filtre profil
// (+ filtre supplémentaire optionnel) + tableau desktop / cartes mobile +
// pagination des membres. Les deux pages géraient auparavant une copie quasi
// identique de ce bloc (mêmes classes Tailwind, même formules de pagination),
// avec deux différences réelles :
//  - le district affiche une colonne/valeur "Paroisse" (plusieurs paroisses
//    par district) que la fiche paroisse n'a pas besoin d'afficher ;
//  - le 3e filtre de la barre change de nature : sélection de paroisse côté
//    district, sélection de statut (actif/inactif) côté paroisse — d'où le
//    filtre supplémentaire générique plutôt qu'un filtre "paroisse" en dur.
//
// Le filtrage métier (recherche texte + prédicats de profil) reste dans
// chaque page appelante (les règles de rôles diffèrent), ce composant ne fait
// que la pagination + le rendu sur la liste déjà filtrée.

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'

const OPTIONS_MEMBRES_PAR_PAGE = [10, 20, 50]

/** Enlève les accents et met en minuscule — utilisé par les pages appelantes pour construire le texte de recherche normalisé de chaque membre avant de le comparer à `recherche`. */
export function normaliser(valeur: string): string {
  return valeur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export interface MembreTableauBase {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
  actif: boolean
  role: string
  fonction: string | null
  brancheType: string | null
  roleDistrict: string | null
  fonctionDistrict: string | null
  brancheTypeDistrict: string | null
}

export interface OptionFiltreMembre {
  value: string
  label: string
}

export interface FiltreMembresSupplementaire {
  /** Valeur sélectionnée ; chaîne vide = aucun filtre actif. */
  value: string
  onChange: (valeur: string) => void
  /** Options du <select>, hors option "toutes/tous" par défaut. */
  options: OptionFiltreMembre[]
  /** Libellé de l'option par défaut (ex. "Toutes les paroisses", "Tous les statuts"). */
  labelParDefaut: string
}

export interface TableauMembresProps<T extends MembreTableauBase> {
  /** Titre affiché au-dessus de la barre de recherche (ex. "Membres du district"). */
  titre: string
  /**
   * Liste des membres déjà filtrée par la page appelante (recherche + profil
   * + filtre supplémentaire). Ce composant ne pagine QUE cette liste, il ne
   * refait pas le filtrage.
   */
  membresFiltres: T[]
  /** Nombre total de membres non filtrés, pour l'indicateur "X résultats sur Y comptes". */
  totalMembres: number

  recherche: string
  onChangeRecherche: (valeur: string) => void

  profil: string
  onChangeProfil: (valeur: string) => void
  /** Options du filtre "profil" — le contenu diffère entre district et paroisse. */
  profils: OptionFiltreMembre[]

  /**
   * Filtre optionnel occupant le 3e emplacement de la grille (entre le profil
   * et le nombre par page) : filtre "paroisse" côté district, filtre "statut"
   * côté paroisse. Omis => la grille passe à 3 colonnes utiles.
   */
  filtreSupplementaire?: FiltreMembresSupplementaire

  /**
   * Classes Tailwind du gabarit de grille pour la barre de filtres (à copier
   * telles quelles depuis la page d'origine, ex.
   * "lg:grid-cols-[minmax(0,1fr)_220px_260px_150px]") — seule la largeur de
   * la 3e colonne varie selon la nature du filtre supplémentaire.
   */
  classeGrilleFiltres: string

  page: number
  onChangePage: (page: number) => void
  parPage: number
  onChangeParPage: (parPage: number) => void

  /** Réinitialise recherche + profil + filtre supplémentaire + page côté page appelante. */
  onReinitialiser: () => void

  /**
   * Si fourni, affiche une colonne "Paroisse" dans le tableau desktop et les
   * infos paroisse dans les cartes mobiles (cas district : un district
   * contient plusieurs paroisses). Omis côté paroisse (une paroisse ne
   * contient qu'elle-même, inutile de l'afficher).
   */
  obtenirParoisse?: (membre: T) => { nom: string; ville: string }
}

export function TableauMembres<T extends MembreTableauBase>({
  titre,
  membresFiltres,
  totalMembres,
  recherche,
  onChangeRecherche,
  profil,
  onChangeProfil,
  profils,
  filtreSupplementaire,
  classeGrilleFiltres,
  page,
  onChangePage,
  parPage,
  onChangeParPage,
  onReinitialiser,
  obtenirParoisse,
}: TableauMembresProps<T>) {
  const totalPages = Math.max(1, Math.ceil(membresFiltres.length / parPage))
  const pageCourante = Math.min(page, totalPages)
  const indexDebut = (pageCourante - 1) * parPage
  const indexFin = Math.min(indexDebut + parPage, membresFiltres.length)
  const membresPage = membresFiltres.slice(indexDebut, indexFin)
  const premierAffiche = membresFiltres.length === 0 ? 0 : indexDebut + 1
  const peutReinitialiser = !!recherche || !!profil || !!filtreSupplementaire?.value

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{titre}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {membresFiltres.length} résultat{membresFiltres.length > 1 ? 's' : ''} sur {totalMembres} compte{totalMembres > 1 ? 's' : ''}
              {membresFiltres.length > 0 && (
                <> · {premierAffiche}-{indexFin} affiché{membresPage.length > 1 ? 's' : ''}</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onReinitialiser}
            disabled={!peutReinitialiser}
            className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Réinitialiser
          </button>
        </div>
        <div className={`mt-4 grid gap-3 ${classeGrilleFiltres}`}>
          <input
            type="search"
            value={recherche}
            onChange={(e) => onChangeRecherche(e.target.value)}
            placeholder="Rechercher nom, matricule, téléphone, rôle…"
            className={CLS_INPUT}
          />
          <select value={profil} onChange={(e) => onChangeProfil(e.target.value)} className={CLS_INPUT}>
            {profils.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {filtreSupplementaire && (
            <select
              value={filtreSupplementaire.value}
              onChange={(e) => filtreSupplementaire.onChange(e.target.value)}
              className={CLS_INPUT}
            >
              <option value="">{filtreSupplementaire.labelParDefaut}</option>
              {filtreSupplementaire.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <select
            value={parPage}
            onChange={(e) => onChangeParPage(Number(e.target.value))}
            aria-label="Nombre de membres par page"
            className={CLS_INPUT}
          >
            {OPTIONS_MEMBRES_PAR_PAGE.map((option) => (
              <option key={option} value={option}>{option} / page</option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Membre</th>
                {obtenirParoisse && <th className="px-4 py-3">Paroisse</th>}
                <th className="px-4 py-3">Rôle paroissial</th>
                <th className="px-4 py-3">Affectation district</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {membresPage.map((membre) => {
                const paroisse = obtenirParoisse?.(membre)
                return (
                  <tr key={membre.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{membre.prenom} {membre.nom}</p>
                      <p className="text-xs text-gray-500">{membre.matricule ?? membre.telephone ?? '—'}</p>
                    </td>
                    {paroisse && (
                      <td className="px-4 py-3">
                        <p className="text-gray-800">{paroisse.nom}</p>
                        <p className="text-xs text-gray-500">{paroisse.ville}</p>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex max-w-xs rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_ROLES[membre.role] ?? 'bg-gray-100 text-gray-700'}`}>
                        {libelleRoleAvecFonction(membre.role, membre.fonction, membre.brancheType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {membre.roleDistrict ? (
                        <span className={`inline-flex max-w-xs rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_ROLES[membre.roleDistrict] ?? 'bg-gray-100 text-gray-700'}`}>
                          {libelleRoleAvecFonction(membre.roleDistrict, membre.fonctionDistrict, membre.brancheTypeDistrict)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{membre.email ?? '—'}</p>
                      {membre.telephone && <p className="text-xs text-gray-500">{membre.telephone}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${membre.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                        {membre.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/utilisateurs/${membre.id}`} className="text-xs font-semibold text-[#1a4731] hover:underline">
                        Fiche
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {membresFiltres.length === 0 && (
                <tr>
                  <td colSpan={obtenirParoisse ? 7 : 6} className="px-4 py-8 text-center text-gray-400">Aucun membre ne correspond aux filtres.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {membresPage.map((membre) => {
          const paroisse = obtenirParoisse?.(membre)
          return (
            <article key={membre.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold text-gray-900">{membre.prenom} {membre.nom}</h3>
                  <p className="mt-1 text-sm text-gray-500">{paroisse ? paroisse.nom : (membre.matricule ?? membre.telephone ?? '—')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${membre.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                  {membre.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_ROLES[membre.role] ?? 'bg-gray-100 text-gray-700'}`}>
                  <span className="break-words">{libelleRoleAvecFonction(membre.role, membre.fonction, membre.brancheType)}</span>
                </span>
                {membre.roleDistrict && (
                  <span className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_ROLES[membre.roleDistrict] ?? 'bg-gray-100 text-gray-700'}`}>
                    <span className="break-words">{libelleRoleAvecFonction(membre.roleDistrict, membre.fonctionDistrict, membre.brancheTypeDistrict)}</span>
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-1 text-sm text-gray-600">
                {paroisse ? (
                  <>
                    <p><span className="text-gray-400">Identifiant : </span>{membre.matricule ?? membre.telephone ?? '—'}</p>
                    <p><span className="text-gray-400">Ville : </span>{paroisse.ville}</p>
                  </>
                ) : (
                  <>
                    <p><span className="text-gray-400">E-mail : </span>{membre.email ?? '—'}</p>
                    <p><span className="text-gray-400">Téléphone : </span>{membre.telephone ?? '—'}</p>
                  </>
                )}
              </div>
              <Link href={`/admin/utilisateurs/${membre.id}`} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Ouvrir la fiche
              </Link>
            </article>
          )
        })}
        {membresFiltres.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            Aucun membre ne correspond aux filtres.
          </div>
        )}
      </div>

      {membresFiltres.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {premierAffiche}-{indexFin} sur {membresFiltres.length} membre{membresFiltres.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => onChangePage(Math.max(1, pageCourante - 1))}
              disabled={pageCourante <= 1}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="min-w-24 text-center text-sm font-semibold text-gray-700">
              {pageCourante} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onChangePage(Math.min(totalPages, pageCourante + 1))}
              disabled={pageCourante >= totalPages}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </>
  )
}
