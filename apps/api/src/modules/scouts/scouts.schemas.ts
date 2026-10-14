import { estCheminLocalValide, motDePasseValide, REGLE_MOT_DE_PASSE } from '@scout/shared'
import { z } from 'zod'
import { BrancheType, Sexe, TypeDocument } from '../../generated/prisma/client'

// Schémas Zod des routes /scouts. Ils ne portent que la forme des données :
// cloisonnement par paroisse et par branche, existence en base, unicité du
// matricule, rattachement des fichiers et règles sur les contacts restent dans
// les services.

export const MAX_LIGNES_IMPORT = 500

const MESSAGE_PHOTO = 'photo doit être un chemin local (ex : /api/fichiers/…)'

// Corps JSON : un objet (jamais un tableau ni une valeur scalaire). Les clés
// inconnues sont retirées, rien n'est transmis tel quel à Prisma.
function corpsScout<T extends z.ZodRawShape>(forme: T) {
  return z.object(forme, { error: 'Données invalides' })
}

// Texte facultatif : undefined s'il est absent, sinon une chaîne obligatoirement.
function champTexte(cle: string) {
  return z.string({ error: `Champ ${cle} invalide` }).optional()
}

// Texte facultatif et effaçable : null est accepté (efface la valeur).
function champTexteOuNull(cle: string) {
  return z.string({ error: `Champ ${cle} invalide` }).nullish()
}

function champBooleen(cle: string) {
  return z.boolean({ error: `Champ ${cle} invalide` }).optional()
}

// Texte obligatoire (nettoyé) : absent ou vide → `requis`, autre type → champ invalide.
function champTexteRequis(cle: string, requis: string) {
  return z
    .string({ error: (issue) => (issue.input === undefined ? requis : `Champ ${cle} invalide`) })
    .trim()
    .min(1, { error: requis })
}

// Nettoyé, vide ou null → null.
function nettoyeOuNul(valeur: string | null | undefined): string | null {
  return valeur?.trim() || null
}

// Champ modifiable : absent → inchangé (undefined), sinon nettoyé, vide ou null → null.
function effacable(valeur: string | null | undefined): string | null | undefined {
  return valeur === undefined ? undefined : nettoyeOuNul(valeur)
}

// Photo : chemin local uniquement (le rattachement est vérifié par le service).
function photoInvalide(photo: string | null | undefined): boolean {
  return photo != null && photo !== '' && !estCheminLocalValide(photo)
}

// Champ texte d'un objet quelconque : tout ce qui n'est pas une chaîne est traité comme absent.
function chaine(objet: unknown, cle: string): string | undefined {
  if (typeof objet !== 'object' || objet === null) return undefined
  const valeur = (objet as Record<string, unknown>)[cle]
  return typeof valeur === 'string' ? valeur : undefined
}

const MESSAGE_CONTACTS = "Au moins un contact d'urgence est requis"

