import { notFound, redirect } from 'next/navigation'
import { PERIMETRE_V1, ROLES_DISTRICT } from '@scout/shared'
import { appelApiServeur } from '@/lib/api-serveur'
import { getSession } from '@/lib/session-serveur'
import { chargerApercuDistrict } from '@/lib/apercu-district'
import { ApercuDistrict } from './ApercuDistrict'

export default async function DistrictPage() {
  // Deuxième barrière en plus du proxy : aucun appel de données hors V1.
  if (PERIMETRE_V1) notFound()
  const session = await getSession()
  if (!session) redirect('/login?callbackUrl=%2Fdistrict')
  if (session.user.doitChangerMotDePasse) redirect('/changer-mot-de-passe')
  if (!session.user.roleDistrict || !ROLES_DISTRICT.includes(session.user.roleDistrict)) notFound()
  const etat = await chargerApercuDistrict(() => appelApiServeur('/api/district/apercu'))
  return <ApercuDistrict etat={etat} />
}
