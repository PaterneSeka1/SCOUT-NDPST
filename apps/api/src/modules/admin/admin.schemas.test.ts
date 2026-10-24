import { BadRequestException } from '@nestjs/common'
import { REGLE_MOT_DE_PASSE } from '@scout/shared'
import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import {
  SchemaCreationUtilisateur,
  SchemaFiltresUtilisateurs,
  SchemaModificationUtilisateur,
  SchemaMotDePasseAdmin,
} from './utilisateurs.schemas'

// Message renvoyé au client : le premier problème, comme ZodPipe.
function erreur(schema: ZodType, valeur: unknown): string | undefined {
  const resultat = schema.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

describe('Schémas admin — corps de requête', () => {
  it.each([null, [], 'texte', 42])('rejette un corps qui n’est pas un objet (%j)', (corps) => {
    expect(erreur(SchemaCreationUtilisateur, corps)).toBe('Données invalides')
    expect(erreur(SchemaModificationUtilisateur, corps)).toBe('Données invalides')
  })

  it('ZodPipe renvoie une 400 { erreur } avec le message du schéma', () => {
    const pipe = new ZodPipe(SchemaModificationUtilisateur)
    expect(() => pipe.transform({ nom: '  ' })).toThrow(BadRequestException)
    try {
      pipe.transform({ nom: '  ' })
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ erreur: 'Le nom est invalide' })
    }
  })
})

