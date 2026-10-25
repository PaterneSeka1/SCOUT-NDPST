'use client'
import { LABELS_BRANCHES, LABELS_ROLES, mandatsActifs } from '@scout/shared'
import { useSession } from '@/lib/session-client'
export function SelecteurEspace() {
  const { data } = useSession()
  if (!data) return null
  const u = data.user
  const mandats = mandatsActifs(u.mandats ?? [])
  const administration = (u.roleTechnique ?? u.role) === 'ADMINISTRATEUR'
  if (!mandats.length) return null
  return (
    <label className="block px-5 py-3 text-xs text-white/80">
      Espace de travail
      <select
        aria-label="Espace de travail"
        className="mt-1 w-full rounded border border-white/30 bg-profond p-2 text-sm text-white"
        value={u.mandatId ?? (administration ? 'administration' : '')}
        onChange={(e) => {
          document.cookie = `scout_espace=${encodeURIComponent(e.target.value)}; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
          // Le rechargement complet vide les caches de l'espace précédent.
          window.location.assign(new URL('/dashboard', window.location.origin).href)
        }}
      >
        {administration && <option value="administration">Administration</option>}
        {mandats.map((m) => (
          <option key={m.id} value={m.id}>
            {LABELS_ROLES[m.role]}
            {m.brancheType ? ` — ${LABELS_BRANCHES[m.brancheType]}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
