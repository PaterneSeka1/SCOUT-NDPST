import { BadRequestException } from '@nestjs/common'
import { SLUG_REGEX, slugifier } from '@scout/shared'

// Slug unique : celui fourni (validé) ou dérivé du titre, suffixé -2, -3…
// tant qu'il est déjà pris par un autre enregistrement.
export async function slugUnique(
  source: string,
  demande: string | null | undefined,
  dejaPris: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = demande?.trim() ? demande.trim().toLowerCase() : slugifier(source)
  if (!base || !SLUG_REGEX.test(base)) {
    throw new BadRequestException("L'adresse (slug) ne doit contenir que des lettres minuscules, chiffres et tirets")
  }
  let slug = base
  for (let suffixe = 2; await dejaPris(slug); suffixe += 1) {
    if (suffixe > 50) throw new BadRequestException('Adresse (slug) déjà utilisée')
    slug = `${base}-${suffixe}`
  }
  return slug
}
