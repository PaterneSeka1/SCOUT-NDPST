import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { hash } from 'bcryptjs'
import {
  estCouleurHexValide,
  estUrlFichierValide,
  LABELS_BRANCHES,
  LABELS_ROLES,
  MONO_PAROISSE,
  motDePasseValide,
  REGLE_MOT_DE_PASSE,
} from '@scout/shared'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../../common/audit.service'
import { AuthService } from '../../auth/auth.service'
import { champCsv as champ } from '../../common/lib/csv'
import { logger } from '../../common/lib/logger'
import { envoyerEmailBienvenue } from '../../common/lib/notifications'
import { urlPubliqueBase } from '../../common/lib/storage'
import {
  booleenOptionnel,
  corpsObjet,
  dateFichier,
  type FichierCsv,
  LABELS_SEXE,
  texteOptionnel,
  urlConnexion,
} from './admin.utils'

function slugNom(nom: string): string {
  return nom.toLowerCase().replace(/\s+/g, '-')
}

@Injectable()
export class ParoissesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async lister() {
    const paroisses = await this.prisma.paroisse.findMany({
      include: {
        _count: { select: { scouts: true, utilisateurs: true, activites: true } },
        utilisateurs: {
          where: { role: 'CHEF_GROUPE' },
          select: { id: true, nom: true, prenom: true },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { nom: 'asc' },
    })

    return paroisses.map((p) => ({
      id: p.id,
      nom: p.nom,
      ville: p.ville,
      diocese: p.diocese,
      actif: p.actif,
      createdAt: p.createdAt,
      counts: p._count,
      chefGroupe: p.utilisateurs[0] ?? null,
    }))
  }

  async creer(corpsBrut: unknown) {
    if (MONO_PAROISSE) {
      const nbParoisses = await this.prisma.paroisse.count()
      if (nbParoisses >= 1) {
        throw new BadRequestException(
          'Cette version ne prend en charge qu’une seule paroisse. La création d’une paroisse supplémentaire est désactivée.',
        )
      }
    }

    const corps = corpsObjet(corpsBrut)
    const nom = texteOptionnel(corps, 'nom')?.trim()
    const ville = texteOptionnel(corps, 'ville')?.trim()
    const diocese = texteOptionnel(corps, 'diocese')?.trim()
    const districtId = texteOptionnel(corps, 'districtId')?.trim()
    const ocean = texteOptionnel(corps, 'ocean')
    const adresse = texteOptionnel(corps, 'adresse')
    const telephone = texteOptionnel(corps, 'telephone')
    const email = texteOptionnel(corps, 'email')?.trim()

    if (!nom || !ville || !diocese || !districtId) {
      throw new BadRequestException('Le nom, la ville, le diocèse et le district sont obligatoires')
    }

    const district = await this.prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
    if (!district) throw new BadRequestException('District invalide')

    if (email) {
      const doublon = await this.prisma.paroisse.findUnique({ where: { email }, select: { id: true } })
      if (doublon) throw new BadRequestException('Cette adresse e-mail est déjà utilisée par une autre paroisse')
    }

    return this.prisma.paroisse.create({
      data: {
        nom,
        ville,
        diocese,
        ocean: ocean?.trim() || null,
        districtId: district.id,
        adresse: adresse?.trim() || null,
        telephone: telephone?.trim() || null,
        email: email || null,
      },
    })
  }

  async detail(id: string) {
    const paroisse = await this.prisma.paroisse.findUnique({
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
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')

    const { utilisateurs: membres, _count: counts, ...infos } = paroisse
    const chefsGroupe = membres.filter((membre) => membre.role === 'CHEF_GROUPE')
    return { ...infos, counts, chefsGroupe, membres }
  }

  async modifier(id: string, corpsBrut: unknown, acteurId: string) {
    const existante = await this.prisma.paroisse.findUnique({ where: { id }, select: { id: true, actif: true } })
    if (!existante) throw new NotFoundException('Paroisse introuvable')

    const corps = corpsObjet(corpsBrut)
    const nom = texteOptionnel(corps, 'nom')
    const ville = texteOptionnel(corps, 'ville')
    const diocese = texteOptionnel(corps, 'diocese')
    const ocean = texteOptionnel(corps, 'ocean')
    const districtId = texteOptionnel(corps, 'districtId')
    const adresse = texteOptionnel(corps, 'adresse')
    const telephone = texteOptionnel(corps, 'telephone')
    const email = texteOptionnel(corps, 'email')
    const logo = texteOptionnel(corps, 'logo')
    const actif = booleenOptionnel(corps, 'actif')
    const couleurs = {
      couleurPrimaire: texteOptionnel(corps, 'couleurPrimaire'),
      couleurAccent: texteOptionnel(corps, 'couleurAccent'),
      couleurFond: texteOptionnel(corps, 'couleurFond'),
      couleurHover: texteOptionnel(corps, 'couleurHover'),
    }

    if (logo != null && logo.trim() !== '' && !estUrlFichierValide(logo.trim(), urlPubliqueBase())) {
      throw new BadRequestException(
        'logo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
      )
    }

    // Toute paroisse appartient à un district — jamais nul, donc jamais vidable ici.
    if (districtId !== undefined) {
      if (!districtId.trim()) throw new BadRequestException('Le district est obligatoire')
      const districtExiste = await this.prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
      if (!districtExiste) throw new BadRequestException('District invalide')
    }

    // Ces couleurs sont injectées dans une balise <style> : contrôle strict.
    for (const [champCouleur, valeur] of Object.entries(couleurs)) {
      if (valeur != null && valeur.trim() !== '' && !estCouleurHexValide(valeur)) {
        throw new BadRequestException(`${champCouleur} doit être une couleur hexadécimale valide (ex : #1a4731)`)
      }
    }

    const paroisse = await this.prisma.paroisse.update({
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
        ...(couleurs.couleurPrimaire !== undefined
          ? { couleurPrimaire: couleurs.couleurPrimaire.trim() || null }
          : {}),
        ...(couleurs.couleurAccent !== undefined ? { couleurAccent: couleurs.couleurAccent.trim() || null } : {}),
        ...(couleurs.couleurFond !== undefined ? { couleurFond: couleurs.couleurFond.trim() || null } : {}),
        ...(couleurs.couleurHover !== undefined ? { couleurHover: couleurs.couleurHover.trim() || null } : {}),
      },
    })

    // Désactiver une paroisse bloque la connexion de tout son personnel : les
    // sessions ouvertes sont fermées immédiatement plutôt qu'au prochain
    // rafraîchissement.
    if (actif === false) {
      const comptes = await this.prisma.utilisateur.findMany({ where: { paroisseId: id }, select: { id: true } })
      for (const compte of comptes) await this.auth.revoquerToutes(compte.id)
    }

    // Action sensible à journaliser, dans les deux sens.
    if (actif !== undefined && actif !== existante.actif) {
      await this.audit.enregistrer({
        paroisseId: id,
        acteurId,
        action: actif ? 'PAROISSE_REACTIVEE' : 'PAROISSE_DESACTIVEE',
        entite: 'Paroisse',
        entiteId: id,
      })
    }

    return paroisse
  }

  async supprimer(id: string, acteurId: string) {
    // Suppression physique volontairement stricte : cette application ne
    // supprime jamais un Scout ou un Utilisateur (toujours désactivé, pour
    // conserver l'historique). Une Paroisse suit la même règle dès qu'elle a
    // la moindre donnée réelle : seule une paroisse vide (créée par erreur,
    // jamais utilisée) peut être supprimée pour de bon. Toute paroisse ayant
    // déjà une activité doit être désactivée (PATCH actif=false).
    const paroisse = await this.prisma.paroisse.findUnique({
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
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')

    const totalDependants = Object.values(paroisse._count).reduce((s, n) => s + n, 0)
    if (totalDependants > 0) {
      throw new ConflictException(
        'Cette paroisse a déjà des données rattachées (membres, scouts, activités…) et ne peut pas être supprimée. Désactivez-la plutôt (bascule "Paroisse active" dans le formulaire).',
      )
    }

    await this.prisma.paroisse.delete({ where: { id } })

    // paroisseId volontairement null (portée plateforme) : la paroisse elle-même
    // n'existe plus, et JournalAudit.paroisseId est en Restrict — y référencer
    // l'id supprimé bloquerait justement la suppression qu'on vient de faire.
    await this.audit.enregistrer({
      paroisseId: null,
      acteurId,
      action: 'PAROISSE_SUPPRIMEE',
      entite: 'Paroisse',
      entiteId: id,
      details: { nom: paroisse.nom },
    })

    return { ok: true }
  }

  // Crée le compte Chef de Groupe d'une paroisse — action délibérément séparée
  // de la création de la paroisse elle-même : désigner qui dirige une paroisse
  // est une décision humaine, jamais automatisée.
  async creerChefGroupe(paroisseId: string, corpsBrut: unknown) {
    const paroisse = await this.prisma.paroisse.findUnique({ where: { id: paroisseId }, select: { id: true } })
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')

    // Une paroisse n'a qu'un seul Chef de Groupe actif à la fois — en créer un
    // second serait une double direction, non prévue par le modèle de rôles.
    // Un remplacement passe par la désactivation de l'ancien compte, pas par
    // la coexistence des deux.
    const chefGroupeExistant = await this.prisma.utilisateur.findFirst({
      where: { paroisseId, role: 'CHEF_GROUPE', actif: true },
      select: { id: true },
    })
    if (chefGroupeExistant) {
      throw new ConflictException(
        "Cette paroisse a déjà un Chef de Groupe actif. Désactivez-le avant d'en créer un nouveau.",
      )
    }

    const corps = corpsObjet(corpsBrut)
    const nom = texteOptionnel(corps, 'nom')?.trim()
    const prenom = texteOptionnel(corps, 'prenom')?.trim()
    const matricule = texteOptionnel(corps, 'matricule')?.trim()
    const telephone = texteOptionnel(corps, 'telephone')?.trim()
    const email = texteOptionnel(corps, 'email')?.trim()
    const password = texteOptionnel(corps, 'password')

    if (!nom || !prenom || !matricule || !password) {
      throw new BadRequestException('Le nom, le prénom, le matricule et le mot de passe sont requis')
    }
    if (!motDePasseValide(password)) throw new BadRequestException(REGLE_MOT_DE_PASSE)

    const doublonMatricule = await this.prisma.utilisateur.findUnique({ where: { matricule }, select: { id: true } })
    if (doublonMatricule) throw new BadRequestException('Ce matricule est déjà utilisé')

    if (telephone) {
      const doublonTel = await this.prisma.utilisateur.findUnique({ where: { telephone }, select: { id: true } })
      if (doublonTel) throw new BadRequestException('Ce numéro de téléphone est déjà utilisé')
    }

    if (email) {
      const doublonEmail = await this.prisma.utilisateur.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      })
      if (doublonEmail) throw new BadRequestException('Cette adresse e-mail est déjà utilisée')
    }

    const passwordHache = await hash(password, 12)
    let chefGroupe
    try {
      chefGroupe = await this.prisma.utilisateur.create({
        data: {
          nom,
          prenom,
          matricule,
          telephone: telephone || null,
          email: email || null,
          role: 'CHEF_GROUPE',
          password: passwordHache,
          paroisseId,
        },
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          telephone: true,
          email: true,
          actif: true,
          createdAt: true,
        },
      })
    } catch (erreur) {
      // Désignation concurrente : l'index partiel « 1 Chef de Groupe actif par
      // paroisse » (ou un identifiant unique) a tranché en base.
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException(
          'Conflit : cette paroisse a déjà un Chef de Groupe actif, ou ce matricule, ce téléphone ou cette adresse e-mail est déjà utilisé.',
        )
      }
      throw erreur
    }

    if (chefGroupe.email) {
      // Meilleur effort : un échec d'envoi ne doit jamais faire échouer la création du compte.
      envoyerEmailBienvenue({
        email: chefGroupe.email,
        prenom: chefGroupe.prenom,
        identifiant: chefGroupe.matricule ?? chefGroupe.telephone ?? chefGroupe.email,
        roleLabel: 'Chef de Groupe',
        nomSite: 'SCOUT ASCCI',
        urlConnexion: urlConnexion(),
      }).catch((error: unknown) => logger.error('admin.paroisses.chef_groupe.email_bienvenue_echoue', error))
    }

    return chefGroupe
  }

