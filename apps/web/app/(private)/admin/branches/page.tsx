import type { Metadata } from 'next'
import { BranchesAdmin } from '@/components/admin/branches/BranchesAdmin'

export const metadata: Metadata = { title: 'Présentation des branches' }

export default function PageBranches() {
  return <BranchesAdmin />
}
