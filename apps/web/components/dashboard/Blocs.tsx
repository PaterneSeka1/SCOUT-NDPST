import Link from 'next/link'
import { LABELS_ACTIONS_AUDIT, LABELS_BRANCHES, LABELS_ROLES, LABELS_TYPE_ACTIVITE, formatMontantFCFA } from '@scout/shared'
import { accentBranche } from '@/lib/branches-visuel'
import type { ActiviteDashboard, AlerteDashboard, DonneesDashboard, ReunionDashboard } from '@/lib/dashboard'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Clock, ICONES_TYPE_ACTIVITE, Info, MapPin, XCircle } from '@/lib/icons'

const FORMAT_JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const FORMAT_HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const FORMAT_MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
const FORMAT_HORODATAGE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Bloc de tableau de bord : titre, lien « tout voir » facultatif, contenu. */
export function Bloc({
  titre,
  lien,
  children,
  className = '',
}: {
  titre: string
  lien?: { href: string; libelle: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-ligne bg-white ${className}`} aria-label={titre}>
      <header className="flex items-center justify-between gap-3 border-b border-ligne px-5 py-3.5">
        <h2 className="text-[0.95rem] font-semibold text-encre">{titre}</h2>
        {lien && (
          <Link href={lien.href} className="inline-flex items-center gap-1 text-sm font-medium text-primaire hover:underline">
            {lien.libelle}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

/** Indicateurs réels du profil (jamais de chiffre décoratif), en bandeau. */
export function Indicateurs({ indicateurs }: { indicateurs: DonneesDashboard['indicateurs'] }) {
  if (indicateurs.length === 0) return null
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-ligne bg-white lg:grid-cols-4">
      {indicateurs.map((i, n) => (
        <div
          key={i.cle}
          className={`px-5 py-4 ${n % 2 === 1 ? 'border-l border-ligne' : ''} ${n >= 2 ? 'border-t border-ligne lg:border-t-0' : ''} ${n >= 1 ? 'lg:border-l' : ''}`}
        >
          <dt className="text-sm text-encre-pale">{i.libelle}</dt>
          <dd className="chiffre-signal mt-1 text-3xl leading-none text-encre">{i.valeur}</dd>
          {i.detail && <dd className="mt-1.5 text-xs text-encre-pale">{i.detail}</dd>}
        </div>
      ))}
    </dl>
  )
}

const NIVEAUX: Record<AlerteDashboard['niveau'], { libelle: string; icone: typeof Info; classe: string }> = {
  critique: { libelle: 'Urgent', icone: XCircle, classe: 'text-red-700 bg-red-50' },
  attention: { libelle: 'À vérifier', icone: AlertTriangle, classe: 'text-amber-800 bg-amber-50' },
  info: { libelle: 'À traiter', icone: Info, classe: 'text-sky-800 bg-sky-50' },
}

/** « Qu'est-ce qui demande une action ? » : alertes triées par gravité. */
export function ATraiter({ alertes }: { alertes: AlerteDashboard[] }) {
  const ordre = { critique: 0, attention: 1, info: 2 }
  const triees = [...alertes].sort((a, b) => ordre[a.niveau] - ordre[b.niveau])
  return (
    <Bloc titre="À traiter">
      {triees.length === 0 ? (
        <p className="flex items-center gap-2 text-[0.95rem] text-encre-douce">
          <CheckCircle2 className="h-5 w-5 text-foret-600" aria-hidden />
          Rien ne demande votre attention pour le moment.
        </p>
      ) : (
        <ul className="-my-2 divide-y divide-ligne">
          {triees.map((a, i) => {
            const { libelle, icone: Icone, classe } = NIVEAUX[a.niveau]
            const contenu = (
              <>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${classe}`}>
                  <Icone className="h-3.5 w-3.5" aria-hidden />
                  {libelle}
                </span>
                <span className="flex-1 text-[0.95rem] text-encre">{a.message}</span>
                {a.lien && <ArrowRight className="h-4 w-4 shrink-0 text-encre-pale transition group-hover:translate-x-0.5" aria-hidden />}
              </>
            )
            return (
              <li key={`${a.message}-${i}`}>
                {a.lien ? (
                  <Link href={a.lien} className="group -mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-papier">
                    {contenu}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-2.5">{contenu}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Bloc>
  )
}

function Branche({ type }: { type: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-encre-douce">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentBranche(type) }} aria-hidden />
      {type ? (LABELS_BRANCHES[type] ?? type) : 'Tout le groupe'}
    </span>
  )
}

function Date({ iso }: { iso: string }) {
  const d = new globalThis.Date(iso)
  return (
    <time dateTime={iso} className="w-24 shrink-0 text-sm">
      <span className="block font-semibold text-encre capitalize">{FORMAT_JOUR.format(d)}</span>
      <span className="text-encre-pale">{FORMAT_HEURE.format(d)}</span>
    </time>
  )
}

export function ListeActivites({ activites }: { activites: ActiviteDashboard[] }) {
  if (activites.length === 0) return <p className="text-[0.95rem] text-encre-pale">Aucune activité programmée.</p>
  return (
    <ul className="-my-3 divide-y divide-ligne">
      {activites.map((a) => {
        const Icone = ICONES_TYPE_ACTIVITE[a.type] ?? ClipboardList
        return (
          <li key={a.id}>
            <Link href={`/dashboard/activites/${a.id}`} className="-mx-2 flex items-start gap-4 rounded-md px-2 py-3 hover:bg-papier">
              <Date iso={a.dateDebut} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-encre">{a.titre}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1 text-sm text-encre-douce">
                    <Icone className="h-3.5 w-3.5" aria-hidden />
                    {LABELS_TYPE_ACTIVITE[a.type] ?? a.type}
                  </span>
                  <Branche type={a.brancheType} />
                  {a.lieu && (
                    <span className="inline-flex items-center gap-1 text-sm text-encre-pale">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {a.lieu}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function ListeReunions({ reunions }: { reunions: ReunionDashboard[] }) {
  if (reunions.length === 0) return <p className="text-[0.95rem] text-encre-pale">Aucune réunion planifiée.</p>
  return (
    <ul className="-my-3 divide-y divide-ligne">
      {reunions.map((r) => (
        <li key={r.id}>
          <Link href={`/dashboard/reunions/${r.id}/presences`} className="-mx-2 flex items-start gap-4 rounded-md px-2 py-3 hover:bg-papier">
            <Date iso={r.dateHeure} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-encre">{r.titre || 'Réunion'}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Branche type={r.brancheType} />
                {r.statut === 'REPORTEE' && (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-800">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Reportée
                  </span>
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Effectifs par branche : barres horizontales, étiquetées directement. */
export function RepartitionBranches({ repartition }: { repartition: { brancheType: string; effectif: number }[] }) {
  const max = Math.max(1, ...repartition.map((r) => r.effectif))
  const total = repartition.reduce((s, r) => s + r.effectif, 0)
  return (
    <figure>
      <ul className="space-y-3">
        {repartition.map((r) => (
          <li key={r.brancheType} className="grid grid-cols-[minmax(7rem,auto)_1fr_2rem] items-center gap-3 text-sm">
            <span className="text-encre-douce">
              {LABELS_BRANCHES[r.brancheType] ?? r.brancheType}
            </span>
            <span className="h-2.5 rounded-r bg-papier" aria-hidden>
              <span
                className="block h-full rounded-r"
                style={{ width: `${(r.effectif / max) * 100}%`, minWidth: r.effectif > 0 ? 4 : 0, backgroundColor: accentBranche(r.brancheType) }}
              />
            </span>
            <span className="chiffre-signal text-right text-base text-encre">{r.effectif}</span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-4 text-sm text-encre-pale">{total} scout{total > 1 ? 's' : ''} actif{total > 1 ? 's' : ''} au total</figcaption>
    </figure>
  )
}

/** Évolution des effectifs sur 12 mois : colonnes d'une seule série + tableau accessible. */
export function EvolutionEffectifs({ points }: { points: { mois: string; effectif: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.effectif))
  const libelle = (mois: string) => FORMAT_MOIS.format(new globalThis.Date(`${mois}-01T12:00:00`))
  return (
    <figure>
      <div className="flex h-36 items-end gap-1.5" aria-hidden>
        {points.map((p) => (
          <div key={p.mois} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded bg-encre px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition group-hover:opacity-100">
              {libelle(p.mois)} : {p.effectif}
            </span>
            <span className="block rounded-t bg-primaire/80 transition group-hover:bg-primaire" style={{ height: `${(p.effectif / max) * 100}%`, minHeight: p.effectif > 0 ? 4 : 1 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-ligne pt-1.5 text-[0.7rem] text-encre-pale" aria-hidden>
        {points.map((p, i) => (
          <span key={p.mois} className="flex-1 text-center">
            {i % 2 === 0 ? libelle(p.mois) : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Effectif actif à la fin de chaque mois</caption>
        <thead>
          <tr>
            <th scope="col">Mois</th>
            <th scope="col">Effectif</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.mois}>
              <th scope="row">{p.mois}</th>
              <td>{p.effectif}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function PresencesRecentes({ reunions }: { reunions: NonNullable<DonneesDashboard['presencesRecentes']> }) {
  if (reunions.length === 0) return <p className="text-[0.95rem] text-encre-pale">Aucune feuille de présence sur les 30 derniers jours.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-encre-pale">
          <th scope="col" className="pb-2 font-medium">Réunion</th>
          <th scope="col" className="pb-2 text-right font-medium">Présents</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ligne">
        {reunions.map((r) => {
          const taux = r.total > 0 ? Math.round((r.presents / r.total) * 100) : 0
          return (
            <tr key={r.id}>
              <td className="py-2.5 pr-3">
                <span className="block font-medium text-encre">{r.titre || 'Réunion'}</span>
                <span className="text-encre-pale">{FORMAT_JOUR.format(new globalThis.Date(r.dateHeure))}</span>
              </td>
              <td className="py-2.5 text-right whitespace-nowrap">
                <span className="chiffre-signal text-base text-encre">
                  {r.presents}/{r.total}
                </span>
                <span className={`ml-2 text-xs font-semibold ${taux < 60 ? 'text-amber-800' : 'text-encre-pale'}`}>{taux} %</span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function Cotisations({ c }: { c: NonNullable<DonneesDashboard['cotisations']> }) {
  const taux = c.total > 0 ? Math.round((c.aJour / c.total) * 100) : 0
  return (
    <div>
      <p className="flex items-baseline justify-between gap-3">
        <span className="chiffre-signal text-3xl text-encre">{taux} %</span>
        <span className="text-sm text-encre-pale">
          {c.aJour} / {c.total} scouts à jour
        </span>
      </p>
      <div className="mt-3 h-2.5 rounded bg-papier" role="img" aria-label={`${taux} % des scouts à jour de cotisation`}>
        <div className="h-full rounded bg-primaire" style={{ width: `${taux}%` }} />
      </div>
      <p className="mt-3 text-sm text-encre-douce">
        {formatMontantFCFA(c.montantPaye)} encaissés sur {formatMontantFCFA(c.montantDu)} dus ({c.anneeScolaire})
      </p>
    </div>
  )
}

export function ComptesParRole({ comptes }: { comptes: NonNullable<DonneesDashboard['comptesParRole']> }) {
  return (
    <ul className="divide-y divide-ligne text-sm">
      {comptes.map((c) => (
        <li key={c.role} className="flex justify-between py-2">
          <span className="text-encre-douce">{LABELS_ROLES[c.role] ?? c.role}</span>
          <span className="chiffre-signal text-base text-encre">{c.nombre}</span>
        </li>
      ))}
    </ul>
  )
}

export function Journal({ journal }: { journal: NonNullable<DonneesDashboard['journal']> }) {
  if (journal.length === 0) return <p className="text-[0.95rem] text-encre-pale">Aucune action enregistrée.</p>
  return (
    <ul className="-my-1.5 divide-y divide-ligne text-sm">
      {journal.map((j) => (
        <li key={j.id} className="flex items-start justify-between gap-4 py-2">
          <span>
            <span className="block text-encre">{LABELS_ACTIONS_AUDIT[j.action] ?? j.action}</span>
            <span className="text-encre-pale">{j.acteur ? `${j.acteur.prenom} ${j.acteur.nom}` : 'Système'}</span>
          </span>
          <time dateTime={j.createdAt} className="shrink-0 text-encre-pale">
            {FORMAT_HORODATAGE.format(new globalThis.Date(j.createdAt))}
          </time>
        </li>
      ))}
    </ul>
  )
}

export function Services({ services }: { services: NonNullable<DonneesDashboard['services']> }) {
  const lignes = [
    { libelle: 'Base de données', ok: services.baseDeDonnees, texte: services.baseDeDonnees ? 'Disponible' : 'Indisponible' },
    { libelle: 'Stockage des fichiers', ok: true, texte: services.stockage === 'externe' ? 'Stockage externe' : 'Stockage local' },
    { libelle: 'Envoi d’e-mails', ok: services.email, texte: services.email ? 'Configuré' : 'Non configuré' },
  ]
  return (
    <ul className="divide-y divide-ligne text-sm">
      {lignes.map((l) => (
        <li key={l.libelle} className="flex items-center justify-between gap-3 py-2">
          <span className="text-encre-douce">{l.libelle}</span>
          <span className={`inline-flex items-center gap-1.5 font-medium ${l.ok ? 'text-foret-700' : 'text-amber-800'}`}>
            {l.ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
            {l.texte}
          </span>
        </li>
      ))}
    </ul>
  )
}
