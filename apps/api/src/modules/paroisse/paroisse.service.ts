import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { estUrlFichierValide } from '@scout/shared'
import { Prisma } from '../../generated/prisma/client'
import { urlPubliqueBase } from '../../common/lib/storage'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'

// Champs modifiables par le Chef de Groupe. Les couleurs de la paroisse ne
// sont plus modifiables par lui (uniquement nom/coordonnées/logo) — pas de
// champ couleur* ici. district n'est plus modifiable en self-service depuis
// que ce champ détermine le périmètre d'autorité d'un Commissaire de District
// — seul ADMIN_PLATEFORME peut le modifier, via /admin/paroisses/[id].
const CHAMPS_MODIFIABLES = ['nom', 'ville', 'diocese', 'ocean', 'adresse', 'telephone', 'email', 'logo'] as const
type ChampModifiable = (typeof CHAMPS_MODIFIABLES)[number]

@Injectable()
export class ParoisseService {
  constructor(private readonly prisma: PrismaService) {}

  // Fiche de la paroisse de l'utilisateur, ouverte à tout compte authentifié
  // rattaché à une paroisse.
  async fiche(utilisateur: UtilisateurSession) {
    const paroisseId = utilisateur.paroisseId
    if (!paroisseId) throw new BadRequestException('Aucune paroisse associée')

    const paroisse = await this.prisma.paroisse.findUnique({
      where: { id: paroisseId },
      include: {
        district: { select: { id: true, nom: true } },
        _count: {
          select: { scouts: true, utilisateurs: true, activites: true },
        },
      },
    })
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')
    return paroisse
  }

  // Mise à jour de la fiche par la direction du groupe (rôle contrôlé par le
  // contrôleur). Seuls les champs listés dans CHAMPS_MODIFIABLES sont lus.
  async modifier(utilisateur: UtilisateurSession, corps: unknown) {
    const paroisseId = utilisateur.paroisseId
    if (!paroisseId) throw new BadRequestException('Aucune paroisse associée')

    if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
      throw new BadRequestException('Données invalides')
    }
    const brut = corps as Record<string, unknown>

    // Tous ces champs sont des textes : un autre type ferait planter `.trim()`.
    const champs: Partial<Record<ChampModifiable, string | null>> = {}
    for (const champ of CHAMPS_MODIFIABLES) {
      const valeur = brut[champ]
      if (valeur === undefined) continue
      if (valeur !== null && typeof valeur !== 'string') {
        throw new BadRequestException(`${champ} doit être une chaîne de caractères`)
      }
      champs[champ] = valeur
    }
    const { nom, ville, diocese, ocean, adresse, telephone, email, logo } = champs

    // Le logo est affiché tel quel dans l'interface : seul un chemin local ou
    // une URL du stockage configuré côté serveur est accepté (jamais une
    // origine fournie par le client).
    if (logo != null && logo.trim() !== '' && !estUrlFichierValide(logo.trim(), urlPubliqueBase())) {
      throw new BadRequestException(
        'logo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
      )
    }

    try {
      return await this.prisma.paroisse.update({
        where: { id: paroisseId },
        data: {
          ...(nom != null ? { nom: nom.trim() } : {}),
          ...(ville != null ? { ville: ville.trim() } : {}),
          ...(diocese != null ? { diocese: diocese.trim() } : {}),
          ...(ocean !== undefined ? { ocean: ocean?.trim() || null } : {}),
          ...(adresse !== undefined ? { adresse: adresse?.trim() || null } : {}),
          ...(telephone !== undefined ? { telephone: telephone?.trim() || null } : {}),
          ...(email !== undefined ? { email: email?.trim() || null } : {}),
          ...(logo !== undefined ? { logo: logo?.trim() || null } : {}),
        },
      })
    } catch (erreur) {
      // Contrainte d'unicité : seul l'e-mail est unique sur Paroisse.
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException('Cette adresse e-mail est déjà utilisée par une autre paroisse')
      }
      throw erreur
    }
  }
}
