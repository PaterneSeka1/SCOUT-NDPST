import type { Metadata } from 'next'
import { FicheDemande } from '@/components/admin/demandes/FicheDemande'

export const metadata: Metadata = { title: 'Demande' }

export default function PageDemande() {
  return <FicheDemande />
}
