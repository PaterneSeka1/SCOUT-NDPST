import type { Metadata } from 'next'
import { ListeAlbums } from '@/components/admin/galerie/ListeAlbums'

export const metadata: Metadata = { title: 'Galerie' }

export default function PageGalerie() {
  return <ListeAlbums />
}
