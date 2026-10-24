// Format du QR code personnel d'un scout : un préfixe fixe pour éviter de
// confondre un scan avec un autre type de QR code (ex : un lien web scanné
// par erreur), suivi de son id (cuid, non devinable).

const PREFIXE_QR_SCOUT = 'SCOUT-ASCCI:scout:'

export function encoderQrScout(scoutId: string): string {
  return `${PREFIXE_QR_SCOUT}${scoutId}`
}

export function decoderQrScout(contenu: string): string | null {
  if (!contenu.startsWith(PREFIXE_QR_SCOUT)) return null
  const id = contenu.slice(PREFIXE_QR_SCOUT.length).trim()
  return id.length > 0 ? id : null
}
