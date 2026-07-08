// Les rôles paroissiaux (tout sauf ADMIN_PLATEFORME) ont toujours une paroisse
// associée — garanti en base par une contrainte CHECK sur Utilisateur. Les
// routes opérationnelles (scouts, activités, cotisations...) sont déjà gatées
// à ces rôles : cette fonction documente l'invariant au niveau TypeScript à
// l'entrée de ces routes, plutôt que de propager `paroisseId: string | null`
// dans toute la couche Prisma pour un cas qui ne peut pas s'y produire. Le
// throw agit en filet de sécurité si un futur bug de contrôle d'accès laissait
// passer un admin plateforme jusqu'ici.
export function paroisseIdRequise(session: { user: { paroisseId: string | null } }): string {
  const { paroisseId } = session.user
  if (!paroisseId) {
    throw new Error('Session sans paroisse associée — route réservée au personnel paroissial')
  }
  return paroisseId
}
