// Autorisations du parcours de progression individuelle des Compagnons.
// Étend le patron déjà utilisé pour la progression badge (autoriseSurScout de
// app/api/scouts/[id]/progressions/route.ts) avec trois nuances propres à ce
// module (voir PROMPT_INTEGRATION_PROGRESSION_ROUTIER.md §2) :
//   - ADMIN_PLATEFORME a un accès total, sans périmètre ;
//   - COMMISSAIRE_DISTRICT/ADJOINT_DISTRICT (direction de district) ne sont
//     pas limités à une branche, contrairement à ASSISTANT_DISTRICT ;
//   - déclarer/soumettre une activité (rôles de branche) et valider/rejeter
//     (rôles de district) sont deux permissions distinctes, jamais les mêmes
//     rôles des deux côtés.
import { ROLES_BRANCHE, ROLES_PLATEFORME } from './roles'
import { getBrancheUtilisateur, getBrancheDistrictUtilisateur } from './brancheUtilisateur'
import { getParoissesDuDistrict } from './district'
import { paroisseIdRequise } from './session'

export interface SessionUtilisateur {
  user: { id: string; role: string; roleDistrict: string | null; paroisseId: string | null }
}

export interface ScoutPourAutorisation {
  paroisseId: string
  brancheType: string
}

const ROLES_DIRECTION_DISTRICT = ['COMMISSAIRE_DISTRICT', 'ADJOINT_DISTRICT']

function estAdminPlateforme(session: SessionUtilisateur): boolean {
  return ROLES_PLATEFORME.includes(session.user.role)
}

async function estResponsableBranche(session: SessionUtilisateur, scout: ScoutPourAutorisation): Promise<boolean> {
  if (!ROLES_BRANCHE.includes(session.user.role)) return false
  const paroisseId = paroisseIdRequise(session)
  if (scout.paroisseId !== paroisseId) return false
  const brancheUtilisateur = await getBrancheUtilisateur(session.user.id)
  return brancheUtilisateur === scout.brancheType
}

async function estValidateurDistrict(session: SessionUtilisateur, scout: ScoutPourAutorisation): Promise<boolean> {
  const roleDistrict = session.user.roleDistrict
  if (!roleDistrict) return false

  if (ROLES_DIRECTION_DISTRICT.includes(roleDistrict)) {
    const { paroisses } = await getParoissesDuDistrict(paroisseIdRequise(session))
    return paroisses.some((p) => p.id === scout.paroisseId)
  }

  if (roleDistrict === 'ASSISTANT_DISTRICT') {
    const brancheUtilisateur = await getBrancheDistrictUtilisateur(session.user.id)
    if (!brancheUtilisateur || brancheUtilisateur !== scout.brancheType) return false
    const { paroisses } = await getParoissesDuDistrict(paroisseIdRequise(session))
    return paroisses.some((p) => p.id === scout.paroisseId)
  }

  return false
}

/** Consultation (GET) : branche du scout, district validateur de sa branche, ou admin plateforme. */
export async function autoriseConsultationParcoursCompagnon(
  session: SessionUtilisateur,
  scout: ScoutPourAutorisation,
): Promise<boolean> {
  if (estAdminPlateforme(session)) return true
  if (await estResponsableBranche(session, scout)) return true
  if (await estValidateurDistrict(session, scout)) return true
  return false
}

/** Création du parcours, déclaration et soumission d'une activité : rôles de branche + admin uniquement. */
export async function autoriseDeclarationParcoursCompagnon(
  session: SessionUtilisateur,
  scout: ScoutPourAutorisation,
): Promise<boolean> {
  if (estAdminPlateforme(session)) return true
  return estResponsableBranche(session, scout)
}

/** Validation et rejet d'une activité soumise : rôles de district validateur + admin uniquement. */
export async function autoriseValidationParcoursCompagnon(
  session: SessionUtilisateur,
  scout: ScoutPourAutorisation,
): Promise<boolean> {
  if (estAdminPlateforme(session)) return true
  return estValidateurDistrict(session, scout)
}
