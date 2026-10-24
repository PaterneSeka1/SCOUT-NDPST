import type { Metadata } from 'next'
import { NouvelAlbum } from '@/components/admin/galerie/EditeurAlbum'

export const metadata: Metadata = { title: 'Nouvel album' }

export default function PageNouvelAlbum() {
  return <NouvelAlbum />
}
