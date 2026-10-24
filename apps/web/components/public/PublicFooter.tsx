import Link from 'next/link'
import type { Identite } from '@/lib/identite'
import { Globe, Mail, MapPin, MessageCircle, Phone } from '@/lib/icons'
import { LIENS_PUBLICS } from '@/lib/navigation-publique'

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
  return (
    <footer className="mt-24 bg-profond text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <p className="titre-display text-xl font-semibold text-white">{nomSite}</p>
          {identite.nomGroupe && identite.nomParoisse && <p className="mt-1 text-sm">{identite.nomParoisse}</p>}
          {identite.anneeHistorique && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-or-300/40 px-3 py-1 text-xs text-or-300">
              Le scoutisme dans la paroisse depuis {identite.anneeHistorique}
            </p>
          )}
          {identite.presentation && <p className="mt-4 max-w-md text-sm leading-relaxed line-clamp-4">{identite.presentation}</p>}
        </div>

        <nav aria-label="Pied de page">
          <p className="text-sm font-semibold tracking-wide text-white uppercase">Découvrir</p>
          <ul className="mt-4 space-y-2 text-sm">
            {LIENS_PUBLICS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white hover:underline">
                  {l.libelle}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/nous-rejoindre" className="hover:text-white hover:underline">
                Nous rejoindre
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold tracking-wide text-white uppercase">Nous contacter</p>
          <ul className="mt-4 space-y-3 text-sm">
            {identite.adresse && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-or-300" aria-hidden />
                <span>{identite.adresse}</span>
              </li>
            )}
            {identite.telephone && (
              <li className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-or-300" aria-hidden />
                <a href={`tel:${identite.telephone.replace(/\s/g, '')}`} className="hover:text-white">
                  {identite.telephone}
                </a>
              </li>
            )}
            {identite.email && (
              <li className="flex gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-or-300" aria-hidden />
                <a href={`mailto:${identite.email}`} className="break-all hover:text-white">
                  {identite.email}
                </a>
              </li>
            )}
            {!identite.adresse && !identite.telephone && !identite.email && (
              <li>
                <Link href="/contact" className="hover:text-white hover:underline">
                  Écrivez-nous depuis la page Contact
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
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {annee} {nomSite}
            {identite.diocese ? ` — ${identite.diocese}` : ''}
          </p>
          <div className="flex gap-4">
            <Link href="/confidentialite" className="hover:text-white">
              Données personnelles
            </Link>
            <Link href="/connexion" className="hover:text-white">
              Espace membres
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
