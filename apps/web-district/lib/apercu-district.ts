import { SchemaApercuDistrict, type ApercuDistrict } from '@scout/shared'

export type EtatApercuDistrict =
  | { statut: 'disponible'; donnees: ApercuDistrict }
  | { statut: 'session-expiree' | 'interdit' | 'fonctionnalite-indisponible' | 'indisponible' | 'invalide' | 'reseau' }

export async function chargerApercuDistrict(appeler: () => Promise<Response>): Promise<EtatApercuDistrict> {
  let reponse: Response
  try {
    reponse = await appeler()
  } catch {
    return { statut: 'reseau' }
  }
  if (reponse.status === 401) return { statut: 'session-expiree' }
  if (reponse.status === 403) return { statut: 'interdit' }
  if (reponse.status === 404) return { statut: 'fonctionnalite-indisponible' }
  if (!reponse.ok) return { statut: 'indisponible' }
  try {
    const resultat = SchemaApercuDistrict.safeParse(await reponse.json())
    return resultat.success ? { statut: 'disponible', donnees: resultat.data } : { statut: 'invalide' }
  } catch {
    return { statut: 'invalide' }
  }
}
