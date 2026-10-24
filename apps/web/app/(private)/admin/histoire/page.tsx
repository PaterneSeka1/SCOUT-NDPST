import type { Metadata } from 'next'
import { HistoireAdmin } from '@/components/admin/histoire/HistoireAdmin'

export const metadata: Metadata = { title: 'Histoire du groupe' }

export default function PageHistoire() {
  return <HistoireAdmin />
}
