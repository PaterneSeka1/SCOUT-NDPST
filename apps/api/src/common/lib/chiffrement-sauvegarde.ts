import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'

// Chiffrement des sauvegardes de la base avant leur envoi hors du VPS : elles
// contiennent des données personnelles de mineurs (fiches, contacts, santé).
// AES-256-GCM (chiffrement authentifié : toute altération est détectée), clé
// dérivée de la phrase secrète par scrypt avec un sel aléatoire par fichier.
//
// Format : SIGNATURE (8) | sel (16) | IV (12) | étiquette GCM (16) | données chiffrées

const SIGNATURE = Buffer.from('SCOUTSV1', 'ascii')
const TAILLE_SEL = 16
const TAILLE_IV = 12
const TAILLE_ETIQUETTE = 16
const ENTETE = SIGNATURE.length + TAILLE_SEL + TAILLE_IV + TAILLE_ETIQUETTE
const PARAMETRES_SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export const LONGUEUR_MIN_PHRASE = 20

function deriverCle(phrase: string, sel: Buffer): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    scrypt(phrase, sel, 32, PARAMETRES_SCRYPT, (erreur, cle) => (erreur ? rejeter(erreur) : resoudre(cle)))
  })
}

function verifierPhrase(phrase: string) {
  if (phrase.length < LONGUEUR_MIN_PHRASE) {
    throw new Error(`La phrase secrète de sauvegarde doit contenir au moins ${LONGUEUR_MIN_PHRASE} caractères.`)
  }
}

export async function chiffrerSauvegarde(donnees: Buffer, phrase: string): Promise<Buffer> {
  verifierPhrase(phrase)
  const sel = randomBytes(TAILLE_SEL)
  const iv = randomBytes(TAILLE_IV)
  const chiffreur = createCipheriv('aes-256-gcm', await deriverCle(phrase, sel), iv)
  const chiffre = Buffer.concat([chiffreur.update(donnees), chiffreur.final()])
  return Buffer.concat([SIGNATURE, sel, iv, chiffreur.getAuthTag(), chiffre])
}

export async function dechiffrerSauvegarde(contenu: Buffer, phrase: string): Promise<Buffer> {
  verifierPhrase(phrase)
  if (contenu.length < ENTETE || !contenu.subarray(0, SIGNATURE.length).equals(SIGNATURE)) {
    throw new Error("Ce fichier n'est pas une sauvegarde chiffrée SCOUT ASCCI.")
  }
  let position = SIGNATURE.length
  const lire = (taille: number) => contenu.subarray(position, (position += taille))
  const sel = lire(TAILLE_SEL)
  const iv = lire(TAILLE_IV)
  const etiquette = lire(TAILLE_ETIQUETTE)
  const dechiffreur = createDecipheriv('aes-256-gcm', await deriverCle(phrase, sel), iv)
  dechiffreur.setAuthTag(etiquette)
  try {
    return Buffer.concat([dechiffreur.update(contenu.subarray(ENTETE)), dechiffreur.final()])
  } catch {
    throw new Error('Déchiffrement impossible : phrase secrète incorrecte ou fichier altéré.')
  }
}
