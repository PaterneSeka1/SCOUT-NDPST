import { BadRequestException, PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

// Valide un corps, une query ou un paramètre avec un schéma Zod (de
// préférence partagé via @scout/shared, pour que le frontend applique la
// même règle). Rejette en 400 avec le premier message d'erreur.
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(valeur: unknown): T {
    const resultat = this.schema.safeParse(valeur)
    if (!resultat.success) {
      const premiere = resultat.error.issues[0]
      throw new BadRequestException({ erreur: premiere?.message ?? 'Données invalides' })
    }
    return resultat.data
  }
}
