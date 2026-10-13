import { describe, expect, it } from 'vitest'
import { chiffrerSauvegarde, dechiffrerSauvegarde } from './chiffrement-sauvegarde'

const PHRASE = 'une phrase secrète suffisamment longue'
const DONNEES = Buffer.from('PGDMP contenu de sauvegarde avec données personnelles')

describe('chiffrement des sauvegardes', () => {
  it('restitue exactement les données d’origine', async () => {
    const chiffre = await chiffrerSauvegarde(DONNEES, PHRASE)
    expect(await dechiffrerSauvegarde(chiffre, PHRASE)).toEqual(DONNEES)
  })

  it('ne laisse aucune donnée en clair et change à chaque chiffrement (sel et IV aléatoires)', async () => {
    const a = await chiffrerSauvegarde(DONNEES, PHRASE)
    const b = await chiffrerSauvegarde(DONNEES, PHRASE)
    expect(a.includes(Buffer.from('personnelles'))).toBe(false)
    expect(a.equals(b)).toBe(false)
  })

  it('refuse une phrase secrète incorrecte', async () => {
    const chiffre = await chiffrerSauvegarde(DONNEES, PHRASE)
    await expect(dechiffrerSauvegarde(chiffre, 'une autre phrase tout aussi longue')).rejects.toThrow(/incorrecte/)
  })

  it('détecte une sauvegarde altérée', async () => {
    const chiffre = await chiffrerSauvegarde(DONNEES, PHRASE)
    chiffre[chiffre.length - 1] ^= 0xff
    await expect(dechiffrerSauvegarde(chiffre, PHRASE)).rejects.toThrow(/altéré/)
  })

  it('refuse un fichier qui n’est pas une sauvegarde chiffrée', async () => {
    await expect(dechiffrerSauvegarde(Buffer.from('PGDMP en clair'), PHRASE)).rejects.toThrow(/n'est pas/)
  })

  it('refuse une phrase secrète trop courte', async () => {
    await expect(chiffrerSauvegarde(DONNEES, 'trop courte')).rejects.toThrow(/20 caractères/)
  })
})
