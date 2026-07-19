interface CompteurCaracteresProps {
  valeur: string
  max: number
  className?: string
}

// Reprend le style établi sur app/admin/apparence/page.tsx : gris tant que la
// longueur reste dans la limite, ambre au-delà (indicatif, ne bloque pas la
// saisie — la validation dure éventuelle reste côté API).
export function CompteurCaracteres({ valeur, max, className }: CompteurCaracteresProps) {
  const depasse = valeur.length > max
  return (
    <span className={`font-normal ${depasse ? 'text-amber-500' : 'text-gray-400'} ${className ?? ''}`}>
      {valeur.length}/{max}
    </span>
  )
}
