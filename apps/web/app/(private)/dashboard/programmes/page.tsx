'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, ROLES_BRANCHE, ROLES_GESTION } from '@scout/shared'
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, FilterBar, PageHeader, Select, Skeleton } from '@/components/ui'
import { useProgrammes, type ProgrammeResume } from '@/hooks/useProgrammes'
import { useSession } from '@/lib/session-client'
import { dateCourte } from '@/lib/format'
import { BookOpen, Plus } from '@/lib/icons'

const OPTIONS_BRANCHES = Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => ({ valeur, libelle }))

export default function PageProgrammes() {
  const { data: session } = useSession()
  const role = session?.user.role ?? ''
  const peutCreer = ROLES_GESTION.includes(role)
  const estBranche = ROLES_BRANCHE.includes(role)
  const [branche, setBranche] = useState('')
  const requeteProgrammes = useProgrammes(branche || undefined)

  const programmes = requeteProgrammes.data ?? []
  const duGroupe = programmes.filter((p) => !p.brancheType)
  const desBranches = programmes.filter((p) => p.brancheType)

  return (
    <div className="space-y-5">
      <PageHeader
        titre="Programmes d’activités"
        description="Programme du groupe et programmes propres à chaque branche : thèmes planifiés et réalisation."
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Programmes' }]}
        actions={
          peutCreer ? (
            <ButtonLink href="/dashboard/programmes/nouveau" icone={Plus}>
              Nouveau programme
            </ButtonLink>
          ) : undefined
        }
      />

      {!estBranche && (
        <FilterBar>
          <Select aria-label="Branche" value={branche} onChange={(e) => setBranche(e.target.value)} vide="Toutes les branches" options={OPTIONS_BRANCHES} />
        </FilterBar>
      )}

      {requeteProgrammes.isError ? (
        <Card>
          <ErrorState message={requeteProgrammes.error.message} onReessayer={() => requeteProgrammes.refetch()} />
        </Card>
      ) : requeteProgrammes.isLoading ? (
        <div role="status" aria-label="Chargement" className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : programmes.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Aucun programme"
            description="Les programmes regroupent les thèmes prévus sur une période (trimestre, année)."
            action={
              peutCreer ? (
                <ButtonLink href="/dashboard/programmes/nouveau" icone={Plus} variante="secondaire">
                  Créer un programme
                </ButtonLink>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <Section titre="Programme du groupe" programmes={duGroupe} vide="Aucun programme de groupe." />
          <Section titre="Programmes des branches" programmes={desBranches} vide="Aucun programme de branche." />
        </>
      )}
    </div>
  )
}

function Section({ titre, programmes, vide }: { titre: string; programmes: ProgrammeResume[]; vide: string }) {
  return (
    <Card>
      <CardHeader titre={titre} description={`${programmes.length} programme${programmes.length > 1 ? 's' : ''}`} />
      {programmes.length === 0 ? (
        <p className="px-5 py-6 text-sm text-stone-500">{vide}</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {programmes.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/programmes/${p.id}`} className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-sable-50/60">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">{p.titre}</span>
                    <Badge ton={p.brancheType ? 'primaire' : 'neutre'}>{p.brancheType ? LABELS_BRANCHES[p.brancheType] ?? p.brancheType : 'Groupe'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    Du {dateCourte(p.periodeDebut)} au {dateCourte(p.periodeFin)}
                  </p>
                  {p.description && <p className="mt-1 line-clamp-1 text-xs text-stone-500">{p.description}</p>}
                </div>
                <span className="shrink-0 text-xs font-medium text-stone-500">
                  {p._count.lignes} thème{p._count.lignes > 1 ? 's' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
