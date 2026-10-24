'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Alert, Button, ButtonLink, Card, CardBody, PageHeader, confirmer } from '@/components/ui'
import { ExternalLink, Trash2 } from '@/lib/icons'
import { api } from '@/lib/api'
import { messageErreur, miettesAdmin, statutErreur } from '@/components/admin/commun'
import {
  CLE_ALBUMS,
  useAlbum,
  type Album,
} from './donnees'
import { champsDepuisAlbum, corpsAlbum, FormulaireAlbum, validerAlbum } from './FormulaireAlbum'

export function FicheAlbum() {
  const { id } = useParams<{ id: string }>()
  const album = useAlbum(id)

  if (album.isPending) {
    return (
      <>
        <PageHeader titre="Album" miettes={miettesAdmin({ libelle: 'Galerie', href: '/admin/galerie' }, { libelle: 'Modifier' })} />
        <Card><CardBody>Chargement de l’album…</CardBody></Card>
      </>
    )
  }

  if (album.isError) {
    return (
      <>
        <PageHeader titre="Album" miettes={miettesAdmin({ libelle: 'Galerie', href: '/admin/galerie' }, { libelle: 'Modifier' })} />
        <Card>
          <CardBody>
            <Alert niveau="critique">
              {statutErreur(album.error) === 404
                ? 'Cet album est introuvable : il a peut-être été supprimé.'
                : messageErreur(album.error)}
            </Alert>
            {statutErreur(album.error) !== 404 && (
              <Button variante="secondaire" className="mt-4" onClick={() => album.refetch()}>
                Réessayer
              </Button>
            )}
            <ButtonLink href="/admin/galerie" variante="secondaire" className="mt-4">Retour à la galerie</ButtonLink>
          </CardBody>
        </Card>
      </>
    )
  }

  return <EditeurAlbum key={`${album.data.id}-${album.data.updatedAt}`} album={album.data} />
}

export function NouvelAlbum() {
  return <EditeurAlbum />
}

function EditeurAlbum({ album }: { album?: Album }) {
  const router = useRouter()
  const client = useQueryClient()
  const initial = champsDepuisAlbum(album)
  const [valeurs, setValeurs] = useState(initial)
  const [erreurs, setErreurs] = useState<Partial<Record<keyof typeof initial, string>>>({})
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)
  const creation = !album
  const modifications = corpsAlbum(initial, valeurs, false)
  const modifie = Object.keys(modifications).length > 0

  const invalider = (id?: string) => {
    client.invalidateQueries({ queryKey: [...CLE_ALBUMS, 'liste'] })
    if (id) client.invalidateQueries({ queryKey: [...CLE_ALBUMS, 'detail', id] })
  }

  const sauvegarde = useMutation({
    mutationFn: async () => {
      if (creation) return api<Album>('/api/admin/albums', { method: 'POST', json: corpsAlbum(initial, valeurs, true) })
      if (modifie) return api<Album>(`/api/admin/albums/${encodeURIComponent(album.id)}`, { method: 'PATCH', json: modifications })
      return album
    },
    onSuccess: (enregistre) => {
      invalider(enregistre.id)
      toast.success(creation ? 'Album créé.' : modifie ? 'Modifications enregistrées.' : 'Aucune modification à enregistrer.')
      if (creation) router.replace(`/admin/galerie/${enregistre.id}`)
    },
    onError: (erreur) => setErreurGlobale(messageErreur(erreur)),
  })

  const suppression = useMutation({
    mutationFn: () => api(`/api/admin/albums/${encodeURIComponent(album!.id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.removeQueries({ queryKey: [...CLE_ALBUMS, 'detail', album!.id] })
      invalider()
      toast.success('Album supprimé.')
      router.replace('/admin/galerie')
    },
    onError: (erreur) => setErreurGlobale(messageErreur(erreur)),
  })

  function enregistrer() {
    const trouvees = validerAlbum(valeurs)
    setErreurs(trouvees)
    setErreurGlobale(null)
    if (Object.keys(trouvees).length > 0) {
      toast.error('Corrigez les champs signalés avant d’enregistrer.')
      return
    }
    sauvegarde.mutate()
  }

  async function demanderSuppression() {
    const ok = await confirmer({
      titre: 'Supprimer cet album ?',
      description: 'Les photos associées à cet album seront également retirées.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (ok) suppression.mutate()
  }

  const occupe = sauvegarde.isPending || suppression.isPending
  const idFormulaire = 'formulaire-album'

  return (
    <>
      <PageHeader
        titre={creation ? 'Nouvel album' : album.titre}
        description={creation ? 'Créer un album pour la galerie publique.' : 'Modifier les informations de cet album.'}
        miettes={miettesAdmin({ libelle: 'Galerie', href: '/admin/galerie' }, { libelle: creation ? 'Nouvel album' : 'Modifier' })}
        actions={
          <div className="flex flex-wrap gap-2">
            {!creation && valeurs.slug && (
              <a className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100" href={`/galerie/${valeurs.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Voir l’album
              </a>
            )}
            {!creation && (
              <Button variante="danger" icone={Trash2} disabled={occupe} onClick={demanderSuppression}>
                Supprimer
              </Button>
            )}
            <Button type="submit" form={idFormulaire} disabled={occupe}>
              {sauvegarde.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        }
      />
      <Card>
        <CardBody className="space-y-4">
          {erreurGlobale && <Alert niveau="critique">{erreurGlobale}</Alert>}
          <FormulaireAlbum
            idFormulaire={idFormulaire}
            valeurs={valeurs}
            onChange={setValeurs}
            erreurs={erreurs}
            album={album}
            onSoumettre={enregistrer}
          />
        </CardBody>
      </Card>
    </>
  )
}