describe('Schémas admin — utilisateurs', () => {
  const compte = {
    nom: ' K ',
    prenom: 'J',
    matricule: 'M1',
    role: 'CHEF_GROUPE',
    password: 'abcdef12',
  }

  it('normalise une création (branche forcée à null hors rôle de branche, éditeur à false)', () => {
    expect(SchemaCreationUtilisateur.parse({ ...compte, brancheType: 'LOUVETEAUX', fonction: ' ' })).toEqual({
      nom: 'K',
      prenom: 'J',
      email: null,
      matricule: 'M1',
      telephone: null,
      role: 'CHEF_GROUPE',
      fonction: null,
      brancheType: null,
      editeurContenu: false,
    })
  })

  it('accepte la création d’un administrateur et d’un éditeur de contenus', () => {
    expect(SchemaCreationUtilisateur.parse({ ...compte, role: 'ADMINISTRATEUR' }).role).toBe('ADMINISTRATEUR')
    expect(
      SchemaCreationUtilisateur.parse({ ...compte, role: 'ADJOINT_GROUPE', editeurContenu: true }).editeurContenu,
    ).toBe(true)
  })

  it('ignore un ancien champ paroisseId', () => {
    expect(SchemaCreationUtilisateur.parse({ ...compte, paroisseId: 'p1' })).not.toHaveProperty('paroisseId')
  })

  it.each([
    [{ role: undefined }, 'Les champs nom, prenom, role sont requis'],
    [{ role: 'ADMIN_PLATEFORME' }, 'Rôle invalide'],
    [{ role: 'COMMISSAIRE_DISTRICT' }, 'Rôle invalide'],
    [{ role: 'SCOUT' }, 'Rôle invalide'],
    [{ brancheType: 'AUTRE' }, 'Branche invalide'],
    [{ role: 'RESPONSABLE_BRANCHE' }, 'La branche est requise pour ce rôle'],
    [{ matricule: '' }, 'Le matricule est requis'],
    [{ telephone: 7 }, 'Le champ telephone est invalide'],
    [{ editeurContenu: 'oui' }, 'Le champ editeurContenu est invalide'],
  ])('rejette une création %j', (modification, message) => {
    expect(erreur(SchemaCreationUtilisateur, { ...compte, ...modification })).toBe(message)
  })

  it('accepte une création sans mot de passe et ignore celui d’un ancien client', () => {
    const sansSecret = { nom: 'K', prenom: 'J', matricule: 'M1', role: 'CHEF_GROUPE' }
    const attendu = SchemaCreationUtilisateur.parse(sansSecret)
    expect(attendu).not.toHaveProperty('password')
    expect(SchemaCreationUtilisateur.parse({ ...sansSecret, password: 'court' })).toEqual(attendu)
    expect(SchemaCreationUtilisateur.parse({ ...sansSecret, password: 'SecretClient123' })).toEqual(attendu)
  })

  it('modification partielle : champs absents laissés undefined, email vide → null', () => {
    const donnees = SchemaModificationUtilisateur.parse({ nom: ' N ', email: '  ', fonction: null })
    expect(donnees).toMatchObject({ nom: 'N', email: null, fonction: null })
    expect(donnees.role).toBeUndefined()
    expect(donnees.actif).toBeUndefined()
    expect(donnees.brancheType).toBeUndefined()
    expect(donnees.editeurContenu).toBeUndefined()
    expect(donnees.profilPublic).toBeUndefined()
  })

  it('modification : editeurContenu et champs du profil public', () => {
    expect(
      SchemaModificationUtilisateur.parse({
        editeurContenu: true,
        profilPublic: true,
        fonctionPublique: ' Aumônier ',
        photoPublique: '/api/fichiers-publics/equipe/a.jpg',
        biographie: '',
        ordrePublic: 2,
      }),
    ).toMatchObject({
      editeurContenu: true,
      profilPublic: true,
      fonctionPublique: 'Aumônier',
      photoPublique: '/api/fichiers-publics/equipe/a.jpg',
      biographie: null,
      ordrePublic: 2,
    })
  })

  it.each([
    [{ actif: 'oui' }, 'Le champ actif est invalide'],
    [{ role: 3 }, 'Rôle invalide'],
    [{ role: 'COMMISSAIRE_DISTRICT' }, 'Rôle invalide'],
    [{ nom: '  ' }, 'Le nom est invalide'],
    [{ prenom: null }, 'Le prénom est invalide'],
    [{ email: 1 }, 'L’adresse e-mail est invalide'],
    [{ fonction: {} }, 'La fonction est invalide'],
    [{ brancheType: 'X' }, 'Branche invalide'],
    [{ editeurContenu: 1 }, 'Le champ editeurContenu est invalide'],
    [
      { photoPublique: 'https://exemple.com/a.png' },
      'La photo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
    ],
    [{ ordrePublic: -1 }, 'L’ordre d’affichage est invalide'],
  ])('rejette une modification %j', (corps, message) => {
    expect(erreur(SchemaModificationUtilisateur, corps)).toBe(message)
  })

  it('filtres de liste : bornés, actif booléen, valeurs inconnues rejetées', () => {
    expect(
      SchemaFiltresUtilisateurs.parse({
        page: '0',
        limite: '500',
        role: 'ADMINISTRATEUR',
        actif: 'false',
        recherche: ' ko ',
      }),
    ).toEqual({ page: 1, limite: 100, role: 'ADMINISTRATEUR', actif: false, brancheType: undefined, recherche: 'ko' })
    expect(SchemaFiltresUtilisateurs.parse({ role: ['A', 'B'] }).role).toBeUndefined()
    expect(erreur(SchemaFiltresUtilisateurs, { role: 'COMMISSAIRE_DISTRICT' })).toBe('Rôle invalide')
    expect(erreur(SchemaFiltresUtilisateurs, { actif: 'oui' })).toBe('Le filtre actif est invalide')
    expect(erreur(SchemaFiltresUtilisateurs, { brancheType: 'X' })).toBe('Branche invalide')
  })

  it('exige un nouveau mot de passe conforme', () => {
    expect(SchemaMotDePasseAdmin.parse({ nouveauMotDePasse: 'nouveau123' })).toEqual({
      nouveauMotDePasse: 'nouveau123',
    })
    expect(erreur(SchemaMotDePasseAdmin, {})).toBe(REGLE_MOT_DE_PASSE)
    expect(erreur(SchemaMotDePasseAdmin, { nouveauMotDePasse: 'court' })).toBe(REGLE_MOT_DE_PASSE)
  })
})
