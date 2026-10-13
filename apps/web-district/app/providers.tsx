'use client'

import { Toaster } from 'sonner'
import { SessionProvider } from '@/lib/session-client'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionProvider>{children}</SessionProvider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4000}
        toastOptions={{
          style: { fontFamily: 'var(--font-geist-sans)', fontSize: '0.875rem' },
        }}
      />
    </>
  )
}
