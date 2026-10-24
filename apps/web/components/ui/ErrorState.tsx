import { AlertTriangle } from '@/lib/icons'
import { Button } from './Button'

export function ErrorState({
  message = 'Impossible de charger ces informations.',
  onReessayer,
  className = '',
}: {
  message?: string
  onReessayer?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={`flex flex-col items-center px-4 py-10 text-center ${className}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="max-w-md text-sm text-stone-700">{message}</p>
      {onReessayer && (
        <Button variante="secondaire" taille="sm" className="mt-4" onClick={onReessayer}>
          Réessayer
        </Button>
      )}
    </div>
  )
}
