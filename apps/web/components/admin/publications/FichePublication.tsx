'use client'

import { useParams } from 'next/navigation'
import { ButtonLink, Card, ErrorState, PageHeader } from '@/components/ui'
import { ChargementFormulaire } from '@/components/admin/ChargementFormulaire'
import { messageErreur, miettesAdmin, statutErreur } from '@/components/admin/commun'
import { EditeurPublication } from './EditeurPublication'
import { usePublication } from './donnees'

/** Chargement d'une publication existante puis affichage de l'éditeur. */
export function FichePublication() {
  const { id } = useParams<{ id: string }>()
  const publication = usePublication(id)

  if (publication.isPending) {
    return (
      <>
        <PageHeader titre="Publication" miettes={miettesAdmin({ libelle: 'Publications', href: '/admin/publications' }, { libelle: 'Modifier' })} />
        <ChargementFormulaire libelle="Chargement de la publication…" />
      </>
    )
  }

  if (publication.isError) {
    return (
      <>
        <PageHeader titre="Publication" miettes={miettesAdmin({ libelle: 'Publications', href: '/admin/publications' }, { libelle: 'Modifier' })} />
        <Card>
          <ErrorState
            message={statutErreur(publication.error) === 404 ? 'Cette publication est introuvable : elle a peut-être été supprimée.' : messageErreur(publication.error)}
            onReessayer={statutErreur(publication.error) === 404 ? undefined : () => publication.refetch()}
          />
          {statutErreur(publication.error) === 404 && (
            <div className="pb-8 text-center">
              <ButtonLink href="/admin/publications" variante="secondaire">
                Retour aux publications
              </ButtonLink>
            </div>
          )}
        </Card>
      </>
    )
  }

  return <EditeurPublication key={`${publication.data.id}-${publication.data.updatedAt}`} publication={publication.data} />
}
