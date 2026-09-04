// Centralise les icônes (lucide-react, traits fins) utilisées à travers
// l'application, pour qu'une même notion garde toujours le même pictogramme
// (navigation, types d'activité/document, cartes KPI). Remplace les emoji
// utilisés jusqu'ici comme icônes ad hoc — un emoji rendu différemment selon
// la police du système n'a pas sa place dans une interface professionnelle.
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Church, Users, UsersRound, Contact, Leaf, Compass, FileText,
  CalendarDays, Wallet, CalendarRange, Clock, BookOpen, BarChart3, CheckSquare,
  Baby, Building2, Award, UserCircle, LogOut, Map, ShieldCheck, Palette,
  Tent, Footprints, HeartHandshake, PartyPopper, GraduationCap, ClipboardList,
  FileSignature, Stethoscope, IdCard, Paperclip, ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight, ChevronDown, ExternalLink, Check, CheckCircle2,
  XCircle, AlertTriangle, Upload, ImageOff, Search, Camera, QrCode, Menu, X,
  Plus, Loader2, Smartphone, Share, PauseCircle, Hourglass, Coins, Repeat,
  Download, History,
} from 'lucide-react'

export type { LucideIcon }

// Icônes de navigation (sidebars Admin / Dashboard / District) — une seule
// source pour que "Paroisse" ou "Rapports" affiche le même pictogramme quel
// que soit l'espace.
export const NavIcon = {
  tableauDeBord: LayoutDashboard,
  paroisse: Church,
  paroisses: Church,
  districts: Map,
  espaceDistrict: Building2,
  membres: Users,
  parents: Contact,
  branches: Leaf,
  maBranche: Leaf,
  scouts: Compass,
  documents: FileText,
  calendrier: CalendarDays,
  cotisations: Wallet,
  activites: CalendarRange,
  reunions: Clock,
  programmes: BookOpen,
  rapports: BarChart3,
  presences: CheckSquare,
  mesEnfants: Baby,
  maProgression: Award,
  equipe: UsersRound,
  audit: ShieldCheck,
  apparence: Palette,
  profil: UserCircle,
  deconnexion: LogOut,
} satisfies Record<string, LucideIcon>

// Types d'activité — clés alignées sur l'enum Prisma TypeActivite.
export const ICONES_TYPE_ACTIVITE: Record<string, LucideIcon> = {
  REUNION: ClipboardList,
  SORTIE: Footprints,
  CAMP: Tent,
  SERVICE: HeartHandshake,
  CELEBRATION: PartyPopper,
  FORMATION: GraduationCap,
  AUTRE: ClipboardList,
}

// Types de document — clés alignées sur l'enum Prisma TypeDocument.
export const ICONES_TYPE_DOCUMENT: Record<string, LucideIcon> = {
  AUTORISATION_PARENTALE: FileSignature,
  CERTIFICAT_MEDICAL: Stethoscope,
  PHOTO_IDENTITE: IdCard,
  AUTRE: Paperclip,
}

// Icônes des cartes KPI (tableaux de bord Dashboard / Admin / District,
// pages Rapports) — clés alignées sur les libellés renvoyés par les routes
// /api/dashboard/kpis, /api/admin/rapports, /api/district/rapports.
export const ICONES_KPI: Record<string, LucideIcon> = {
  'Scouts actifs': Compass,
  'Scouts inactifs': PauseCircle,
  'Scouts (toutes paroisses)': Compass,
  'Scouts dans la branche': Compass,
  'Activités ce mois': CalendarRange,
  'Réunions ce mois': Clock,
  'Prochaines activités': CalendarRange,
  'Activités participées': CalendarRange,
  'Activités': CalendarRange,
  'Taux de présence': CheckSquare,
  'Présences ce mois': CheckSquare,
  'Branches actives': Leaf,
  'Branches': Leaf,
  'Mes enfants': Baby,
  'Badges obtenus': Award,
  'Paroisses actives': Church,
  'Utilisateurs': Users,
  'Cotisations payées': Coins,
  'Cotisations en attente': Hourglass,
}

export const ICONE_KPI_DEFAUT: LucideIcon = BarChart3

export {
  LayoutDashboard, Church, Users, UsersRound, Contact, Leaf, Compass, FileText,
  CalendarDays, Wallet, CalendarRange, Clock, BookOpen, BarChart3, CheckSquare,
  Baby, Building2, Award, UserCircle, LogOut, Map, ShieldCheck, Palette,
  Tent, Footprints, HeartHandshake, PartyPopper, GraduationCap, ClipboardList,
  FileSignature, Stethoscope, IdCard, Paperclip, ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight, ChevronDown, ExternalLink, Check, CheckCircle2,
  XCircle, AlertTriangle, Upload, ImageOff, Search, Camera, QrCode, Menu, X,
  Plus, Loader2, Smartphone, Share, PauseCircle, Hourglass, Coins, Repeat,
  Download, History,
}
