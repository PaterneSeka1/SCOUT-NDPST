'use client'

import { useState } from 'react'
import { ROLES_FINANCES, ROLES_GROUPE } from '@scout/shared'
import { useSession } from '@/lib/session-client'
import { Button, PageHeader, Tabs } from '@/components/ui'
import { Plus } from '@/lib/icons'
import { OngletListe } from './OngletListe'
import { OngletAdhesions } from './OngletAdhesions'
import { OngletBaremes } from './OngletBaremes'
import { ModaleCreation } from './ModaleCreation'

type Onglet = 'liste' | 'adhesions' | 'baremes'

// Cotisations : liste des montants dus et payés, situation d'adhésion annuelle
// par scout, et barème de référence (rôles finances). L'API applique le
// périmètre (une branche pour l'encadrement de branche) et les droits.
export default function PageCotisations() {
  const { data: session } = useSession()
  const role = session?.user.role ?? ''
  const estDirection = ROLES_GROUPE.includes(role)
  const estFinances = ROLES_FINANCES.includes(role)

  const [onglet, setOnglet] = useState<Onglet>('liste')
  const [creation, setCreation] = useState(false)

  const onglets: { valeur: Onglet; libelle: string }[] = [
    { valeur: 'liste', libelle: 'Cotisations' },
    { valeur: 'adhesions', libelle: 'Adhésions annuelles' },
    ...(estFinances ? [{ valeur: 'baremes' as const, libelle: 'Barèmes' }] : []),
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        titre="Cotisations"
        description="Montants dus, paiements enregistrés et situation d’adhésion des scouts, en FCFA."
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Cotisations' }]}
        actions={
          estDirection ? (
            <Button icone={Plus} onClick={() => setCreation(true)}>
              Nouvelle cotisation
            </Button>
          ) : undefined
        }
      />

      <Tabs label="Rubriques des cotisations" onglets={onglets} actif={onglet} onChange={setOnglet} />

      {onglet === 'liste' && <OngletListe role={role} />}
      {onglet === 'adhesions' && <OngletAdhesions role={role} />}
      {onglet === 'baremes' && estFinances && <OngletBaremes />}

      {estDirection && <ModaleCreation ouvert={creation} onFermer={() => setCreation(false)} />}
    </div>
  )
}
