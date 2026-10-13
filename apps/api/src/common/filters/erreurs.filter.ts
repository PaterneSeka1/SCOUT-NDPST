import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'
import { Prisma } from '../../generated/prisma/client'
import { logger } from '../lib/logger'

const ERREURS_PRISMA: Record<string, [number, string]> = {
  P2002: [HttpStatus.CONFLICT, 'Cette valeur existe déjà'],
  P2025: [HttpStatus.NOT_FOUND, 'Ressource introuvable'],
  P2003: [HttpStatus.CONFLICT, 'Opération impossible : des données liées existent'],
}

// Forme unique des erreurs de l'API : { erreur: string, ...détails }.
// Jamais de trace, de requête SQL ni d'erreur Prisma brute renvoyée au client.
@Catch()
export class FiltreErreurs implements ExceptionFilter {
  catch(exception: unknown, hote: ArgumentsHost) {
    const reponse = hote.switchToHttp().getResponse<Response>()

    if (exception instanceof HttpException) {
      const statut = exception.getStatus()
      const corps = exception.getResponse()
      // Corps déjà au format de l'API (ex. { erreur, details }) : renvoyé tel quel.
      if (typeof corps === 'object' && corps !== null && 'erreur' in corps) {
        reponse.status(statut).json(corps)
        return
      }
      // Route inexistante : Express produit « Cannot GET /… », traduit ici.
      const message = messageDe(corps, exception.message)
      const routeInconnue = statut === HttpStatus.NOT_FOUND && /^Cannot [A-Z]+ /.test(message)
      reponse.status(statut).json({ erreur: routeInconnue ? 'Route introuvable' : message })
      return
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const connue = ERREURS_PRISMA[exception.code]
      if (connue) {
        reponse.status(connue[0]).json({ erreur: connue[1] })
        return
      }
    }

    logger.error('api.erreur_non_geree', exception)
    reponse.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ erreur: 'Erreur interne du serveur' })
  }
}

function messageDe(corps: string | object, defaut: string): string {
  if (typeof corps === 'string') return corps
  const message = (corps as { message?: unknown }).message
  if (Array.isArray(message)) return typeof message[0] === 'string' ? message[0] : defaut
  return typeof message === 'string' ? message : defaut
}