// POST /scouts
export const SchemaCreationScout = corpsScout({
  nom: champTexteRequis('nom', 'Le nom est requis'),
  prenom: champTexteRequis('prenom', 'Le prénom est requis'),
  dateNaissance: champTexte('dateNaissance'),
  sexe: z.enum(Sexe, { error: 'Le sexe est invalide ou manquant' }),
  brancheType: z.enum(BrancheType, { error: 'La branche est invalide ou manquante' }),
  photo: champTexteOuNull('photo'),
  allergies: champTexteOuNull('allergies'),
  traitementsMedicaux: champTexteOuNull('traitementsMedicaux'),
  contactsUrgence: z.array(z.unknown(), { error: MESSAGE_CONTACTS }).min(1, { error: MESSAGE_CONTACTS }),
}).transform((corps, ctx) => {
  const rejeter = (message: string, champ: string) => {
    ctx.addIssue({ code: 'custom', message, path: [champ] })
    return z.NEVER
  }

  if (!corps.dateNaissance) return rejeter('La date de naissance est requise', 'dateNaissance')
  const dateNaissance = new Date(corps.dateNaissance)
  if (Number.isNaN(dateNaissance.getTime())) return rejeter('La date de naissance est invalide', 'dateNaissance')
  if (photoInvalide(corps.photo)) return rejeter(MESSAGE_PHOTO, 'photo')

  const contactsUrgence = []
  for (const [i, contact] of corps.contactsUrgence.entries()) {
    const nom = chaine(contact, 'nom')?.trim()
    const telephone = chaine(contact, 'telephone')?.trim()
    if (!nom) return rejeter(`Le nom du contact ${i + 1} est requis`, 'contactsUrgence')
    if (!telephone) return rejeter(`Le téléphone du contact ${i + 1} est requis`, 'contactsUrgence')
    contactsUrgence.push({
      nom,
      prenom: chaine(contact, 'prenom')?.trim() || null,
      telephone,
      relation: chaine(contact, 'relation')?.trim() || null,
      principal: (contact as Record<string, unknown>).principal === true,
    })
  }

  return {
    nom: corps.nom,
    prenom: corps.prenom,
    dateNaissance,
    sexe: corps.sexe,
    brancheType: corps.brancheType,
    photo: nettoyeOuNul(corps.photo),
    allergies: nettoyeOuNul(corps.allergies),
    traitementsMedicaux: nettoyeOuNul(corps.traitementsMedicaux),
    contactsUrgence,
  }
})
export type DonneesCreationScout = z.infer<typeof SchemaCreationScout>

// PUT /scouts/:id — mise à jour partielle : un champ absent reste inchangé,
// un champ effaçable vide (ou null) est effacé.
export const SchemaModificationScout = corpsScout({
  nom: champTexte('nom'),
  prenom: champTexte('prenom'),
  dateNaissance: champTexte('dateNaissance'),
  sexe: z.enum(Sexe, { error: 'Sexe invalide' }).optional(),
  brancheType: z.enum(BrancheType, { error: 'Branche invalide' }).optional(),
  actif: champBooleen('actif'),
  photo: champTexteOuNull('photo'),
  allergies: champTexteOuNull('allergies'),
  traitementsMedicaux: champTexteOuNull('traitementsMedicaux'),
  consentementImage: champBooleen('consentementImage'),
  consentementSante: champBooleen('consentementSante'),
}).transform((corps, ctx) => {
  const dateNaissance = corps.dateNaissance !== undefined ? new Date(corps.dateNaissance) : undefined
  if (dateNaissance && Number.isNaN(dateNaissance.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'La date de naissance est invalide', path: ['dateNaissance'] })
    return z.NEVER
  }
  if (photoInvalide(corps.photo)) {
    ctx.addIssue({ code: 'custom', message: MESSAGE_PHOTO, path: ['photo'] })
    return z.NEVER
  }
  return {
    nom: corps.nom?.trim(),
    prenom: corps.prenom?.trim(),
    dateNaissance,
    sexe: corps.sexe,
    brancheType: corps.brancheType,
    actif: corps.actif,
    photo: effacable(corps.photo),
    allergies: effacable(corps.allergies),
    traitementsMedicaux: effacable(corps.traitementsMedicaux),
    consentementImage: corps.consentementImage,
    consentementSante: corps.consentementSante,
  }
})
export type DonneesModificationScout = z.infer<typeof SchemaModificationScout>

// POST /scouts/:id/compte
export const SchemaCreationCompteScout = corpsScout({
  password: z.string({ error: REGLE_MOT_DE_PASSE }).refine(motDePasseValide, { error: REGLE_MOT_DE_PASSE }),
  telephone: champTexte('telephone').transform(nettoyeOuNul),
})
export type DonneesCreationCompteScout = z.infer<typeof SchemaCreationCompteScout>

// PUT /scouts/:id/matricule
export const SchemaMatriculeScout = corpsScout({
  matricule: champTexteRequis('matricule', 'Le matricule est requis'),
})
export type DonneesMatriculeScout = z.infer<typeof SchemaMatriculeScout>

