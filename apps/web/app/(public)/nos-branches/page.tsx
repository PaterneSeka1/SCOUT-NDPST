import type { Metadata } from 'next'
import { lirePublic } from '@/lib/api-public'
import { Leaf } from '@/lib/icons'
import { EmptyState } from '@/components/ui'
import { EnTetePage, Section } from '@/components/public/EnTetePage'
import { CarteBranche } from '@/components/public/Cartes'
import type { BranchePublique } from '@/components/public/types'

export const metadata: Metadata = {
  title: 'Nos branches',
  description: 'Les branches du groupe scout, de l’enfance à l’âge adulte : tranches d’âge, pédagogie et activités.',
  alternates: { canonical: '/nos-branches' },
}

export default async function PageBranches() {
  const branches = (await lirePublic<BranchePublique[]>('/branches')) ?? []
  return (
    <>
      <EnTetePage
        surtitre="Nos branches"
        titre="Un chemin pour chaque âge"
        description="Chaque branche propose une pédagogie adaptée à l’âge des jeunes, pour grandir pas à pas, en équipe et au service des autres."
      />
      <Section>
        {branches.length === 0 ? (
          <EmptyState icon={Leaf} title="La présentation des branches sera bientôt publiée." />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <li key={b.slug}>
                <CarteBranche branche={b} titreNiveau="h2" />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
