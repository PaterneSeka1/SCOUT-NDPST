import type { Metadata } from 'next'
import { FichePublication } from '@/components/admin/publications/FichePublication'

export const metadata: Metadata = { title: 'Modifier une publication' }

export default function PagePublication() {
  return <FichePublication />
}
