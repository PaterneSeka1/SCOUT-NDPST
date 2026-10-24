import { forwardRef, useId } from 'react'

const CHAMP =
  'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition placeholder:text-stone-400 focus:border-primaire focus:ring-2 focus:ring-primaire/20 focus:outline-none disabled:bg-stone-50 disabled:text-stone-500 aria-[invalid=true]:border-red-500'

/**
 * Champ de formulaire accessible : libellé associé, aide et message d'erreur
 * reliés par aria-describedby. Le contrôle reçoit l'identifiant généré.
 */
export function Field({
  label,
  aide,
  erreur,
  requis,
  children,
  className = '',
}: {
  label: string
  aide?: string
  erreur?: string | null
  requis?: boolean
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean }) => React.ReactNode
  className?: string
}) {
  const id = useId()
  const idAide = aide ? `${id}-aide` : undefined
  const idErreur = erreur ? `${id}-erreur` : undefined
  const decrit = [idAide, idErreur].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
        {requis && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': decrit, 'aria-invalid': erreur ? true : undefined, required: requis })}
      {aide && !erreur && (
        <p id={idAide} className="mt-1 text-xs text-stone-500">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={idErreur} className="mt-1 text-xs text-red-600">
          {erreur}
        </p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref,
) {
  return <input ref={ref} className={`${CHAMP} ${className}`} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={`${CHAMP} ${className}`} {...props} />
  },
)

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options?: { valeur: string; libelle: string }[]; vide?: string }
>(function Select({ className = '', options, vide, children, ...props }, ref) {
  return (
    <select ref={ref} className={`${CHAMP} pr-8 ${className}`} {...props}>
      {vide !== undefined && <option value="">{vide}</option>}
      {options?.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
      {children}
    </select>
  )
})

export function Checkbox({
  label,
  description,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; description?: string }) {
  const id = useId()
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-[var(--cp)]"
        aria-describedby={description ? `${id}-desc` : undefined}
        {...props}
      />
      <div className="text-sm">
        <label htmlFor={id} className="font-medium text-stone-800">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-stone-500">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

/** Interrupteur on/off (case à cocher stylée, rôle switch). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (valeur: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-sm">
        <label htmlFor={id} className="font-medium text-stone-800">
          {label}
        </label>
        {description && <p className="text-stone-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-primaire' : 'bg-stone-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  )
}
