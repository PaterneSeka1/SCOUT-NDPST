import { BadRequestException } from '@nestjs/common'
import type { Response } from 'express'
import { contentDispositionTelechargement } from '../../common/lib/csv'
import { env } from '../../config/env'

// Corps JSON d'une requête d'administration, lu champ par champ : jamais
// transmis tel quel à Prisma.
export type Corps = Record<string, unknown>

export function corpsObjet(corps: unknown): Corps {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw new BadRequestException('Données invalides')
  }
  return corps as Corps
}

// Champ texte optionnel : undefined s'il est absent, chaîne vide s'il vaut
// null (effacement), rejet en 400 s'il est d'un autre type — la route Next
// échouait alors en 500 sur un `.trim()` appliqué à un non-texte.
export function texteOptionnel(corps: Corps, cle: string): string | undefined {
  const valeur = corps[cle]
  if (valeur === undefined) return undefined
  if (valeur === null) return ''
  if (typeof valeur !== 'string') throw new BadRequestException(`Le champ ${cle} est invalide`)
  return valeur
}

export function booleenOptionnel(corps: Corps, cle: string): boolean | undefined {
  const valeur = corps[cle]
  if (valeur === undefined) return undefined
  if (typeof valeur !== 'boolean') throw new BadRequestException(`Le champ ${cle} est invalide`)
  return valeur
}

// Paramètre de requête (query string) : Express peut fournir un tableau ou un
// objet pour un paramètre répété ou imbriqué — seule une chaîne est retenue.
export function parametre(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null
}

export function entierBorneRequete(valeur: unknown, defaut: number, max?: number): number {
  const lu = parseInt(parametre(valeur) ?? String(defaut), 10)
  const entier = Number.isNaN(lu) ? defaut : lu
  const minimum = Math.max(1, entier)
  return max === undefined ? minimum : Math.min(max, minimum)
}

// Lien de connexion inséré dans l'e-mail de bienvenue.
export function urlConnexion(): string {
  return `${env().URL_FRONTEND_PAROISSE.replace(/\/$/, '')}/login`
}

const BOM_UTF8 = '﻿'

export interface FichierCsv {
  nomFichier: string
  lignes: string[]
}

export function envoyerCsv(reponse: Response, fichier: FichierCsv): void {
  reponse.setHeader('Content-Type', 'text/csv; charset=utf-8')
  reponse.setHeader('Content-Disposition', contentDispositionTelechargement(fichier.nomFichier))
  reponse.status(200).send(BOM_UTF8 + fichier.lignes.join('\r\n'))
}

export function dateFichier(): string {
  return new Date().toISOString().slice(0, 10)
}

export const LABELS_SEXE: Record<string, string> = { MASCULIN: 'Masculin', FEMININ: 'Féminin' }
