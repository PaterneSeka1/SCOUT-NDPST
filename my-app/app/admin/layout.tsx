import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AdminShell } from './AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN_PLATEFORME') redirect('/dashboard')

  return (
    <AdminShell nomComplet={`${session.user.prenom} ${session.user.nom}`}>
      {children}
    </AdminShell>
  )
}
