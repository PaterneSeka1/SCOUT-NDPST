import type { Metadata } from 'next'
import { JournalAudit } from '@/components/admin/audit/JournalAudit'

export const metadata: Metadata = { title: "Journal d'audit" }

export default function PageAudit() {
  return <JournalAudit />
}
