'use client'

import { SessionProvider } from '@/lib/session-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {/* Session « anonyme » par défaut : le site public ne la consulte pas
          (évite un appel /api/auth/session en 401 à chaque visite) ; l'espace
          privé fournit sa propre session, lue côté serveur par son layout. */}
      <SessionProvider sessionInitiale={null}>{children}</SessionProvider>
      <ReactQueryDevtools initialIsOpen={false} />
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4000}
        toastOptions={{
          style: { fontFamily: 'var(--font-corps)', fontSize: '0.875rem' },
        }}
      />
    </QueryClientProvider>
  )
}
