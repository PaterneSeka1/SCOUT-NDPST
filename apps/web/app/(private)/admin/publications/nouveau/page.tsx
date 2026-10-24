import type { Metadata } from 'next'
import { EditeurPublication } from '@/components/admin/publications/EditeurPublication'

export const metadata: Metadata = { title: 'Nouvelle publication' }

export default function PageNouvellePublication() {
  return <EditeurPublication />
}