// POST /scouts/import — seule l'enveloppe est validée ici : chaque ligne est
// contrôlée par le service, qui renvoie un rapport ligne par ligne.
export const SchemaImportScouts = corpsScout({
  scouts: z
    .array(z.unknown(), { error: 'Aucune ligne à importer' })
    .min(1, { error: 'Aucune ligne à importer' })
    .max(MAX_LIGNES_IMPORT, { error: `Maximum ${MAX_LIGNES_IMPORT} lignes par import` }),
})
export type DonneesImportScouts = z.infer<typeof SchemaImportScouts>

// POST /scouts/:id/contacts
export const SchemaCreationContact = corpsScout({
  nom: champTexteRequis('nom', 'Le nom du contact est requis'),
  prenom: champTexteOuNull('prenom').transform(nettoyeOuNul),
  telephone: champTexteRequis('telephone', 'Le téléphone du contact est requis'),
  relation: champTexteOuNull('relation').transform(nettoyeOuNul),
  // Seul `true` rend le contact principal (toute autre valeur vaut false).
  principal: z
    .unknown()
    .optional()
    .transform((valeur) => valeur === true),
})
export type DonneesCreationContact = z.infer<typeof SchemaCreationContact>

// PUT /scouts/:id/contacts/:contactId — mise à jour partielle.
export const SchemaModificationContact = corpsScout({
  nom: champTexte('nom').transform((valeur) => valeur?.trim()),
  prenom: champTexteOuNull('prenom').transform(effacable),
  telephone: champTexte('telephone').transform((valeur) => valeur?.trim()),
  relation: champTexteOuNull('relation').transform(effacable),
  principal: champBooleen('principal'),
})
export type DonneesModificationContact = z.infer<typeof SchemaModificationContact>

// POST /scouts/:id/documents
export const SchemaAjoutDocument = corpsScout({
  type: z.enum(TypeDocument, { error: 'Type de document invalide' }),
  nomFichier: champTexte('nomFichier'),
  url: champTexte('url'),
  dateExpiration: champTexteOuNull('dateExpiration'),
}).transform((corps, ctx) => {
  const rejeter = (message: string, champ: string) => {
    ctx.addIssue({ code: 'custom', message, path: [champ] })
    return z.NEVER
  }
  const nomFichier = corps.nomFichier?.trim()
  const url = corps.url?.trim()
  if (!nomFichier || !url) return rejeter('Le fichier est requis', 'url')
  if (!estCheminLocalValide(url)) return rejeter('url doit être un chemin local (ex : /api/fichiers/…)', 'url')
  let dateExpiration: Date | null = null
  if (corps.dateExpiration) {
    dateExpiration = new Date(corps.dateExpiration)
    if (Number.isNaN(dateExpiration.getTime())) return rejeter("Date d'expiration invalide", 'dateExpiration')
  }
  return { type: corps.type, nomFichier, url, dateExpiration }
})
export type DonneesAjoutDocument = z.infer<typeof SchemaAjoutDocument>

// POST /scouts/passage-branche — nouvelleBranche null : sortie du mouvement.
const SchemaPassage = z.object(
  {
    scoutId: z.string({ error: 'scoutId manquant' }).min(1, { error: 'scoutId manquant' }),
    nouvelleBranche: z
      .enum(BrancheType, { error: 'Branche invalide' })
      .nullish()
      .transform((valeur) => valeur ?? null),
  },
  { error: 'scoutId manquant' },
)

export const SchemaPassagesBranche = corpsScout({
  passages: z
    .array(SchemaPassage, { error: 'Aucun passage à appliquer' })
    .min(1, { error: 'Aucun passage à appliquer' }),
})
export type DonneesPassagesBranche = z.infer<typeof SchemaPassagesBranche>

// POST /scouts/:id/progressions
export const SchemaValidationProgression = corpsScout({
  badgeId: z
    .string({ error: (issue) => (issue.input === undefined ? 'badgeId est requis' : 'Champ badgeId invalide') })
    .min(1, { error: 'badgeId est requis' }),
  commentaire: champTexte('commentaire').transform(nettoyeOuNul),
})
export type DonneesValidationProgression = z.infer<typeof SchemaValidationProgression>
