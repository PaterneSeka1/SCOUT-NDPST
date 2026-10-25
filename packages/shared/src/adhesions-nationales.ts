import { z } from 'zod'
import { anneeScolaireValide } from './cotisations'

export const PERMISSIONS_ADHESION = [
  'LIRE',
  'CREER',
  'ENCAISSER',
  'REVERSER',
  'CONFIRMER',
  'CORRIGER',
  'BAREMES',
] as const
export type PermissionAdhesion = (typeof PERMISSIONS_ADHESION)[number]
export const CATEGORIES_ADHESION = ['SCOUT', 'CHEF'] as const
export const SchemaAnneeAdhesion = z.string().refine(anneeScolaireValide, 'Année attendue : 2026-2027')
export const SchemaMontantFcfa = z.number().int().positive().max(2_147_483_647)
const id = z.string().min(1).max(100)
const texte = z.string().trim().max(1000)
export const SchemaBaremeAdhesion = z
  .object({
    annee: SchemaAnneeAdhesion,
    categorie: z.enum(CATEGORIES_ADHESION),
    brancheType: z
      .enum(['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS', 'RESSOURCES_ADULTES'])
      .nullable()
      .default(null),
    montant: SchemaMontantFcfa,
    libelle: z.string().trim().min(1).max(150),
    debutValidite: z.iso.datetime({ offset: true }),
    finValidite: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .strict()
  .refine(
    (v) => !v.finValidite || new Date(v.finValidite).getTime() > new Date(v.debutValidite).getTime(),
    'Dates de validité incohérentes',
  )
export const SchemaCreationAdhesion = z
  .object({
    annee: SchemaAnneeAdhesion,
    baremeId: id,
    scoutId: id.optional(),
    utilisateurId: id.optional(),
  })
  .strict()
  .refine((v) => Number(!!v.scoutId) + Number(!!v.utilisateurId) === 1, 'Choisir un scout ou un chef')
export const SchemaEncaissementAdhesion = z
  .object({
    montant: SchemaMontantFcfa,
    mode: z.string().trim().min(1).max(80),
    encaisseLe: z.iso.datetime({ offset: true }),
    reference: texte.optional(),
    note: texte.optional(),
    idempotence: z.uuid(),
  })
  .strict()
  .refine((v) => new Date(v.encaisseLe).getTime() <= Date.now(), 'La date ne peut pas être future')
export const SchemaLotNational = z
  .object({
    annee: SchemaAnneeAdhesion,
    adhesionIds: z.array(id).min(1).max(100),
  })
  .strict()
  .refine((v) => new Set(v.adhesionIds).size === v.adhesionIds.length, 'Adhésions répétées')
export const SchemaDeclarationNationale = z
  .object({
    verseLe: z.iso.datetime({ offset: true }),
    reference: z.string().trim().min(1).max(200),
    justification: texte.optional(),
  })
  .strict()
  .refine((v) => new Date(v.verseLe).getTime() <= Date.now(), 'La date ne peut pas être future')
export const SchemaConfirmationNationale = z
  .object({
    adhesionIds: z.array(id).min(1).max(100),
    reference: texte.optional(),
    commentaire: texte.optional(),
  })
  .strict()
  .refine((v) => new Set(v.adhesionIds).size === v.adhesionIds.length, 'Adhésions répétées')
export const SchemaMotifAdhesion = z.object({ motif: z.string().trim().min(5).max(1000) }).strict()
export const SchemaHabilitationAdhesion = z
  .object({
    utilisateurId: id,
    permission: z.enum(PERMISSIONS_ADHESION),
    brancheType: SchemaBaremeAdhesion.shape.brancheType,
    motif: z.string().trim().min(5).max(1000),
  })
  .strict()

export function situationLocale(montantDu: number, encaisse: number, exoneree = false) {
  if (exoneree) return 'EXONERE' as const
  if (encaisse === 0) return 'NON_PAYE' as const
  if (encaisse < montantDu) return 'PARTIELLEMENT_PAYE' as const
  return 'ENCAISSE_LOCALEMENT' as const
}
export function syntheseAdhesion<
  T extends {
    montantDu: number
    exoneree: boolean
    aVerifier: boolean
    encaissements: { montant: number; annulation: unknown }[]
    lignes: { engagee: boolean; montant: number; lot: { statut: string } }[]
    confirmations: { correction: unknown }[]
  },
>(adhesion: T) {
  const montantEncaisse = adhesion.encaissements.reduce((s, e) => s + (e.annulation ? 0 : e.montant), 0)
  const lignes = adhesion.lignes.filter((l) => l.engagee)
  const montantReverse = lignes
    .filter((l) => ['DECLARE', 'PARTIELLEMENT_CONFIRME', 'CONFIRME', 'ANOMALIE'].includes(l.lot.statut))
    .reduce((s, l) => s + l.montant, 0)
  const confirme = adhesion.confirmations.some((c) => !c.correction)
  return {
    ...adhesion,
    montantEncaisse,
    solde: adhesion.exoneree ? 0 : Math.max(0, adhesion.montantDu - montantEncaisse),
    situationLocale: situationLocale(adhesion.montantDu, montantEncaisse, adhesion.exoneree),
    situationReversement:
      lignes[0]?.lot.statut ??
      (montantEncaisse >= adhesion.montantDu && !adhesion.aVerifier ? 'EN_ATTENTE_REVERSEMENT' : 'NON_ELIGIBLE'),
    statutNational: confirme
      ? 'COTISANT_CONFIRME'
      : adhesion.aVerifier
        ? 'A_VERIFIER'
        : montantReverse
          ? 'CONFIRMATION_NATIONALE_EN_ATTENTE'
          : 'NON_CONFIRME',
    montantReverse,
    montantConfirme: confirme ? adhesion.montantDu : 0,
    eligibleReversement:
      !adhesion.aVerifier &&
      !adhesion.exoneree &&
      adhesion.montantDu > 0 &&
      montantEncaisse === adhesion.montantDu &&
      lignes.length === 0 &&
      !confirme,
  }
}
