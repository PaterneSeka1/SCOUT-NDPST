import type { Response } from 'express'
import { contentDispositionTelechargement } from '../../common/lib/csv'
import { env } from '../../config/env'

// Les corps JSON des routes d'administration sont validés par les schémas Zod
// (*.schemas.ts) au niveau des contrôleurs.

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
