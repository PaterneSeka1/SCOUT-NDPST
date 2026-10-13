// Logger structuré minimal (JSON, une ligne par événement) — pense pour être
// facilement ingéré par un agrégateur de logs (Docker logs -> CloudWatch,
// Datadog, Loki, etc.) sans dépendance externe. N'appelle jamais `console.log`
// directement ailleurs dans le code serveur : passer par ce module pour que
// le format reste cohérent et grep-able.

type Niveau = 'info' | 'warn' | 'error'

function ecrire(niveau: Niveau, evenement: string, contexte?: Record<string, unknown>) {
  const ligne = {
    horodatage: new Date().toISOString(),
    niveau,
    evenement,
    ...contexte,
  }
  const sortie = niveau === 'error' ? console.error : niveau === 'warn' ? console.warn : console.log
  sortie(JSON.stringify(ligne))
}

export const logger = {
  info: (evenement: string, contexte?: Record<string, unknown>) => ecrire('info', evenement, contexte),
  warn: (evenement: string, contexte?: Record<string, unknown>) => ecrire('warn', evenement, contexte),
  error: (evenement: string, erreur: unknown, contexte?: Record<string, unknown>) => {
    const detailErreur =
      erreur instanceof Error
        ? { message: erreur.message, stack: erreur.stack }
        : { message: String(erreur) }
    ecrire('error', evenement, { ...contexte, erreur: detailErreur })
  },
}
