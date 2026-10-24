'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui'
import { useCreerActivite } from '@/hooks/useActivites'
import { FormulaireActivite } from '../_composants/FormulaireActivite'

export default function PageNouvelleActivite() {
  const router = useRouter()
  const creer = useCreerActivite()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titre="Nouvelle activité"
        description="Planifiez une sortie, un camp, un service ou une célébration."
        miettes={[
          { libelle: 'Tableau de bord', href: '/dashboard' },
          { libelle: 'Activités et camps', href: '/dashboard/activites' },
          { libelle: 'Nouvelle activité' },
        ]}
      />
      <FormulaireActivite
        enCours={creer.isPending}
        annulerHref="/dashboard/activites"
        onSoumettre={async (donnees) => {
          try {
            const activite = await creer.mutateAsync(donnees)
            toast.success('Activité créée.')
            router.push(`/dashboard/activites/${activite.id}`)
          } catch (e) {
            toast.error((e as Error).message)
          }
        }}
      />
    </div>
  )
}
