import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_BRANCHES } from '@/lib/branches'
import { LABELS_STATUT_COTISATION, LABELS_TYPE_COTISATION } from '@/lib/cotisations'
import { champCsv as champ, contentDispositionTelechargement } from '@/lib/csv'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { LABELS_ROLES, ROLES_PLATEFORME, libelleRoleAvecFonction } from '@/lib/roles'

const BOM_UTF8 = '﻿'
const TYPES_EXPORT = ['synthese', 'scouts', 'utilisateurs', 'activites', 'cotisations'] as const
type TypeExport = (typeof TYPES_EXPORT)[number]

const LABELS_SEXE: Record<string, string> = { MASCULIN: 'Masculin', FEMININ: 'Féminin' }

function estTypeExport(valeur: string | null): valeur is TypeExport {
  return TYPES_EXPORT.includes(valeur as TypeExport)
}

function dateFichier(): string {
  return new Date().toISOString().slice(0, 10)
}

function reponseCsv(nomFichier: string, lignes: string[]): NextResponse {
  return new NextResponse(BOM_UTF8 + lignes.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': contentDispositionTelechargement(nomFichier),
    },
  })
}

async function exporterSynthese() {
  const paroisses = await prisma.paroisse.findMany({
    include: {
      district: { select: { nom: true } },
      _count: {
        select: {
          scouts: true,
          utilisateurs: true,
          activites: true,
          cotisations: true,
        },
      },
    },
    orderBy: [{ district: { nom: 'asc' } }, { nom: 'asc' }],
  })

  return reponseCsv(`rapport-synthese-paroisses_${dateFichier()}.csv`, [
    '"District";"Paroisse";"Ville";"Diocèse";"Statut";"Scouts";"Utilisateurs";"Activités";"Cotisations"',
    ...paroisses.map((p) => [
      champ(p.district.nom),
      champ(p.nom),
      champ(p.ville),
      champ(p.diocese),
      champ(p.actif ? 'Active' : 'Désactivée'),
      p._count.scouts,
      p._count.utilisateurs,
      p._count.activites,
      p._count.cotisations,
    ].join(';')),
  ])
}

async function exporterScouts() {
  const scouts = await prisma.scout.findMany({
    select: {
      nom: true,
      prenom: true,
      matricule: true,
      brancheType: true,
      sexe: true,
      dateNaissance: true,
      actif: true,
      paroisse: { select: { nom: true, ville: true, district: { select: { nom: true } } } },
      utilisateur: { select: { matricule: true } },
      _count: { select: { contactsUrgence: true, documents: true, cotisations: true } },
    },
    orderBy: [{ paroisse: { nom: 'asc' } }, { nom: 'asc' }, { prenom: 'asc' }],
  })

  return reponseCsv(`rapport-scouts_${dateFichier()}.csv`, [
    '"District";"Paroisse";"Ville";"Nom";"Prénom";"Matricule";"Branche";"Sexe";"Date de naissance";"Compte";"Contacts";"Documents";"Cotisations";"Statut"',
    ...scouts.map((s) => [
      champ(s.paroisse.district.nom),
      champ(s.paroisse.nom),
      champ(s.paroisse.ville),
      champ(s.nom.toUpperCase()),
      champ(s.prenom),
      champ(s.matricule),
      champ(LABELS_BRANCHES[s.brancheType] ?? s.brancheType),
      champ(LABELS_SEXE[s.sexe] ?? s.sexe),
      champ(new Date(s.dateNaissance).toLocaleDateString('fr-FR')),
      champ(s.utilisateur ? 'Oui' : 'Non'),
      s._count.contactsUrgence,
      s._count.documents,
      s._count.cotisations,
      champ(s.actif ? 'Actif' : 'Inactif'),
    ].join(';')),
  ])
}

