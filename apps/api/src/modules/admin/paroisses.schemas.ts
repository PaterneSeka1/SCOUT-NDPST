import { estCouleurHexValide, estUrlFichierValide, motDePasseValide, REGLE_MOT_DE_PASSE } from '@scout/shared'
import { z } from 'zod'
import { urlPubliqueBase } from '../../common/lib/storage'
import { champBooleen, champTexte, champTexteNettoye, corpsAdmin } from './admin.schemas'

// Texte facultatif : nettoyé, vide → null.
function nettoyeOuNul(valeur: string | undefined): string | null {
  return valeur?.trim() || null
}

// Champ modifiable : absent → inchangé (undefined), sinon nettoyé, vide → null.
function effacable(valeur: string | undefined): string | null | undefined {
  return valeur === undefined ? undefined : valeur.trim() || null
}

// POST /admin/paroisses
export const SchemaCreationParoisse = corpsAdmin({
  nom: champTexteNettoye('nom'),
  ville: champTexteNettoye('ville'),
  diocese: champTexteNettoye('diocese'),
  districtId: champTexteNettoye('districtId'),
  ocean: champTexte('ocean'),
  adresse: champTexte('adresse'),
  telephone: champTexte('telephone'),
  email: champTexteNettoye('email'),
}).transform((corps, ctx) => {
  const { nom, ville, diocese, districtId } = corps
  if (!nom || !ville || !diocese || !districtId) {
    ctx.addIssue({ code: 'custom', message: 'Le nom, la ville, le diocèse et le district sont obligatoires' })
    return z.NEVER
  }
  return {
    nom,
    ville,
    diocese,
    districtId,
    ocean: nettoyeOuNul(corps.ocean),
    adresse: nettoyeOuNul(corps.adresse),
    telephone: nettoyeOuNul(corps.telephone),
    email: corps.email || null,
  }
})
export type DonneesCreationParoisse = z.infer<typeof SchemaCreationParoisse>

const CHAMPS_COULEUR = ['couleurPrimaire', 'couleurAccent', 'couleurFond', 'couleurHover'] as const

// PATCH /admin/paroisses/:id — mise à jour partielle : un champ absent reste
// inchangé, un champ vide (ou null) est effacé.
export const SchemaModificationParoisse = corpsAdmin({
  nom: champTexte('nom'),
  ville: champTexte('ville'),
  diocese: champTexte('diocese'),
  ocean: champTexte('ocean'),
  districtId: champTexte('districtId'),
  adresse: champTexte('adresse'),
  telephone: champTexte('telephone'),
  email: champTexte('email'),
  logo: champTexte('logo'),
  actif: champBooleen('actif'),
  couleurPrimaire: champTexte('couleurPrimaire'),
  couleurAccent: champTexte('couleurAccent'),
  couleurFond: champTexte('couleurFond'),
  couleurHover: champTexte('couleurHover'),
}).transform((corps, ctx) => {
  const { logo, districtId } = corps
  if (logo != null && logo.trim() !== '' && !estUrlFichierValide(logo.trim(), urlPubliqueBase())) {
    ctx.addIssue({
      code: 'custom',
      message: 'logo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée',
      path: ['logo'],
    })
    return z.NEVER
  }

  // Toute paroisse appartient à un district — jamais nul, donc jamais vidable ici.
  if (districtId !== undefined && !districtId.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Le district est obligatoire', path: ['districtId'] })
    return z.NEVER
  }

  // Ces couleurs sont injectées dans une balise <style> : contrôle strict.
  for (const champCouleur of CHAMPS_COULEUR) {
    const valeur = corps[champCouleur]
    if (valeur != null && valeur.trim() !== '' && !estCouleurHexValide(valeur)) {
      ctx.addIssue({
        code: 'custom',
        message: `${champCouleur} doit être une couleur hexadécimale valide (ex : #1a4731)`,
        path: [champCouleur],
      })
      return z.NEVER
    }
  }

  return {
    nom: corps.nom?.trim(),
    ville: corps.ville?.trim(),
    diocese: corps.diocese?.trim(),
    ocean: effacable(corps.ocean),
    districtId,
    adresse: effacable(corps.adresse),
    telephone: effacable(corps.telephone),
    email: effacable(corps.email),
    logo: effacable(logo),
    actif: corps.actif,
    couleurPrimaire: effacable(corps.couleurPrimaire),
    couleurAccent: effacable(corps.couleurAccent),
    couleurFond: effacable(corps.couleurFond),
    couleurHover: effacable(corps.couleurHover),
  }
})
export type DonneesModificationParoisse = z.infer<typeof SchemaModificationParoisse>

// POST /admin/paroisses/:id/chef-groupe
export const SchemaCreationChefGroupe = corpsAdmin({
  nom: champTexteNettoye('nom'),
  prenom: champTexteNettoye('prenom'),
  matricule: champTexteNettoye('matricule'),
  telephone: champTexteNettoye('telephone'),
  email: champTexteNettoye('email'),
  password: champTexte('password'),
}).transform((corps, ctx) => {
  const { nom, prenom, matricule, password } = corps
  if (!nom || !prenom || !matricule || !password) {
    ctx.addIssue({ code: 'custom', message: 'Le nom, le prénom, le matricule et le mot de passe sont requis' })
    return z.NEVER
  }
  if (!motDePasseValide(password)) {
    ctx.addIssue({ code: 'custom', message: REGLE_MOT_DE_PASSE, path: ['password'] })
    return z.NEVER
  }
  return { nom, prenom, matricule, telephone: corps.telephone || null, email: corps.email || null, password }
})
export type DonneesCreationChefGroupe = z.infer<typeof SchemaCreationChefGroupe>
