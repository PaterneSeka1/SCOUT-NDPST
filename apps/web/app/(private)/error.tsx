'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function ErreurEspacePrive({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState message="Une erreur est survenue. Réessayez, ou revenez plus tard si le problème persiste." onReessayer={reset} />
}
