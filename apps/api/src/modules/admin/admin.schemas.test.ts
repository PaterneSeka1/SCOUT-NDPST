import { BadRequestException } from '@nestjs/common'
import { REGLE_MOT_DE_PASSE } from '@scout/shared'
import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import { SchemaDesignationCommissaire, SchemaDistrict } from './districts.schemas'
import { SchemaCreationChefGroupe, SchemaCreationParoisse, SchemaModificationParoisse } from './paroisses.schemas'
import { SchemaConfigurationSite } from './plateforme.schemas'
import {
  SchemaCreationUtilisateur,
  SchemaModificationUtilisateur,
  SchemaMotDePasseAdmin,
  SchemaNomination,
} from './utilisateurs.schemas'

// Message renvoyé au client : le premier problème, comme ZodPipe.
function erreur(schema: ZodType, valeur: unknown): string | undefined {
  const resultat = schema.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

describe('Schémas admin — corps de requête', () => {
  it.each([null, [], 'texte', 42])('rejette un corps qui n’est pas un objet (%j)', (corps) => {
    expect(erreur(SchemaDistrict, corps)).toBe('Données invalides')
    expect(erreur(SchemaModificationParoisse, corps)).toBe('Données invalides')
    expect(erreur(SchemaConfigurationSite, corps)).toBe('Données invalides')
    expect(erreur(SchemaNomination, corps)).toBe('Données invalides')
  })

  it('ZodPipe renvoie une 400 { erreur } avec le message du schéma', () => {
    const pipe = new ZodPipe(SchemaDistrict)
    expect(() => pipe.transform({ nom: '  ' })).toThrow(BadRequestException)
    try {
      pipe.transform({ nom: '  ' })
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ erreur: 'Le nom du district est requis' })
    }
  })
})

describe('Schémas admin — districts', () => {
  it('nettoie le nom et retire les clés inconnues', () => {
    expect(SchemaDistrict.parse({ nom: '  Abidjan Nord ', id: 'x' })).toEqual({ nom: 'Abidjan Nord' })
  })

  it.each([{}, { nom: null }, { nom: '   ' }])('exige le nom (%j)', (corps) => {
    expect(erreur(SchemaDistrict, corps)).toBe('Le nom du district est requis')
  })

  it('rejette un nom non textuel', () => {
    expect(erreur(SchemaDistrict, { nom: 12 })).toBe('Le champ nom est invalide')
  })

  it('exige le membre à désigner et le transmet tel quel', () => {
    expect(SchemaDesignationCommissaire.parse({ utilisateurId: 'u1' })).toEqual({ utilisateurId: 'u1' })
    expect(erreur(SchemaDesignationCommissaire, { utilisateurId: ' ' })).toBe('Le membre à désigner est requis')
    expect(erreur(SchemaDesignationCommissaire, {})).toBe('Le membre à désigner est requis')
    expect(erreur(SchemaDesignationCommissaire, { utilisateurId: 1 })).toBe('Le champ utilisateurId est invalide')
  })
})

