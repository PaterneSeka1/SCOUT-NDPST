// Un champ commençant par =, +, -, @ (ou tabulation/retour chariot) est
// interprété comme une formule par Excel/LibreOffice à l'ouverture du CSV —
// classique vecteur d'injection de formule (OWASP CSV Injection) via un champ
// libre (libellé, nom...) saisi par un utilisateur. On neutralise en
// préfixant d'une apostrophe, qui force une lecture en texte brut.
const PREFIXES_FORMULE = ['=', '+', '-', '@', '\t', '\r']

/** Échappe un champ pour un CSV délimité par point-virgule (convention Excel FR). */
export function champCsv(v: string | null | undefined): string {
  let valeur = v ?? ''
  if (PREFIXES_FORMULE.includes(valeur[0])) {
    valeur = `'${valeur}`
  }
  return `"${valeur.replace(/"/g, '""')}"`
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
  const ascii = retirerAccents(nomFichier)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomFichier)}`
}
