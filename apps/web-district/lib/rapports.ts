/** Refuse les réponses partielles : une indisponibilité ne vaut jamais zéro. */
export async function lireRapports(reponse: Response) {
  if (!reponse.ok) {
    const messages: Record<number, string> = {
      401: 'Votre session a expiré. Reconnectez-vous.',
      403: 'Vous ne disposez pas des droits nécessaires pour consulter ces indicateurs.',
      404: 'Les indicateurs sont indisponibles sur cette installation.',
    }
    throw new Error(messages[reponse.status] ?? 'Impossible de charger les indicateurs. Réessayez dans quelques instants.')
  }
  const data = await reponse.json()
  const nombresValides = (objet: Record<string, unknown> | null | undefined, champs: string[]) =>
    objet && champs.every((champ) => typeof objet[champ] === 'number' && Number.isFinite(objet[champ]) && (objet[champ] as number) >= 0)
  if (!nombresValides(data?.totaux, ['paroisses', 'paroissesActives', 'scouts', 'utilisateurs', 'activites']) ||
      !nombresValides(data?.kpis, ['activitesMois', 'tauxPresence', 'cotisationsPayees', 'cotisationsEnAttente']) ||
      !nombresValides(data?.kpis?.utilisateursParCategorie, ['staff', 'parents', 'comptesScouts']) ||
      !Array.isArray(data?.paroisses)) {
    throw new Error('Les indicateurs reçus sont incomplets. Réessayez ou contactez un administrateur.')
  }
  return data
}
