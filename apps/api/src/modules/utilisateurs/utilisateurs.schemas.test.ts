import { REGLE_MOT_DE_PASSE } from '@scout/shared'
import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import {
  SchemaCreationUtilisateur,
  SchemaModificationUtilisateur,
  SchemaProfilPublic,
  SchemaReinitialisationMotDePasse,
} from './utilisateurs.schemas'

// Premier message d'erreur, tel que renvoyé par ZodPipe au client.
function premierMessage(schema: ZodType, valeur: unknown): string | undefined {
  const resultat = schema.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

const creationValide = {
  nom: ' Kouassi ',
  prenom: ' Awa ',
  role: 'ADJOINT_GROUPE',
  password: 'Secret123',
  matricule: 'M9',
}

describe('SchemaCreationUtilisateur', () => {
  it('accepte un corps valide, nettoie nom et prénom, dédoublonne les enfants', () => {
    expect(
      SchemaCreationUtilisateur.parse({ ...creationValide, scoutIds: [' s1 ', 's1', '', 42, 's2'], actif: false }),
    ).toEqual({
      nom: 'Kouassi',
      prenom: 'Awa',
      role: 'ADJOINT_GROUPE',
      password: 'Secret123',
      matricule: 'M9',
      scoutIds: ['s1', 's2'],
    })
  })

  it('sans scoutIds : aucun enfant', () => {
    expect(SchemaCreationUtilisateur.parse(creationValide).scoutIds).toEqual([])
  })

  it('accepte la création sans mot de passe, le secret étant généré par le serveur', () => {
    const sansSecret = { nom: 'Kouassi', prenom: 'Awa', role: 'ADJOINT_GROUPE', matricule: 'M9' }
    expect(SchemaCreationUtilisateur.parse(sansSecret)).not.toHaveProperty('password')
  })

  it('accepte le champ historique d’un ancien client sans exiger sa robustesse', () => {
    expect(SchemaCreationUtilisateur.parse({ ...creationValide, password: 'court' }).password).toBe('court')
  })

  it.each([
    [{ ...creationValide, nom: '  ' }, 'Les champs nom, prenom et role sont requis'],
    [{ ...creationValide, role: '' }, 'Les champs nom, prenom et role sont requis'],
    [{ ...creationValide, role: 'toString' }, 'Rôle invalide'],
    [{ ...creationValide, email: 3 }, 'L’adresse e-mail est invalide'],
    [{ ...creationValide, matricule: {} }, 'Le matricule est invalide'],
    [{ ...creationValide, telephone: 7 }, 'Le numéro de téléphone est invalide'],
    [{ ...creationValide, brancheType: '' }, 'Branche invalide'],
    [{ ...creationValide, scoutIds: 's1' }, 'La liste des enfants est invalide'],
    [[], 'Données invalides'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaCreationUtilisateur, corps)).toBe(message)
  })
})

describe('SchemaModificationUtilisateur', () => {
  it('laisse absents les champs non envoyés (mise à jour partielle)', () => {
    expect(SchemaModificationUtilisateur.parse({ prenom: ' Awa ', role: 'ADMINISTRATEUR' })).toEqual({
      prenom: 'Awa',
      // Valeur d'enum connue : la hiérarchie des rôles est contrôlée par le service.
      role: 'ADMINISTRATEUR',
    })
  })

  it('accepte une liste d’enfants vide (détache tous les enfants) et une branche null', () => {
    expect(SchemaModificationUtilisateur.parse({ scoutIds: [], brancheType: null, email: null })).toEqual({
      scoutIds: [],
      brancheType: null,
      email: null,
    })
  })

  it.each([
    [{ role: 'CHEF' }, 'Rôle invalide'],
    [{ role: 'ADMIN_PLATEFORME' }, 'Rôle invalide'],
    [{ role: 'COMMISSAIRE_DISTRICT' }, 'Rôle invalide'],
    [{ nom: ' ' }, 'Le nom est invalide'],
    [{ prenom: null }, 'Le prénom est invalide'],
    [{ email: 1 }, 'L’adresse e-mail est invalide'],
    [{ actif: 'non' }, 'Le statut est invalide'],
    [{ scoutIds: {} }, 'La liste des enfants est invalide'],
    [{ brancheType: 'SCOUTS' }, 'Branche invalide'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaModificationUtilisateur, corps)).toBe(message)
  })
})

describe('SchemaReinitialisationMotDePasse', () => {
  it('accepte un mot de passe conforme', () => {
    expect(SchemaReinitialisationMotDePasse.parse({ nouveauMotDePasse: 'Secret123' })).toEqual({
      nouveauMotDePasse: 'Secret123',
    })
  })

  it.each([{}, { nouveauMotDePasse: '' }, { nouveauMotDePasse: 'court' }, { nouveauMotDePasse: 12345678 }])(
    'rejette un mot de passe absent ou trop faible : %j',
    (corps) => {
      expect(premierMessage(SchemaReinitialisationMotDePasse, corps)).toBe(REGLE_MOT_DE_PASSE)
    },
  )
})

describe('SchemaProfilPublic', () => {
  it('nettoie les textes, efface les valeurs vides et laisse absents les champs non envoyés', () => {
    expect(
      SchemaProfilPublic.parse({
        profilPublic: true,
        fonctionPublique: ' Chef de Groupe ',
        photoPublique: '',
        biographie: null,
        paroisseId: 'ignoré',
      }),
    ).toEqual({ profilPublic: true, fonctionPublique: 'Chef de Groupe', photoPublique: null, biographie: null })
    expect(SchemaProfilPublic.parse({})).toEqual({})
  })

  it('accepte une photo servie localement', () => {
    expect(SchemaProfilPublic.parse({ photoPublique: '/api/fichiers-publics/equipe/a.jpg' }).photoPublique).toBe(
      '/api/fichiers-publics/equipe/a.jpg',
    )
  })

  it.each([
    [{ profilPublic: 'oui' }, 'Le champ profilPublic est invalide'],
    [
      { photoPublique: 'https://exemple.com/a.png' },
      'La photo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
    ],
    [
      { photoPublique: 'javascript:alert(1)' },
      'La photo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
    ],
    [{ fonctionPublique: 'x'.repeat(121) }, 'La fonction publique est invalide (120 caractères au plus)'],
    [{ biographie: 'x'.repeat(2001) }, 'La biographie est invalide (2000 caractères au plus)'],
    [{ ordrePublic: 1.5 }, 'L’ordre d’affichage est invalide'],
    [{ ordrePublic: '2' }, 'L’ordre d’affichage est invalide'],
    [[], 'Données invalides'],
  ])('rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaProfilPublic, corps)).toBe(message)
  })
})
