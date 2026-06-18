export function genererMatricule(paroisseId: string): string {
  // paroisseId is available for future use (e.g. prefixing per parish)
  void paroisseId

  const now = Date.now()
  const sept_chiffres = String(now).slice(-7)

  const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lettre = lettres[Math.floor(Math.random() * lettres.length)]

  return `${sept_chiffres}${lettre}`
}
