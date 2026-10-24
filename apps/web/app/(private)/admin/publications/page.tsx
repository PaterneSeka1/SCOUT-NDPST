import type { Metadata } from 'next'
import { ListePublications } from '@/components/admin/publications/ListePublications'

export const metadata: Metadata = { title: 'Publications' }

export default function PagePublications() {
  return <ListePublications />
}
