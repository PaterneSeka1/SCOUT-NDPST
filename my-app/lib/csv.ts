// Une cellule qui commence par = + - @ (ou une tabulation / un retour chariot)
// est interprétée comme une formule par Excel ou LibreOffice : une valeur saisie
// par un utilisateur (nom, note…) pourrait alors s'exécuter à l'ouverture du
// fichier (« injection CSV »). On la neutralise en la préfixant d'une
// apostrophe. Les nombres signés et les numéros de téléphone (« +225 07 … »,
// « -5 ») restent intacts : ils ne contiennent aucun opérateur exploitable.
const DEBUT_FORMULE = /^[=+\-@\t\r]/
const NOMBRE_OU_TELEPHONE = /^[+-][\d\s.,()]*$/

function neutraliserFormule(texte: string): string {
  if (!DEBUT_FORMULE.test(texte) || NOMBRE_OU_TELEPHONE.test(texte)) return texte
  return `'${texte}`
}

/** Échappe un champ pour un CSV délimité par point-virgule (convention Excel FR). */
export function champCsv(v: string | null | undefined): string {
  return `"${neutraliserFormule(v ?? '').replace(/"/g, '""')}"`
}

const DEBUT_MARQUES_DIACRITIQUES = 0x0300
const FIN_MARQUES_DIACRITIQUES = 0x036f

function retirerAccents(texte: string): string {
  return Array.from(texte.normalize('NFD'))
    .filter((caractere) => {
      const code = caractere.codePointAt(0) ?? 0
      return code < DEBUT_MARQUES_DIACRITIQUES || code > FIN_MARQUES_DIACRITIQUES
    })
    .join('')
}

/**
 * En-tête Content-Disposition avec un nom de fichier accentué. Un `filename`
 * brut avec des accents est mal interprété par certains navigateurs (l'en-tête
 * HTTP n'est pas UTF-8 par défaut) — on fournit un repli ASCII (accents
 * retirés) et la forme `filename*` encodée en UTF-8 que les navigateurs
 * récents préfèrent (RFC 5987/6266).
 */
export function contentDispositionTelechargement(nomFichier: string): string {
  // Le repli doit rester en ASCII imprimable (un caractère hors Latin-1 fait
  // échouer la construction de l'en-tête) et sans guillemet ni barre oblique
  // inverse, qui casseraient la chaîne entre guillemets.
  const ascii = retirerAccents(nomFichier).replace(/[^\x20-\x7e]|["\\]/g, '_')
  // encodeURIComponent laisse passer ' ( ) *, exclus des attr-char de la RFC 5987.
  const encode = encodeURIComponent(nomFichier).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encode}`
}
