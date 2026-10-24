import type { Metadata } from 'next'
import { FicheAlbum } from '@/components/admin/galerie/FicheAlbum'

export const metadata: Metadata = { title: 'Album photo' }

export default function PageAlbum() {
  return <FicheAlbum />
}
