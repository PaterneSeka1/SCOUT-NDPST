import { BadRequestException } from '@nestjs/common'
import { REGLE_MOT_DE_PASSE } from '@scout/shared'
import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import {
  SchemaCreationScout,
  SchemaModificationScout,
  SchemaCreationCompteScout,
  SchemaMatriculeScout,
  SchemaImportScouts,
  SchemaCreationContact,
  SchemaModificationContact,
  SchemaAjoutDocument,
  SchemaPassagesBranche,
  SchemaValidationProgression,
} from './scouts.schemas'

const creation = {
  nom: ' Kouassi ',
  prenom: ' Awa ',
  dateNaissance: '2014-06-01',
  sexe: 'FEMININ',
  brancheType: 'LOUVETEAUX',
  contactsUrgence: [{ nom: ' Parent ', telephone: ' 0102030405 ', principal: true }],
}

function erreur(schema: ZodType, valeur: unknown, message: string) {
  const resultat = schema.safeParse(valeur)
  expect(resultat.success).toBe(false)
  if (!resultat.success) expect(resultat.error.issues[0].message).toBe(message)
}

describe('Validation des corps des routes scouts', () => {
  it('normalise la création, les contacts et retire les champs inconnus', () => {
    const donnees = SchemaCreationScout.parse({ ...creation, role: 'ADMIN_PLATEFORME' })
    expect(donnees).toMatchObject({ nom: 'Kouassi', prenom: 'Awa', dateNaissance: new Date('2014-06-01'), photo: null })
    expect(donnees.contactsUrgence).toEqual([
      { nom: 'Parent', prenom: null, telephone: '0102030405', relation: null, principal: true },
    ])
    expect(donnees).not.toHaveProperty('role')
  })

  it.each([
    [{ nom: '' }, 'Le nom est requis'],
    [{ prenom: ' ' }, 'Le prénom est requis'],
    [{ dateNaissance: undefined }, 'La date de naissance est requise'],
    [{ dateNaissance: 'invalide' }, 'La date de naissance est invalide'],
    [{ sexe: 'toString' }, 'Le sexe est invalide ou manquant'],
    [{ brancheType: 'constructor' }, 'La branche est invalide ou manquante'],
    [{ contactsUrgence: [] }, "Au moins un contact d'urgence est requis"],
    [{ contactsUrgence: [null] }, 'Le nom du contact 1 est requis'],
    [{ contactsUrgence: [{ nom: 'Parent' }] }, 'Le téléphone du contact 1 est requis'],
    [{ photo: 'https://exemple.ci/photo.png' }, 'photo doit être un chemin local (ex : /api/fichiers/…)'],
  ])('rejette une création invalide (%j)', (modification, message) => {
    erreur(SchemaCreationScout, { ...creation, ...modification }, message)
  })

  it.each([null, [], 'texte', 42])('rejette un corps non objet (%j)', (valeur) => {
    erreur(SchemaModificationScout, valeur, 'Données invalides')
  })

  it('préserve les champs absents dans une modification partielle', () => {
    const donnees = SchemaModificationScout.parse({ prenom: ' Awa ', paroisseId: 'autre' })
    expect(donnees.prenom).toBe('Awa')
    expect(donnees.photo).toBeUndefined()
    expect(donnees.allergies).toBeUndefined()
    expect(donnees.actif).toBeUndefined()
    expect(donnees.consentementSante).toBeUndefined()
    expect(donnees).not.toHaveProperty('paroisseId')
  })

  it('conserve false et permet de vider les champs effaçables', () => {
    expect(
      SchemaModificationScout.parse({
        actif: false,
        consentementImage: false,
        consentementSante: false,
        photo: '',
        allergies: null,
        traitementsMedicaux: ' ',
      }),
    ).toMatchObject({
      actif: false,
      consentementImage: false,
      consentementSante: false,
      photo: null,
      allergies: null,
      traitementsMedicaux: null,
    })
  })

  it.each([
    [{ consentementSante: 'true' }, 'Champ consentementSante invalide'],
    [{ consentementImage: null }, 'Champ consentementImage invalide'],
    [{ actif: 0 }, 'Champ actif invalide'],
    [{ sexe: 'constructor' }, 'Sexe invalide'],
    [{ brancheType: 'toString' }, 'Branche invalide'],
    [{ dateNaissance: '' }, 'La date de naissance est invalide'],
    [{ nom: null }, 'Champ nom invalide'],
  ])('rejette une modification invalide (%j)', (donnees, message) => {
    erreur(SchemaModificationScout, donnees, message)
  })

  it('valide le compte sans modifier le mot de passe', () => {
    const password = 'MotDePasseFort42!'
    expect(SchemaCreationCompteScout.parse({ password, telephone: ' 0123 ' })).toEqual({ password, telephone: '0123' })
    erreur(SchemaCreationCompteScout, { password: 'court' }, REGLE_MOT_DE_PASSE)
  })

  it('exige et nettoie le matricule', () => {
    expect(SchemaMatriculeScout.parse({ matricule: ' ASCCI-42 ' })).toEqual({ matricule: 'ASCCI-42' })
    erreur(SchemaMatriculeScout, { matricule: ' ' }, 'Le matricule est requis')
  })

  it('limite les imports et conserve les lignes pour le rapport du service', () => {
    erreur(SchemaImportScouts, { scouts: [] }, 'Aucune ligne à importer')
    erreur(SchemaImportScouts, { scouts: Array(501).fill({}) }, 'Maximum 500 lignes par import')
    expect(SchemaImportScouts.parse({ scouts: [null, { nom: 'Awa' }] }).scouts).toEqual([null, { nom: 'Awa' }])
  })

  it('valide les contacts et leur mise à jour partielle', () => {
    expect(SchemaCreationContact.parse({ nom: 'Parent', telephone: '0123' }).principal).toBe(false)
    expect(SchemaCreationContact.parse({ nom: ' Parent ', telephone: ' 0123 ', principal: 'true' })).toEqual({
      nom: 'Parent',
      prenom: null,
      telephone: '0123',
      relation: null,
      principal: false,
    })
    erreur(SchemaCreationContact, { telephone: '0123' }, 'Le nom du contact est requis')
    erreur(SchemaCreationContact, { nom: 'Parent' }, 'Le téléphone du contact est requis')
    const modification = SchemaModificationContact.parse({ prenom: '', principal: false })
    expect(modification).toMatchObject({
      prenom: null,
      principal: false,
    })
    expect(modification.nom).toBeUndefined()
    expect(modification.telephone).toBeUndefined()
    erreur(SchemaModificationContact, { principal: 'true' }, 'Champ principal invalide')
  })

  it('valide les documents et transforme leur date', () => {
    const document = {
      type: 'CERTIFICAT_MEDICAL',
      nomFichier: ' fiche.pdf ',
      url: '/api/fichiers/p1/fiche.pdf',
      dateExpiration: '2027-01-01',
    }
    expect(SchemaAjoutDocument.parse(document)).toMatchObject({
      nomFichier: 'fiche.pdf',
      dateExpiration: new Date('2027-01-01'),
    })
    erreur(SchemaAjoutDocument, { ...document, type: 'constructor' }, 'Type de document invalide')
    erreur(SchemaAjoutDocument, { ...document, url: '' }, 'Le fichier est requis')
    erreur(
      SchemaAjoutDocument,
      { ...document, url: 'https://exemple.ci/fiche.pdf' },
      'url doit être un chemin local (ex : /api/fichiers/…)',
    )
    erreur(SchemaAjoutDocument, { ...document, dateExpiration: 'invalide' }, "Date d'expiration invalide")
    expect(SchemaAjoutDocument.parse({ ...document, dateExpiration: '' }).dateExpiration).toBeNull()
  })

  it('valide les passages, y compris la sortie du mouvement', () => {
    expect(SchemaPassagesBranche.parse({ passages: [{ scoutId: 's1' }] })).toEqual({
      passages: [{ scoutId: 's1', nouvelleBranche: null }],
    })
    erreur(SchemaPassagesBranche, { passages: [] }, 'Aucun passage à appliquer')
    erreur(SchemaPassagesBranche, { passages: [{}] }, 'scoutId manquant')
    erreur(SchemaPassagesBranche, { passages: [{ scoutId: 's1', nouvelleBranche: 'constructor' }] }, 'Branche invalide')
  })

  it('valide les progressions et nettoie le commentaire', () => {
    expect(SchemaValidationProgression.parse({ badgeId: 'b1', commentaire: ' ' })).toEqual({
      badgeId: 'b1',
      commentaire: null,
    })
    erreur(SchemaValidationProgression, {}, 'badgeId est requis')
    erreur(SchemaValidationProgression, { badgeId: 12 }, 'Champ badgeId invalide')
  })

  it('expose une erreur 400 en français via le pipe du contrôleur', () => {
    try {
      new ZodPipe(SchemaModificationScout).transform({ consentementSante: 'oui' })
      expect.fail('Le corps invalide doit être rejeté')
    } catch (exception) {
      expect(exception).toBeInstanceOf(BadRequestException)
      expect((exception as BadRequestException).getResponse()).toEqual({ erreur: 'Champ consentementSante invalide' })
    }
  })
})
