import { BadRequestException } from '@nestjs/common'

// Corps JSON attendu sous forme d'objet : chaque champ est ensuite lu et
// contrôlé explicitement par le service, rien n'est transmis tel quel à Prisma.
export function corpsObjet(corps: unknown): Record<string, unknown> {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw new BadRequestException('Données invalides')
  }
  return corps as Record<string, unknown>
}