async function exporterUtilisateurs() {
  const utilisateurs = await prisma.utilisateur.findMany({
    where: { role: { not: 'ADMIN_PLATEFORME' } },
    select: {
      nom: true,
      prenom: true,
      matricule: true,
      telephone: true,
      email: true,
      role: true,
      fonction: true,
      brancheType: true,
      roleDistrict: true,
      fonctionDistrict: true,
      brancheTypeDistrict: true,
      actif: true,
      paroisse: { select: { nom: true, ville: true, district: { select: { nom: true } } } },
    },
    orderBy: [{ paroisse: { nom: 'asc' } }, { role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
  })

  return reponseCsv(`rapport-utilisateurs_${dateFichier()}.csv`, [
    '"District";"Paroisse";"Ville";"Nom";"Prénom";"Matricule";"Téléphone";"Email";"Rôle paroissial";"Affectation district";"Statut"',
    ...utilisateurs.map((u) => [
      champ(u.paroisse?.district.nom),
      champ(u.paroisse?.nom),
      champ(u.paroisse?.ville),
      champ(u.nom.toUpperCase()),
      champ(u.prenom),
      champ(u.matricule),
      champ(u.telephone),
      champ(u.email),
      champ(libelleRoleAvecFonction(u.role, u.fonction, u.brancheType)),
      champ(u.roleDistrict ? libelleRoleAvecFonction(u.roleDistrict, u.fonctionDistrict, u.brancheTypeDistrict) : ''),
      champ(u.actif ? 'Actif' : 'Inactif'),
    ].join(';')),
  ])
}

async function exporterActivites() {
  const activites = await prisma.activite.findMany({
    select: {
      titre: true,
      type: true,
      brancheType: true,
      dateDebut: true,
      dateFin: true,
      lieu: true,
      paroisse: { select: { nom: true, ville: true, district: { select: { nom: true } } } },
      creeParUtilisateur: { select: { nom: true, prenom: true, role: true } },
      _count: { select: { presences: true, autorisationsCamp: true } },
    },
    orderBy: [{ dateDebut: 'desc' }, { paroisse: { nom: 'asc' } }],
  })

  return reponseCsv(`rapport-activites_${dateFichier()}.csv`, [
    '"District";"Paroisse";"Ville";"Titre";"Type";"Branche";"Date début";"Date fin";"Lieu";"Présences";"Autorisations camp";"Créé par";"Rôle créateur"',
    ...activites.map((a) => [
      champ(a.paroisse.district.nom),
      champ(a.paroisse.nom),
      champ(a.paroisse.ville),
      champ(a.titre),
      champ(LABELS_TYPE_ACTIVITE[a.type] ?? a.type),
      champ(a.brancheType ? LABELS_BRANCHES[a.brancheType] ?? a.brancheType : 'Toutes les branches'),
      champ(new Date(a.dateDebut).toLocaleString('fr-FR')),
      champ(a.dateFin ? new Date(a.dateFin).toLocaleString('fr-FR') : ''),
      champ(a.lieu),
      a._count.presences,
      a._count.autorisationsCamp,
      champ(`${a.creeParUtilisateur.prenom} ${a.creeParUtilisateur.nom}`),
      champ(LABELS_ROLES[a.creeParUtilisateur.role] ?? a.creeParUtilisateur.role),
    ].join(';')),
  ])
}

async function exporterCotisations() {
  const cotisations = await prisma.cotisation.findMany({
    select: {
      type: true,
      libelle: true,
      montant: true,
      montantPaye: true,
      anneeScolaire: true,
      statut: true,
      datePaiement: true,
      modePaiement: true,
      scout: { select: { nom: true, prenom: true, matricule: true, brancheType: true } },
      paroisse: { select: { nom: true, ville: true, district: { select: { nom: true } } } },
    },
    orderBy: [{ anneeScolaire: 'desc' }, { paroisse: { nom: 'asc' } }, { scout: { nom: 'asc' } }],
  })

  return reponseCsv(`rapport-cotisations_${dateFichier()}.csv`, [
    '"District";"Paroisse";"Ville";"Scout";"Matricule";"Branche";"Année scolaire";"Type";"Libellé";"Montant dû";"Montant payé";"Reste à payer";"Statut";"Date paiement";"Mode paiement"',
    ...cotisations.map((c) => [
      champ(c.paroisse.district.nom),
      champ(c.paroisse.nom),
      champ(c.paroisse.ville),
      champ(`${c.scout.prenom} ${c.scout.nom}`),
      champ(c.scout.matricule),
      champ(LABELS_BRANCHES[c.scout.brancheType] ?? c.scout.brancheType),
      champ(c.anneeScolaire),
      champ(LABELS_TYPE_COTISATION[c.type] ?? c.type),
      champ(c.libelle),
      c.montant,
      c.montantPaye,
      Math.max(0, c.montant - c.montantPaye),
      champ(LABELS_STATUT_COTISATION[c.statut] ?? c.statut),
      champ(c.datePaiement ? new Date(c.datePaiement).toLocaleDateString('fr-FR') : ''),
      champ(c.modePaiement),
    ].join(';')),
  ])
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new NextResponse('Non authentifié', { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) return new NextResponse('Accès refusé', { status: 403 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    if (!estTypeExport(type)) return new NextResponse('Type d’export invalide', { status: 400 })

    const reponse = await ({
      synthese: exporterSynthese,
      scouts: exporterScouts,
      utilisateurs: exporterUtilisateurs,
      activites: exporterActivites,
      cotisations: exporterCotisations,
    } satisfies Record<TypeExport, () => Promise<NextResponse>>)[type]()

    await enregistrerAudit({
      paroisseId: null,
      acteurId: session.user.id,
      action: 'RAPPORT_PLATEFORME_EXPORTE',
      entite: 'RapportPlateforme',
      entiteId: type,
      details: { type },
    })

    return reponse
  } catch (error) {
    logger.error('GET /api/admin/rapports/export', error)
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
