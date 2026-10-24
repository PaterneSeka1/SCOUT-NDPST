import Link from 'next/link'
import type { Identite } from '@/lib/identite'
import { Clock, Globe, LogIn, Mail, MapPin, MessageCircle, Phone } from '@/lib/icons'
import { RUBRIQUES_PUBLIQUES } from '@/lib/navigation-publique'
import { PARCOURS_REJOINDRE } from './parcours'

const LIBELLES_RESEAUX: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
}

export function PublicFooter({ identite, nomSite }: { identite: Identite; nomSite: string }) {
  const reseaux = Object.entries(identite.reseauxSociaux ?? {})
  const annee = new Date().getFullYear()
  const coordonnees = !!(identite.adresse || identite.telephone || identite.email)

  return (
    <footer className="relative isolate overflow-hidden bg-profond text-white/80">
      <div className="motif-topo-clair absolute inset-0 -z-10 opacity-[0.06]" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-x-10 gap-y-12 px-4 pt-16 pb-12 sm:px-6 md:grid-cols-2 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-4">
          <p className="titre-display text-2xl leading-tight font-semibold text-balance text-white">{nomSite}</p>
          {identite.nomGroupe && identite.nomParoisse && <p className="mt-1 text-sm text-white/70">{identite.nomParoisse}</p>}
          {identite.anneeHistorique && (
            <p className="signal mt-5 inline-flex items-center gap-2 border-l-2 border-or-300 pl-3 text-sm text-or-300">
              Le scoutisme dans la paroisse depuis {identite.anneeHistorique}
            </p>
          )}
          {identite.presentation && <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/75 line-clamp-4">{identite.presentation}</p>}
        </div>

        <nav aria-label="Plan du site" className="lg:col-span-3">
          <p className="signal text-xs text-white/60">Découvrir</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {RUBRIQUES_PUBLIQUES.flatMap((r) => r.liens ?? [{ libelle: r.libelle, href: r.href! }]).map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-white/85 underline-offset-4 hover:text-white hover:underline">
                  {l.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Nous rejoindre" className="lg:col-span-2">
          <p className="signal text-xs text-white/60">Nous rejoindre</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {PARCOURS_REJOINDRE.map((p) => (
              <li key={p.objet}>
                <Link href={`/nous-rejoindre?objet=${p.objet}#formulaire`} className="text-white/85 underline-offset-4 hover:text-white hover:underline">
                  {p.titreCourt}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-3">
          <p className="signal text-xs text-white/60">Nous trouver</p>
          <ul className="mt-4 space-y-3 text-sm">
            {identite.adresse && (
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-or-300" aria-hidden />
                <span>{identite.adresse}</span>
              </li>
            )}
            {identite.horaires && (
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-or-300" aria-hidden />
                <span>{identite.horaires}</span>
              </li>
            )}
            {identite.telephone && (
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-or-300" aria-hidden />
                <a href={`tel:${identite.telephone.replace(/\s/g, '')}`} className="hover:text-white">
                  {identite.telephone}
                </a>
              </li>
            )}
            {identite.email && (
              <li className="flex gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-or-300" aria-hidden />
                <a href={`mailto:${identite.email}`} className="break-all hover:text-white">
                  {identite.email}
                </a>
              </li>
            )}
            {!coordonnees && (
              <li>
                <Link href="/nous-rejoindre?objet=contact#formulaire" className="text-white/85 underline underline-offset-4 hover:text-white">
                  Écrivez-nous depuis le formulaire de contact
                </Link>
              </li>
            )}
          </ul>
          {reseaux.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Réseaux sociaux">
              {reseaux.map(([reseau, url]) => (
                <li key={reseau}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10 hover:text-white"
                  >
                    {reseau === 'whatsapp' ? <MessageCircle className="h-3.5 w-3.5" aria-hidden /> : <Globe className="h-3.5 w-3.5" aria-hidden />}
                    {LIBELLES_RESEAUX[reseau] ?? reseau}
                    <span className="sr-only">(nouvel onglet)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {annee} {nomSite}
            {identite.diocese ? ` — ${identite.diocese}` : ''}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/confidentialite" className="hover:text-white">
              Données personnelles
            </Link>
            <Link href="/connexion" className="inline-flex items-center gap-1.5 hover:text-white">
              <LogIn className="h-3.5 w-3.5" aria-hidden />
              Espace membres
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
