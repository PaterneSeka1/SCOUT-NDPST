'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChargementPage, ErrorState, PageHeader } from '@/components/ui'
import { useActivite, useModifierActivite } from '@/hooks/useActivites'
import { FormulaireActivite } from '../../_composants/FormulaireActivite'

export default function PageModifierActivite() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: activite, isLoading, error, refetch } = useActivite(id)
  const modifier = useModifierActivite(id)

  if (isLoading) return <ChargementPage />
  if (error || !activite) return <ErrorState message={error?.message ?? 'Activité introuvable.'} onReessayer={() => refetch()} />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titre="Modifier l’activité"
        description={activite.titre}
        miettes={[
          { libelle: 'Tableau de bord', href: '/dashboard' },
          { libelle: 'Activités et camps', href: '/dashboard/activites' },
          { libelle: activite.titre, href: `/dashboard/activites/${id}` },
          { libelle: 'Modifier' },
        ]}
      />
      <FormulaireActivite
        key={activite.id}
        initiale={activite}
        enCours={modifier.isPending}
        annulerHref={`/dashboard/activites/${id}`}
        onSoumettre={async (donnees) => {
          try {
            await modifier.mutateAsync(donnees)
            toast.success('Activité enregistrée.')
            router.push(`/dashboard/activites/${id}`)
          } catch (e) {
            toast.error((e as Error).message)
          }
        }}
      />
    </div>
  )
}