describe('Schémas admin — paroisses', () => {
  const paroisse = { nom: ' P ', ville: 'Abidjan', diocese: 'D', districtId: 'd1' }

  it('normalise une création (textes nettoyés, vide → null)', () => {
    expect(SchemaCreationParoisse.parse({ ...paroisse, ocean: '  ', telephone: ' 07 ', email: ' a@b.ci ' })).toEqual({
      nom: 'P',
      ville: 'Abidjan',
      diocese: 'D',
      districtId: 'd1',
      ocean: null,
      adresse: null,
      telephone: '07',
      email: 'a@b.ci',
    })
  })

  it('exige nom, ville, diocèse et district à la création', () => {
    expect(erreur(SchemaCreationParoisse, { ...paroisse, ville: ' ' })).toBe(
      'Le nom, la ville, le diocèse et le district sont obligatoires',
    )
    expect(erreur(SchemaCreationParoisse, { ...paroisse, adresse: 3 })).toBe('Le champ adresse est invalide')
  })

  it('modification partielle : absent → inchangé, null ou vide → effacé', () => {
    const donnees = SchemaModificationParoisse.parse({ actif: false, adresse: null, telephone: '  ', nom: ' N ' })
    expect(donnees).toMatchObject({ actif: false, adresse: null, telephone: null, nom: 'N' })
    expect(donnees.ville).toBeUndefined()
    expect(donnees.districtId).toBeUndefined()
    expect(donnees.couleurPrimaire).toBeUndefined()
  })

  it('rejette un booléen actif invalide', () => {
    expect(erreur(SchemaModificationParoisse, { actif: 'non' })).toBe('Le champ actif est invalide')
  })

  it('refuse de vider le district', () => {
    expect(erreur(SchemaModificationParoisse, { districtId: ' ' })).toBe('Le district est obligatoire')
    expect(erreur(SchemaModificationParoisse, { districtId: null })).toBe('Le district est obligatoire')
  })

  it('contrôle le logo (chemin local accepté, URL externe refusée)', () => {
    expect(SchemaModificationParoisse.parse({ logo: ' /api/fichiers-publics/logo.png ' }).logo).toBe(
      '/api/fichiers-publics/logo.png',
    )
    expect(SchemaModificationParoisse.parse({ logo: '' }).logo).toBeNull()
    expect(erreur(SchemaModificationParoisse, { logo: 'https://exemple.com/logo.png' })).toBe(
      'logo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
    )
  })

  it('contrôle strictement les couleurs', () => {
    expect(SchemaModificationParoisse.parse({ couleurFond: '#1a4731' }).couleurFond).toBe('#1a4731')
    expect(SchemaModificationParoisse.parse({ couleurFond: '' }).couleurFond).toBeNull()
    expect(erreur(SchemaModificationParoisse, { couleurAccent: 'red;}' })).toBe(
      'couleurAccent doit être une couleur hexadécimale valide (ex : #1a4731)',
    )
  })

  it('valide la création du Chef de Groupe', () => {
    const corps = { nom: 'K', prenom: 'J', matricule: ' M1 ', password: 'abcdef12' }
    expect(SchemaCreationChefGroupe.parse(corps)).toEqual({
      nom: 'K',
      prenom: 'J',
      matricule: 'M1',
      telephone: null,
      email: null,
      password: 'abcdef12',
    })
    expect(erreur(SchemaCreationChefGroupe, { ...corps, matricule: '' })).toBe(
      'Le nom, le prénom, le matricule et le mot de passe sont requis',
    )
    expect(erreur(SchemaCreationChefGroupe, { ...corps, password: 'court' })).toBe(REGLE_MOT_DE_PASSE)
  })
})

describe('Schémas admin — configuration du site', () => {
  it('accepte une mise à jour partielle et efface un fichier vide', () => {
    const donnees = SchemaConfigurationSite.parse({
      nomSite: 'Scouts',
      logoSite: '',
      theme: { couleurPrimaire: '#112233' },
      hero: { badge: 'B', imageUrl: null },
      stats: [{ value: '10', label: 'Paroisses' }],
    })
    expect(donnees).toMatchObject({
      nomSite: 'Scouts',
      logoSite: null,
      theme: { couleurPrimaire: '#112233' },
      hero: { badge: 'B', imageUrl: null },
      stats: [{ value: '10', label: 'Paroisses' }],
    })
    expect(donnees.sousTitreSite).toBeUndefined()
    expect(donnees.theme?.couleurFond).toBeUndefined()
    expect(SchemaConfigurationSite.parse({}).logoSite).toBeUndefined()
  })

  it.each([
    [{ nomSite: 3 }, 'nomSite doit être un texte'],
    [{ nomSite: null }, 'nomSite doit être un texte'],
    [{ theme: [] }, 'theme est invalide'],
    [{ hero: 'x' }, 'hero est invalide'],
    [{ hero: { titre: 1 } }, 'hero.titre doit être un texte'],
    [
      { logoSite: 'https://exemple.com/a.png' },
      'logoSite doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
    ],
    [
      { hero: { imageUrl: 'javascript:alert(1)' } },
      'hero.imageUrl doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
    ],
    [
      { stats: [{ value: 1, label: 'x' }] },
      "stats doit être une liste d'au plus 12 éléments { value, label } (textes de 100 caractères maximum)",
    ],
    [{ theme: { autre: 'bleu' } }, 'autre doit être une couleur hexadécimale valide (ex : #1a4731)'],
  ])('rejette %j', (corps, message) => {
    expect(erreur(SchemaConfigurationSite, corps)).toBe(message)
  })
})

