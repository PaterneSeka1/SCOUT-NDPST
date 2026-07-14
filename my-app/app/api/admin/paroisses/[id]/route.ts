import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { estCouleurHexValide } from '@/lib/theme'
import { estUrlFichierValide } from '@/lib/validation'
import { urlPubliqueBase } from '@/lib/storage'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const { id } = await params
  const paroisse = await prisma.paroisse.findUnique({
    where: { id },
    include: {
      district: { select: { id: true, nom: true } },
      _count: { select: { scouts: true, utilisateurs: true, activites: true } },
      utilisateurs: {
        where: { role: { not: 'ADMIN_PLATEFORME' } },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          telephone: true,
          email: true,
          actif: true,
          role: true,
          fonction: true,
          brancheType: true,
          roleDistrict: true,
          fonctionDistrict: true,
          brancheTypeDistrict: true,
          createdAt: true,
        },
        orderBy: [{ role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
      },
    },
  })

  if (!paroisse) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

  const { utilisateurs: membres, _count: counts, ...infos } = paroisse
  const chefsGroupe = membres.filter((membre) => membre.role === 'CHEF_GROUPE')
  return NextResponse.json({ ...infos, counts, chefsGroupe, membres })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const existante = await prisma.paroisse.findUnique({ where: { id }, select: { id: true, actif: true } })
    if (!existante) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

    const body = await request.json()
    const {
      nom, ville, diocese, ocean, districtId, adresse, telephone, email, logo, actif,
      couleurPrimaire, couleurAccent, couleurFond, couleurHover,
    } = body as {
      nom?: string; ville?: string; diocese?: string; ocean?: string; districtId?: string
      adresse?: string; telephone?: string; email?: string; logo?: string; actif?: boolean
      couleurPrimaire?: string; couleurAccent?: string; couleurFond?: string; couleurHover?: string
    }

    if (logo != null && logo.trim() !== '' && !estUrlFichierValide(logo.trim(), urlPubliqueBase())) {
      return NextResponse.json({ erreur: 'logo doit être un chemin local (ex : /uploads/…) ou une URL de stockage autorisée' }, { status: 400 })
    }

    // Toute paroisse appartient à un district — jamais nul, donc jamais vidable ici.
    if (districtId !== undefined) {
      if (!districtId.trim()) {
        return NextResponse.json({ erreur: 'Le district est obligatoire' }, { status: 400 })
      }
      const districtExiste = await prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
      if (!districtExiste) {
        return NextResponse.json({ erreur: 'District invalide' }, { status: 400 })
      }
    }

    for (const [champ, valeur] of Object.entries({ couleurPrimaire, couleurAccent, couleurFond, couleurHover })) {
      if (valeur != null && valeur.trim() !== '' && !estCouleurHexValide(valeur)) {
        return NextResponse.json({ erreur: `${champ} doit être une couleur hexadécimale valide (ex : #1a4731)` }, { status: 400 })
      }
    }

    const paroisse = await prisma.paroisse.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom: nom.trim() } : {}),
        ...(ville !== undefined ? { ville: ville.trim() } : {}),
        ...(diocese !== undefined ? { diocese: diocese.trim() } : {}),
        ...(ocean !== undefined ? { ocean: ocean.trim() || null } : {}),
        ...(districtId !== undefined ? { districtId } : {}),
        ...(adresse !== undefined ? { adresse: adresse.trim() || null } : {}),
        ...(telephone !== undefined ? { telephone: telephone.trim() || null } : {}),
        ...(email !== undefined ? { email: email.trim() || null } : {}),
        ...(logo !== undefined ? { logo: logo.trim() || null } : {}),
        ...(actif !== undefined ? { actif } : {}),
        ...(couleurPrimaire !== undefined ? { couleurPrimaire: couleurPrimaire.trim() || null } : {}),
        ...(couleurAccent !== undefined ? { couleurAccent: couleurAccent.trim() || null } : {}),
        ...(couleurFond !== undefined ? { couleurFond: couleurFond.trim() || null } : {}),
        ...(couleurHover !== undefined ? { couleurHover: couleurHover.trim() || null } : {}),
      },
    })

    // Désactiver une paroisse bloque la connexion de tout son personnel
    // (voir lib/auth.ts) : action sensible à journaliser, dans les deux sens.
    if (actif !== undefined && actif !== existante.actif) {
      await enregistrerAudit({
        paroisseId: id,
        acteurId: session.user.id,
        action: actif ? 'PAROISSE_REACTIVEE' : 'PAROISSE_DESACTIVEE',
        entite: 'Paroisse',
        entiteId: id,
      })
    }

    return NextResponse.json(paroisse)
  } catch (error) {
    logger.error('PATCH /api/admin/paroisses/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    // Suppression physique volontairement stricte : cette application ne
    // supprime jamais un Scout ou un Utilisateur (toujours désactivé, pour
    // conserver l'historique — voir passage-branche, désactivation compte…).
    // Une Paroisse suit la même règle dès qu'elle a la moindre donnée réelle :
    // seule une paroisse vide (créée par erreur, jamais utilisée) peut être
    // supprimée pour de bon. Toute paroisse ayant déjà une activité doit être
    // désactivée (PATCH actif=false), jamais supprimée.
    const paroisse = await prisma.paroisse.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        _count: {
          select: {
            scouts: true,
            utilisateurs: true,
            activites: true,
            joursReunion: true,
            configsReunion: true,
            programmes: true,
            journalAudit: true,
            cotisations: true,
          },
        },
      },
    })
    if (!paroisse) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

    const totalDependants = Object.values(paroisse._count).reduce((s, n) => s + n, 0)
    if (totalDependants > 0) {
      return NextResponse.json(
        {
          erreur: 'Cette paroisse a déjà des données rattachées (membres, scouts, activités…) et ne peut pas être supprimée. Désactivez-la plutôt (bascule "Paroisse active" dans le formulaire).',
        },
        { status: 409 },
      )
    }

    await prisma.paroisse.delete({ where: { id } })

    // paroisseId volontairement null (portée plateforme) : la paroisse elle-même
    // n'existe plus, et JournalAudit.paroisseId est en Restrict — y référencer
    // l'id supprimé bloquerait justement la suppression qu'on vient de faire.
    await enregistrerAudit({
      paroisseId: null,
      acteurId: session.user.id,
      action: 'PAROISSE_SUPPRIMEE',
      entite: 'Paroisse',
      entiteId: id,
      details: { nom: paroisse.nom },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('DELETE /api/admin/paroisses/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
