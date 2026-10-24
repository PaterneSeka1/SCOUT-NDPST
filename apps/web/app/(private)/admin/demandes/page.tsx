import type { Metadata } from 'next'
import { ListeDemandes } from '@/components/admin/demandes/ListeDemandes'

export const metadata: Metadata = { title: "Demandes d'adhésion" }

export default function PageDemandes() {
  return <ListeDemandes />
}