  async exporterScouts(id: string, acteurId: string): Promise<FichierCsv> {
    const paroisse = await this.prisma.paroisse.findUnique({ where: { id }, select: { id: true, nom: true } })
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')

    const scouts = await this.prisma.scout.findMany({
      where: { paroisseId: id },
      select: {
        nom: true,
        prenom: true,
        matricule: true,
        brancheType: true,
        sexe: true,
        dateNaissance: true,
        actif: true,
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    const lignes = scouts.map((s) =>
      [
        champ(s.nom.toUpperCase()),
        champ(s.prenom),
        champ(s.matricule),
        champ(LABELS_BRANCHES[s.brancheType] ?? s.brancheType),
        champ(LABELS_SEXE[s.sexe] ?? s.sexe),
        champ(new Date(s.dateNaissance).toLocaleDateString('fr-FR')),
        champ(s.actif ? 'Actif' : 'Inactif'),
      ].join(';'),
    )

    // Export de données personnelles de mineurs (dont date de naissance) :
    // action sensible à journaliser, comme toute lecture en masse de ces données.
    await this.audit.enregistrer({
      paroisseId: id,
      acteurId,
      action: 'PAROISSE_SCOUTS_EXPORTES',
      entite: 'Paroisse',
      entiteId: id,
      details: { nombre: scouts.length },
    })

    return {
      nomFichier: `scouts_${slugNom(paroisse.nom)}_${dateFichier()}.csv`,
      lignes: [
        champ(paroisse.nom),
        champ(`${scouts.length} scout${scouts.length > 1 ? 's' : ''}`),
        '',
        '"Nom";"Prénom";"Matricule";"Branche";"Sexe";"Date de naissance";"Statut"',
        ...lignes,
      ],
    }
  }

  async exporterUtilisateurs(id: string, acteurId: string): Promise<FichierCsv> {
    const paroisse = await this.prisma.paroisse.findUnique({ where: { id }, select: { id: true, nom: true } })
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')

    const utilisateurs = await this.prisma.utilisateur.findMany({
      where: { paroisseId: id },
      select: { nom: true, prenom: true, matricule: true, telephone: true, email: true, role: true, actif: true },
      orderBy: [{ role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
    })

    const lignes = utilisateurs.map((u) =>
      [
        champ(u.nom.toUpperCase()),
        champ(u.prenom),
        champ(u.matricule),
        champ(u.telephone),
        champ(u.email),
        champ(LABELS_ROLES[u.role] ?? u.role),
        champ(u.actif ? 'Actif' : 'Inactif'),
      ].join(';'),
    )

    // Export de données personnelles (dont téléphone/email) : action sensible
    // à journaliser, comme toute lecture en masse de ces données.
    await this.audit.enregistrer({
      paroisseId: id,
      acteurId,
      action: 'PAROISSE_UTILISATEURS_EXPORTES',
      entite: 'Paroisse',
      entiteId: id,
      details: { nombre: utilisateurs.length },
    })

    return {
      nomFichier: `utilisateurs_${slugNom(paroisse.nom)}_${dateFichier()}.csv`,
      lignes: [
        champ(paroisse.nom),
        champ(`${utilisateurs.length} utilisateur${utilisateurs.length > 1 ? 's' : ''}`),
        '',
        '"Nom";"Prénom";"Matricule";"Téléphone";"Email";"Rôle";"Statut"',
        ...lignes,
      ],
    }
  }
}
