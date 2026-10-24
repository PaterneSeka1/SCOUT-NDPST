// Centralise les icônes (lucide-react, traits fins) utilisées à travers
// l'application, pour qu'une même notion garde toujours le même pictogramme.
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Church, Users, UsersRound, Contact, Leaf, Compass, FileText,
  CalendarDays, Wallet, CalendarRange, Clock, BookOpen, BarChart3, CheckSquare,
  Baby, Award, UserCircle, LogOut, ShieldCheck, Palette,
  Tent, Footprints, HeartHandshake, PartyPopper, GraduationCap, ClipboardList,
  FileSignature, Stethoscope, IdCard, Paperclip, ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, Check, CheckCircle2,
  XCircle, AlertTriangle, Upload, ImageOff, Search, Camera, QrCode, Menu, X,
  Plus, Loader2, Smartphone, Share, PauseCircle, Hourglass, Coins, Repeat,
  Download, History, Info, Bell, Settings, Newspaper, Images, Inbox, Landmark,
  Network, Flag, Mail, Phone, MapPin, Pencil, Trash2, Eye, EyeOff, Archive,
  Globe, Send, Filter, Sparkles, HeartPulse, Server, Database, Route,
  MessageCircle, Quote, ScrollText, Target, Lightbulb,
} from 'lucide-react'

export type { LucideIcon }

// Navigation de l'espace privé — une seule source pour qu'une rubrique
// affiche le même pictogramme partout.
export const NavIcon = {
  tableauDeBord: LayoutDashboard,
  calendrier: CalendarDays,
  notifications: Bell,
  scouts: Compass,
  branches: Leaf,
  maBranche: Leaf,
  maitrise: Network,
  equipes: UsersRound,
  reunions: Clock,
  activites: CalendarRange,
  presences: CheckSquare,
  progression: Award,
  cotisations: Wallet,
  documents: FileText,
  rapports: BarChart3,
  programmes: BookOpen,
  utilisateurs: Users,
  publications: Newspaper,
  galerie: Images,
  histoire: ScrollText,
  demandes: Inbox,
  configuration: Landmark,
  parametres: Settings,
  audit: ShieldCheck,
  parents: Contact,
  mesEnfants: Baby,
  maProgression: Award,
  profil: UserCircle,
  deconnexion: LogOut,
  sitepublic: Globe,
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

// Indicateurs des tableaux de bord — clés `cle` renvoyées par GET /api/tableau-de-bord.
export const ICONES_INDICATEUR: Record<string, LucideIcon> = {
  effectif: Compass,
  maitrise: Network,
  presence: CheckSquare,
  cotisations: Coins,
  enCours: CalendarRange,
  reunions: Clock,
  feuilles: ClipboardList,
  progression: Award,
  comptes: Users,
  demandes: Inbox,
  publications: Newspaper,
  photos: Images,
  enfants: Baby,
}

export const ICONE_INDICATEUR_DEFAUT: LucideIcon = BarChart3

export {
  LayoutDashboard, Church, Users, UsersRound, Contact, Leaf, Compass, FileText,
  CalendarDays, Wallet, CalendarRange, Clock, BookOpen, BarChart3, CheckSquare,
  Baby, Award, UserCircle, LogOut, ShieldCheck, Palette,
  Tent, Footprints, HeartHandshake, PartyPopper, GraduationCap, ClipboardList,
  FileSignature, Stethoscope, IdCard, Paperclip, ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, Check, CheckCircle2,
  XCircle, AlertTriangle, Upload, ImageOff, Search, Camera, QrCode, Menu, X,
  Plus, Loader2, Smartphone, Share, PauseCircle, Hourglass, Coins, Repeat,
  Download, History, Info, Bell, Settings, Newspaper, Images, Inbox, Landmark,
  Network, Flag, Mail, Phone, MapPin, Pencil, Trash2, Eye, EyeOff, Archive,
  Globe, Send, Filter, Sparkles, HeartPulse, Server, Database, Route,
  MessageCircle, Quote, ScrollText, Target, Lightbulb,
}
