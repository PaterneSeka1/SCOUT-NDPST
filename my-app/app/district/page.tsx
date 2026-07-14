import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ApercuDistrictClient } from './ApercuDistrictClient'

// Un ASSISTANT_DISTRICT chargé d'une branche précise (Utilisateur.brancheType
// renseigné) n'a besoin que des données de SA branche à l'échelle du district
// (déjà servies par /district/ma-branche) — pas de la vue d'ensemble
// multi-branches de tout le district, réservée à la direction (Commissaire,
// Adjoint) et aux assistants sans branche assignée (fonction libre, ex.
// "Spiritualité", dont la charge est par nature transverse à tout le district).
export default async function DistrictRoot() {
  const session = await getServerSession(authOptions)
  if (session?.user?.roleDistrict === 'ASSISTANT_DISTRICT') {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: session.user.id },
      select: { brancheTypeDistrict: true },
    })
    if (utilisateur?.brancheTypeDistrict) redirect('/district/ma-branche')
  }

  return <ApercuDistrictClient />
}