describe('Schémas admin — utilisateurs', () => {
  const compte = {
    paroisseId: 'p1',
    nom: ' K ',
    prenom: 'J',
    matricule: 'M1',
    role: 'CHEF_GROUPE',
    password: 'abcdef12',
  }

  it('normalise une création (branche forcée à null hors rôle de branche)', () => {
    expect(SchemaCreationUtilisateur.parse({ ...compte, brancheType: 'LOUVETEAUX', fonction: ' ' })).toEqual({
      paroisseId: 'p1',
      nom: 'K',
      prenom: 'J',
      email: null,
      matricule: 'M1',
      telephone: null,
      role: 'CHEF_GROUPE',
      password: 'abcdef12',
      fonction: null,
      brancheType: null,
    })
  })

  it.each([
    [{ role: undefined }, 'Les champs paroisseId, nom, prenom, role et password sont requis'],
    [{ password: 'court' }, REGLE_MOT_DE_PASSE],
    [{ role: 'ADMIN_PLATEFORME' }, 'Rôle invalide'],
    [{ brancheType: 'AUTRE' }, 'Branche invalide'],
    [{ role: 'RESPONSABLE_BRANCHE' }, 'La branche est requise pour ce rôle'],
    [{ matricule: '' }, 'Le matricule est requis'],
    [{ telephone: 7 }, 'Le champ telephone est invalide'],
  ])('rejette une création %j', (modification, message) => {
    expect(erreur(SchemaCreationUtilisateur, { ...compte, ...modification })).toBe(message)
  })

  it('modification partielle : champs absents laissés undefined, email vide → null', () => {
    const donnees = SchemaModificationUtilisateur.parse({ nom: ' N ', email: '  ', fonction: null })
    expect(donnees).toMatchObject({ nom: 'N', email: null, fonction: null })
    expect(donnees.role).toBeUndefined()
    expect(donnees.actif).toBeUndefined()
    expect(donnees.brancheType).toBeUndefined()
  })

  it.each([
    [{ actif: 'oui' }, 'Le champ actif est invalide'],
    [{ role: 3 }, 'Rôle invalide'],
    [{ nom: '  ' }, 'Le nom est invalide'],
    [{ prenom: null }, 'Le prénom est invalide'],
    [{ email: 1 }, 'L’adresse e-mail est invalide'],
    [{ fonction: {} }, 'La fonction est invalide'],
    [{ brancheType: 'X' }, 'Branche invalide'],
  ])('rejette une modification %j', (corps, message) => {
    expect(erreur(SchemaModificationUtilisateur, corps)).toBe(message)
  })

  it('nomination : textes nettoyés, vide → null, absent → undefined', () => {
    const donnees = SchemaNomination.parse({
      roleDistrict: ' ASSISTANT_DISTRICT ',
      brancheType: '',
      fonctionDistrict: ' ',
    })
    expect(donnees).toMatchObject({ roleDistrict: 'ASSISTANT_DISTRICT', brancheType: null, fonctionDistrict: null })
    expect(donnees.role).toBeUndefined()
    expect(donnees.brancheTypeDistrict).toBeUndefined()
  })

  it.each([
    [{ role: null }, 'Rôle invalide'],
    [{ roleDistrict: 1 }, 'Rôle de district invalide'],
    [{ roleDistrict: 'CHEF_GROUPE' }, 'Rôle de district invalide'],
    [{ brancheType: 'X' }, 'Branche invalide'],
    [{ brancheTypeDistrict: 'X' }, 'Branche de district invalide'],
    [{ fonctionDistrict: 2 }, 'Fonction de district invalide'],
  ])('rejette une nomination %j', (corps, message) => {
    expect(erreur(SchemaNomination, corps)).toBe(message)
  })

  it('exige un nouveau mot de passe conforme', () => {
    expect(SchemaMotDePasseAdmin.parse({ nouveauMotDePasse: 'nouveau123' })).toEqual({
      nouveauMotDePasse: 'nouveau123',
    })
    expect(erreur(SchemaMotDePasseAdmin, {})).toBe(REGLE_MOT_DE_PASSE)
    expect(erreur(SchemaMotDePasseAdmin, { nouveauMotDePasse: 'court' })).toBe(REGLE_MOT_DE_PASSE)
  })
})
