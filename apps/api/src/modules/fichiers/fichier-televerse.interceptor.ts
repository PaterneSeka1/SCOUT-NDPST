import { BadRequestException, CallHandler, ExecutionContext, PayloadTooLargeException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Observable } from 'rxjs'
import { MESSAGE_TROP_VOLUMINEUX, TAILLE_MAX_FICHIER } from './fichiers.service'

// Lecture multipart du champ « fichier » en mémoire (jamais écrit sur disque
// avant la vérification de signature), limitée à 5 Mo comme la route Next.
// Les erreurs de multer sont ramenées aux messages et statuts d'origine :
// fichier trop volumineux → 400, formulaire illisible → 400 « Formulaire invalide ».
// Seule l'analyse multipart est couverte : les erreurs du gestionnaire de
// route passent par next.handle(), hors de ce try/catch.
export class FichierTeleverseInterceptor extends FileInterceptor('fichier', {
  // Ni « storage » ni « dest » : multer conserve le fichier en mémoire
  // (Express.Multer.File.buffer) — multer n'est pas une dépendance directe de l'API.
  limits: { fileSize: TAILLE_MAX_FICHIER, files: 1 },
}) {
  async intercept(contexte: ExecutionContext, suite: CallHandler): Promise<Observable<unknown>> {
    try {
      return await super.intercept(contexte, suite)
    } catch (erreur) {
      if (erreur instanceof PayloadTooLargeException) throw new BadRequestException(MESSAGE_TROP_VOLUMINEUX)
      throw new BadRequestException('Formulaire invalide')
    }
  }
}
