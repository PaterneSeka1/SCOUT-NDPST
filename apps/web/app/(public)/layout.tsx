import { getIdentite } from '@/lib/identite-serveur'
import { LOGO_PAR_DEFAUT, nomAffiche, sousTitreAffiche } from '@/lib/identite'
import { PublicFooter } from '@/components/public/PublicFooter'
import { PublicHeader } from '@/components/public/PublicHeader'

// Site public : consultable sans compte, uniquement des données publiées.
export default async function LayoutPublic({ children }: { children: React.ReactNode }) {
  const identite = await getIdentite()
  const nomSite = nomAffiche(identite)
  return (
    <div className="flex min-h-dvh flex-col bg-papier">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow-flottante">
        Aller au contenu
      </a>
      <PublicHeader nomSite={nomSite} sousTitre={sousTitreAffiche(identite)} logoUrl={identite.logoUrl || LOGO_PAR_DEFAUT} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <PublicFooter identite={identite} nomSite={nomSite} />
    </div>
  )
}
