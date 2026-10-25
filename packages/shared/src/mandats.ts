import { ROLES_BRANCHE, ROLES_TOUT_STAFF } from './roles'
export interface MandatSession {
  id: string
  role: string
  brancheType: string | null
  debutLe: Date | string
  finLe: Date | string | null
}
export function mandatsActifs(mandats: MandatSession[], maintenant = new Date()) {
  return mandats.filter(
    (m) =>
      ROLES_TOUT_STAFF.includes(m.role) &&
      new Date(m.debutLe) <= maintenant &&
      (!m.finLe || new Date(m.finLe) > maintenant) &&
      (!ROLES_BRANCHE.includes(m.role) || !!m.brancheType),
  )
}
/** Le contexte réduit l'affichage et les routes historiques ; il n'attribue aucun droit. */
export function espaceAutorise(roleTechnique: string, mandats: MandatSession[], choix?: string) {
  const actifs = mandatsActifs(mandats)
  if (choix === 'administration' && roleTechnique === 'ADMINISTRATEUR')
    return { role: roleTechnique, brancheType: null, mandatId: undefined }
  const mandat = actifs.find((m) => m.id === choix)
  if (choix && !mandat) return null
  if (mandat) return { role: mandat.role, brancheType: mandat.brancheType, mandatId: mandat.id }
  if (roleTechnique === 'ADMINISTRATEUR') return { role: roleTechnique, brancheType: null, mandatId: undefined }
  const defaut = actifs.find((m) => m.role === roleTechnique) ?? actifs[0]
  return defaut
    ? { role: defaut.role, brancheType: defaut.brancheType, mandatId: defaut.id }
    : {
        role: ROLES_TOUT_STAFF.includes(roleTechnique) ? 'SCOUT' : roleTechnique,
        brancheType: null,
        mandatId: undefined,
      }
}
