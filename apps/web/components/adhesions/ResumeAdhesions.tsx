'use client'
import { anneeScolaireCourante, formatMontantFCFA } from '@scout/shared'
import { useAdhesionsQuery, type IndicateursAdhesion } from '@/hooks/useAdhesionsNationales'
import { useSession } from '@/lib/session-client'
import { KpiCard } from '@/components/ui/KpiCard'
export function ResumeAdhesions() {
  const { data: session } = useSession()
  const requete = useAdhesionsQuery<IndicateursAdhesion>('/indicateurs', {
    annee: anneeScolaireCourante(),
    branche: session?.user.brancheType ?? undefined,
  })
  if (requete.error)
    return (
      <p role="alert" className="text-sm text-red-700">
        Adhésions nationales : {requete.error.message}
      </p>
    )
  if (!requete.data) return <p role="status">Chargement des adhésions…</p>
  const d = requete.data
  return (
    <section aria-label="Adhésions nationales" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        libelle="Collecte locale"
        valeur={formatMontantFCFA(d.encaisse)}
        lien="/dashboard/adhesions-nationales"
      />
      <KpiCard
        libelle="Fonds à reverser"
        valeur={formatMontantFCFA(d.aReverser)}
        lien="/dashboard/adhesions-nationales"
      />
      <KpiCard
        libelle="Cotisants nationaux confirmés"
        valeur={d.cotisantsConfirmes}
        detail={`${d.aJourLocalement} à jour localement`}
        lien="/dashboard/adhesions-nationales"
      />
      <KpiCard libelle="Adhésions à vérifier" valeur={d.aVerifier} lien="/dashboard/adhesions-nationales" />
    </section>
  )
}
