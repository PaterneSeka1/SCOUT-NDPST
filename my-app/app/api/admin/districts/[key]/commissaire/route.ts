import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { normaliserDoyenne } from '@/lib/district'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { enregistrerAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { envoyerEmailBienvenue } from '@/lib/notifications'

type RouteParams = { params: Promise<{ key: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { key } = await params
    const doyenneCible = decodeURIComponent(key)

    const body = await request.json()
    const { paroisseId, nom, prenom, matricule, telephone, email, password } = body as {
      paroisseId?: string; nom?: string; prenom?: string; matricule?: string; telephone?: string; email?: string; password?: string
    }

    if (!paroisseId?.trim()) {
      return NextResponse.json({ erreur: 'La paroisse est requise' }, { status: 400 })
    }

    const paroisse = await prisma.paroisse.findUnique({ where: { id: paroisseId }, select: { id: true, doyenne: true } })
    if (!paroisse) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

    if (normaliserDoyenne(paroisse.doyenne) !== doyenneCible) {
      return NextResponse.json({ erreur: "Cette paroisse n'appartient pas à ce district" }, { status: 400 })
    }

    const commissaireExistant = await prisma.utilisateur.findFirst({
      where: { role: 'COMMISSAIRE_DISTRICT', actif: true, paroisse: { doyenne: doyenneCible } },
      select: { id: true },
    })
    if (commissaireExistant) {
      return NextResponse.json(
        { erreur: 'Un Commissaire de District actif existe déjà pour ce district. Désactivez-le avant d\'en désigner un nouveau.' },
        { status: 409 },
      )
    }

    if (!nom?.trim() || !prenom?.trim() || !matricule?.trim() || !password) {
      return NextResponse.json({ erreur: 'Le nom, le prénom, le matricule et le mot de passe sont requis' }, { status: 400 })
    }

    if (!motDePasseValide(password)) {
      return NextResponse.json({ erreur: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    const doublonMatricule = await prisma.utilisateur.findUnique({ where: { matricule: matricule.trim() }, select: { id: true } })
    if (doublonMatricule) return NextResponse.json({ erreur: 'Ce matricule est déjà utilisé' }, { status: 400 })

    if (telephone?.trim()) {
      const doublonTel = await prisma.utilisateur.findUnique({ where: { telephone: telephone.trim() }, select: { id: true } })
      if (doublonTel) return NextResponse.json({ erreur: 'Ce numéro de téléphone est déjà utilisé' }, { status: 400 })
    }

    if (email?.trim()) {
      const doublonEmail = await prisma.utilisateur.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } }, select: { id: true } })
      if (doublonEmail) return NextResponse.json({ erreur: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
    }

    const passwordHache = await hash(password, 12)
    const commissaire = await prisma.utilisateur.create({
      data: {
        nom: nom.trim(),
        prenom: prenom.trim(),
        matricule: matricule.trim(),
        telephone: telephone?.trim() || null,
        email: email?.trim() || null,
        role: 'COMMISSAIRE_DISTRICT',
        password: passwordHache,
        paroisseId: paroisse.id,
      },
      select: { id: true, nom: true, prenom: true, matricule: true, telephone: true, email: true, actif: true, createdAt: true },
    })

    await enregistrerAudit({
      paroisseId: paroisse.id,
      acteurId: session.user.id,
      action: 'UTILISATEUR_CREE',
      entite: 'Utilisateur',
      entiteId: commissaire.id,
      details: { role: 'COMMISSAIRE_DISTRICT' },
    })

    if (commissaire.email) {
      envoyerEmailBienvenue({
        email: commissaire.email,
        prenom: commissaire.prenom,
        identifiant: commissaire.matricule ?? commissaire.telephone ?? commissaire.email,
        roleLabel: 'Commissaire de District',
        nomSite: 'SCOUT ASCCI',
        urlConnexion: `${process.env.NEXTAUTH_URL ?? ''}/login`,
      }).catch((error) => logger.error('admin.districts.commissaire.email_bienvenue_echoue', error))
    }

    return NextResponse.json(commissaire, { status: 201 })
  } catch (error) {
    logger.error('POST /api/admin/districts/[key]/commissaire', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
