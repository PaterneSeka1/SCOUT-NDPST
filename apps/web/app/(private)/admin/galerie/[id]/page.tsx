import type { Metadata } from 'next'
import { FicheAlbum } from '@/components/admin/galerie/EditeurAlbum'

export const metadata: Metadata = { title: 'Album photo' }

export default function PageAlbum() {
  return <FicheAlbum />
}
