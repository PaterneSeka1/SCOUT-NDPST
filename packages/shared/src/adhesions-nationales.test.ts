import { describe, expect, it } from 'vitest'
import {
  SchemaCreationAdhesion,
  SchemaEncaissementAdhesion,
  SchemaLotNational,
  SchemaMontantFcfa,
  syntheseAdhesion,
} from './adhesions-nationales'
import { espaceAutorise, mandatsActifs } from './mandats'
const base = { montantDu: 5000, exoneree: false, aVerifier: false, encaissements: [], lignes: [], confirmations: [] }
describe('adhésions nationales : contrats et machines à états', () => {
  it('refuse les fractions, montants négatifs/nuls et dépassements SQL', () => {
    for (const montant of [-1, 0, 0.5, 2147483648, NaN, Infinity])
      expect(SchemaMontantFcfa.safeParse(montant).success).toBe(false)
  })
  it('exige une personne unique et une année consécutive', () => {
    const c = { annee: '2026-2027', baremeId: 'b', scoutId: 's' }
    expect(SchemaCreationAdhesion.safeParse(c).success).toBe(true)
    expect(SchemaCreationAdhesion.safeParse({ ...c, utilisateurId: 'u' }).success).toBe(false)
    expect(SchemaCreationAdhesion.safeParse({ ...c, annee: '2026-2028' }).success).toBe(false)
  })
  it('exige date réelle, clé d’idempotence et membres distincts du lot', () => {
    expect(SchemaEncaissementAdhesion.safeParse({ montant: 100, mode: 'Espèces' }).success).toBe(false)
    expect(SchemaLotNational.safeParse({ annee: '2026-2027', adhesionIds: ['a', 'a'] }).success).toBe(false)
  })
  it('additionne trois paiements et ne confirme jamais automatiquement le national', () => {
    const a = syntheseAdhesion({
      ...base,
      encaissements: [2000, 1500, 1500].map((montant) => ({ montant, annulation: null })),
    })
    expect(a.montantEncaisse).toBe(5000)
    expect(a.situationLocale).toBe('ENCAISSE_LOCALEMENT')
    expect(a.statutNational).toBe('NON_CONFIRME')
    expect(a.eligibleReversement).toBe(true)
  })
  it('soustrait une annulation sans supprimer l’opération', () => {
    const a = syntheseAdhesion({
      ...base,
      encaissements: [
        { montant: 2000, annulation: {} },
        { montant: 1500, annulation: null },
      ],
    })
    expect(a.montantEncaisse).toBe(1500)
    expect(a.solde).toBe(3500)
    expect(a.encaissements).toHaveLength(2)
  })
  it('sépare préparation, déclaration et confirmation', () => {
    const a = {
      ...base,
      encaissements: [{ montant: 5000, annulation: null }],
      lignes: [{ engagee: true, montant: 5000, lot: { statut: 'DECLARE' } }],
    }
    expect(syntheseAdhesion(a).statutNational).toBe('CONFIRMATION_NATIONALE_EN_ATTENTE')
    expect(syntheseAdhesion({ ...a, confirmations: [{ correction: null }] }).statutNational).toBe('COTISANT_CONFIRME')
    expect(syntheseAdhesion({ ...a, confirmations: [{ correction: { motif: 'Erreur' } }] }).statutNational).not.toBe(
      'COTISANT_CONFIRME',
    )
  })
  it('bloque le reversement des dossiers historiques à vérifier', () => {
    expect(
      syntheseAdhesion({ ...base, aVerifier: true, encaissements: [{ montant: 5000, annulation: null }] })
        .eligibleReversement,
    ).toBe(false)
  })
})
describe('espaces des mandats simultanés', () => {
  const mandats = [
    { id: 'g', role: 'ASSISTANT_GROUPE', brancheType: null, debutLe: '2026-01-01', finLe: null },
    { id: 'r', role: 'RESPONSABLE_BRANCHE', brancheType: 'COMPAGNONS', debutLe: '2026-01-01', finLe: null },
  ]
  it('permet administration, groupe et branche au même compte', () => {
    expect(espaceAutorise('ADMINISTRATEUR', mandats, 'administration')?.role).toBe('ADMINISTRATEUR')
    expect(espaceAutorise('ADMINISTRATEUR', mandats, 'g')?.role).toBe('ASSISTANT_GROUPE')
    expect(espaceAutorise('ADMINISTRATEUR', mandats, 'r')?.brancheType).toBe('COMPAGNONS')
  })
  it('refuse un contexte inconnu et l’usurpation de l’administration', () => {
    expect(espaceAutorise('SCOUT', mandats, 'administration')).toBeNull()
    expect(espaceAutorise('SCOUT', mandats, 'inconnu')).toBeNull()
  })
  it('une clôture ou une expiration ne retire pas les autres fonctions', () => {
    const clos = [{ ...mandats[0], finLe: '2026-10-01' }, mandats[1]]
    expect(mandatsActifs(clos, new Date('2026-10-25'))).toHaveLength(1)
    expect(espaceAutorise('ADMINISTRATEUR', clos, 'g')).toBeNull()
    expect(espaceAutorise('ADMINISTRATEUR', clos, 'r')?.role).toBe('RESPONSABLE_BRANCHE')
  })
})
