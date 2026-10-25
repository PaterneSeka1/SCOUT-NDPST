import {
  ESPACES_FAMILLES_ACTIFS,
  ROLES_ADMIN,
  ROLES_BRANCHE,
  ROLES_GROUPE,
  ROLES_GROUPE_ETENDU,
  ROLES_SUPERVISION,
  ROLES_TOUT_STAFF,
  pageHorsPerimetre,
  peutGererContenus,
} from '@scout/shared'
import { NavIcon, type LucideIcon } from './icons'

export interface ElementNavigation {
  libelle: string
  href: string
  icone: LucideIcon
}

export interface SectionNavigation {
  titre: string
  elements: ElementNavigation[]
}

export interface ProfilNavigation {
  role: string
  editeurContenu: boolean
  habilitationsAdhesion?: { permission: string; brancheType: string | null }[]
}

type Regle = (p: ProfilNavigation) => boolean

const role =
  (...roles: string[][]): Regle =>
  (p) =>
    roles.flat().includes(p.role)
const editeur: Regle = (p) => peutGererContenus(p)
const familles =
  (r: string): Regle =>
  (p) =>
    ESPACES_FAMILLES_ACTIFS && p.role === r

// Arborescence de l'espace privé. Une rubrique n'est affichée que si le
// profil y a droit ; l'API revérifie toujours les droits côté serveur.
const SECTIONS: { titre: string; elements: (ElementNavigation & { visible: Regle })[] }[] = [
  {
    titre: 'Vue générale',
    elements: [
      { libelle: 'Tableau de bord', href: '/dashboard', icone: NavIcon.tableauDeBord, visible: () => true },
      { libelle: 'Calendrier', href: '/dashboard/calendrier', icone: NavIcon.calendrier, visible: role(ROLES_TOUT_STAFF) },
    ],
  },
  {
    titre: 'Gestion du groupe',
    elements: [
      { libelle: 'Scouts', href: '/dashboard/scouts', icone: NavIcon.scouts, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Branches', href: '/dashboard/branches', icone: NavIcon.branches, visible: role(ROLES_GROUPE_ETENDU) },
      { libelle: 'Ma branche', href: '/dashboard/ma-branche', icone: NavIcon.maBranche, visible: role(ROLES_BRANCHE) },
      { libelle: 'Maîtrise', href: '/dashboard/maitrise', icone: NavIcon.maitrise, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Équipes', href: '/dashboard/equipes', icone: NavIcon.equipes, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Comptes de la maîtrise', href: '/dashboard/utilisateurs', icone: NavIcon.utilisateurs, visible: role(ROLES_GROUPE) },
      { libelle: 'Parents', href: '/dashboard/parents', icone: NavIcon.parents, visible: role(ROLES_GROUPE) },
    ],
  },
  {
    titre: 'Activités',
    elements: [
      { libelle: 'Réunions', href: '/dashboard/reunions', icone: NavIcon.reunions, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Activités et camps', href: '/dashboard/activites', icone: NavIcon.activites, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Présences', href: '/dashboard/presences', icone: NavIcon.presences, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Programmes', href: '/dashboard/programmes', icone: NavIcon.programmes, visible: role(ROLES_TOUT_STAFF) },
    ],
  },
  {
    titre: 'Suivi',
    elements: [
      { libelle: 'Progression pédagogique', href: '/dashboard/progression', icone: NavIcon.progression, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Adhésions nationales', href: '/dashboard/adhesions-nationales', icone: NavIcon.cotisations, visible: p => !!p.habilitationsAdhesion?.length },
      { libelle: 'Mandats', href: '/dashboard/mandats', icone: NavIcon.maitrise, visible: role(ROLES_TOUT_STAFF, ROLES_ADMIN) },
      { libelle: 'Cotisations locales (historique)', href: '/dashboard/cotisations', icone: NavIcon.cotisations, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Documents', href: '/dashboard/documents', icone: NavIcon.documents, visible: role(ROLES_TOUT_STAFF) },
      { libelle: 'Rapports', href: '/dashboard/rapports', icone: NavIcon.rapports, visible: role(ROLES_GROUPE, ROLES_ADMIN) },
    ],
  },
  {
    titre: 'Mon espace',
    elements: [
      { libelle: 'Mes enfants', href: '/dashboard/mes-enfants', icone: NavIcon.mesEnfants, visible: familles('PARENT') },
      { libelle: 'Ma progression', href: '/dashboard/ma-progression', icone: NavIcon.maProgression, visible: familles('SCOUT') },
    ],
  },
  {
    titre: 'Administration',
    elements: [
      { libelle: 'Habilitations financières', href: '/admin/habilitations-financieres', icone: NavIcon.cotisations, visible: role(ROLES_ADMIN) },
      { libelle: 'Utilisateurs', href: '/admin/utilisateurs', icone: NavIcon.utilisateurs, visible: role(ROLES_ADMIN) },
      { libelle: 'Publications', href: '/admin/publications', icone: NavIcon.publications, visible: editeur },
      { libelle: 'Galerie', href: '/admin/galerie', icone: NavIcon.galerie, visible: editeur },
      { libelle: 'Histoire du groupe', href: '/admin/histoire', icone: NavIcon.histoire, visible: editeur },
      { libelle: 'Présentation des branches', href: '/admin/branches', icone: NavIcon.branches, visible: editeur },
      { libelle: "Demandes d'adhésion", href: '/admin/demandes', icone: NavIcon.demandes, visible: role(ROLES_ADMIN, ROLES_GROUPE_ETENDU) },
      { libelle: 'Identité et configuration', href: '/admin/configuration', icone: NavIcon.configuration, visible: role(ROLES_ADMIN) },
      { libelle: "Journal d'audit", href: '/admin/audit', icone: NavIcon.audit, visible: role(ROLES_SUPERVISION) },
    ],
  },
]

export function navigationPour(profil: ProfilNavigation): SectionNavigation[] {
  return SECTIONS.map((s) => ({
    titre: s.titre,
    elements: s.elements.filter((e) => e.visible(profil) && !pageHorsPerimetre(e.href)).map(({ libelle, href, icone }) => ({ libelle, href, icone })),
  })).filter((s) => s.elements.length > 0)
}

/** Rubrique active : la plus longue correspondance de préfixe. */
export function rubriqueActive(sections: SectionNavigation[], chemin: string): ElementNavigation | undefined {
  return sections
    .flatMap((s) => s.elements)
    .filter((e) => (e.href === '/dashboard' ? chemin === '/dashboard' : chemin === e.href || chemin.startsWith(`${e.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

/** Une page privée est-elle accessible à ce profil ? (garde d'interface, l'API reste juge) */
export function pageAutorisee(profil: ProfilNavigation, chemin: string): boolean {
  if (chemin === '/dashboard' || chemin.startsWith('/dashboard/profil')) return true
  return !!rubriqueActive(navigationPour(profil), chemin)
}
