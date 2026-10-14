import { REGLE_MOT_DE_PASSE } from '@scout/shared'
import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import {
  SchemaCreationUtilisateur,
  SchemaModificationUtilisateur,
  SchemaReinitialisationMotDePasse,
} from './utilisateurs.schemas'

// Premier message d'erreur, tel que renvoyé par ZodPipe au client.
function premierMessage(schema: ZodType, valeur: unknown): string | undefined {
  const resultat = schema.safeParse(valeur)
  return resultat.success ? undefined : resultat.error.issues[0]?.message
}

const creationValide = { nom: ' Kouassi ', prenom: ' Awa ', role: 'ADJOINT_GROUPE', password: 'Secret123', matricule: 'M9' }

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

  it.each([
    [{ ...creationValide, nom: '  ' }, 'Les champs nom, prenom, role et password sont requis'],
    [{ ...creationValide, role: '' }, 'Les champs nom, prenom, role et password sont requis'],
    [{ ...creationValide, password: undefined }, 'Les champs nom, prenom, role et password sont requis'],
    [{ ...creationValide, password: 'court' }, REGLE_MOT_DE_PASSE],
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
    expect(SchemaModificationUtilisateur.parse({ prenom: ' Awa ', role: 'ADMIN_PLATEFORME' })).toEqual({
      prenom: 'Awa',
      // Valeur d'enum connue : la hiérarchie des rôles est contrôlée par le service.
      role: 'ADMIN_PLATEFORME',
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
