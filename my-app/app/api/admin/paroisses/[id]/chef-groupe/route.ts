import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { logger } from '@/lib/logger'
import { envoyerEmailBienvenue } from '@/lib/notifications'

type RouteParams = { params: Promise<{ id: string }> }

// Crée le compte Chef de Groupe d'une paroisse — action délibérément séparée
// de la création de la paroisse elle-même : désigner qui dirige une paroisse
// est une décision humaine, jamais automatisée.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id: paroisseId } = await params
    const paroisse = await prisma.paroisse.findUnique({ where: { id: paroisseId }, select: { id: true } })
    if (!paroisse) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

    const body = await request.json()
    const { nom, prenom, matricule, telephone, email, password } = body as {
      nom?: string; prenom?: string; matricule?: string; telephone?: string; email?: string; password?: string
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
    const chefGroupe = await prisma.utilisateur.create({
      data: {
        nom: nom.trim(),
        prenom: prenom.trim(),
        matricule: matricule.trim(),
        telephone: telephone?.trim() || null,
        email: email?.trim() || null,
        role: 'CHEF_GROUPE',
        password: passwordHache,
        paroisseId,
      },
      select: { id: true, nom: true, prenom: true, matricule: true, telephone: true, email: true, actif: true, createdAt: true },
    })

    if (chefGroupe.email) {
      envoyerEmailBienvenue({
        email: chefGroupe.email,
        prenom: chefGroupe.prenom,
        identifiant: chefGroupe.matricule ?? chefGroupe.telephone ?? chefGroupe.email,
        roleLabel: 'Chef de Groupe',
        nomSite: 'SCOUT ASCCI',
        urlConnexion: `${process.env.NEXTAUTH_URL ?? ''}/login`,
      }).catch((error) => logger.error('admin.paroisses.chef_groupe.email_bienvenue_echoue', error))
    }

    return NextResponse.json(chefGroupe, { status: 201 })
  } catch (error) {
    logger.error('POST /api/admin/paroisses/[id]/chef-groupe', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
