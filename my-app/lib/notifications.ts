// Couche d'abstraction des notifications sortantes. Un seul canal est
// opérationnel pour l'instant (email). Le SMS est modélisé mais désactivé :
// les opérateurs ivoiriens (Orange, MTN, Moov) exigent un contrat local et
// des identifiants d'expéditeur qui ne sont pas encore disponibles. Router
// tous les appels via cette fonction — plutôt que d'appeler lib/email
// directement — permet d'activer le SMS plus tard sans toucher aux appelants.

import { envoyerEmailBrut, echapperHtml } from './email'
import { logger } from './logger'

export type CanalNotification = 'email' | 'sms'

interface NotificationEmail {
  canal: 'email'
  destinataire: string
  sujet: string
  html: string
}

interface NotificationSMS {
  canal: 'sms'
  destinataire: string
  message: string
}

export type Notification = NotificationEmail | NotificationSMS

export async function envoyerNotification(
  notif: Notification,
): Promise<{ ok: boolean; mode: string }> {
  if (notif.canal === 'sms') {
    logger.warn('notification.sms_non_configure', { destinataire: notif.destinataire })
    return { ok: false, mode: 'sms_non_configure' }
  }
  return envoyerEmailBrut(notif.destinataire, notif.sujet, notif.html)
}

function enteteEmail(titre: string): string {
  return `
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="color:#1a4731;font-size:22px;margin:0">⚜️ ${echapperHtml(titre)}</h1>
      <p style="color:#666;font-size:14px;margin-top:4px">Côte d'Ivoire</p>
    </div>
  `
}

function piedEmail(): string {
  return `
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#bbb;font-size:11px;text-align:center">
      Association Scouts Catholiques de Côte d'Ivoire
    </p>
  `
}

export async function envoyerEmailBienvenue(params: {
  email: string
  prenom: string
  identifiant: string
  roleLabel: string
  nomSite: string
  urlConnexion: string
}) {
  const { email, prenom, identifiant, roleLabel, nomSite, urlConnexion } = params
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
      ${enteteEmail(nomSite)}
      <p style="color:#222;font-size:15px">Bonjour <strong>${echapperHtml(prenom)}</strong>,</p>
      <p style="color:#444;font-size:14px;line-height:1.6">
        Un compte <strong>${echapperHtml(roleLabel)}</strong> vient d'être créé pour vous sur ${echapperHtml(nomSite)}.
        Votre identifiant de connexion est :
      </p>
      <p style="text-align:center;margin:20px 0">
        <span style="background:#1a4731;color:#fff;font-family:monospace;font-size:16px;padding:8px 16px;border-radius:8px;display:inline-block">${echapperHtml(identifiant)}</span>
      </p>
      <p style="color:#444;font-size:14px;line-height:1.6">
        Le mot de passe vous a été communiqué séparément. Si vous ne le connaissez pas,
        utilisez « Mot de passe oublié » sur la page de connexion.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${urlConnexion}" style="background:#1a4731;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">
          Se connecter
        </a>
      </div>
      ${piedEmail()}
    </div>
  `
  return envoyerNotification({ canal: 'email', destinataire: email, sujet: `Bienvenue sur ${nomSite}`, html })
}

export interface DocumentARenouveler {
  scoutNomComplet: string
  typeLabel: string
  dateExpiration: Date
}

export async function envoyerEmailRappelDocuments(params: {
  email: string
  prenom: string
  nomSite: string
  documents: DocumentARenouveler[]
  urlDocuments: string
}) {
  const { email, prenom, nomSite, documents, urlDocuments } = params
  const lignes = documents
    .map(
      (d) =>
        `<li style="margin-bottom:6px">${echapperHtml(d.typeLabel)} de <strong>${echapperHtml(d.scoutNomComplet)}</strong> — expire le ${d.dateExpiration.toLocaleDateString('fr-FR')}</li>`,
    )
    .join('')
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
      ${enteteEmail(nomSite)}
      <p style="color:#222;font-size:15px">Bonjour <strong>${echapperHtml(prenom)}</strong>,</p>
      <p style="color:#444;font-size:14px;line-height:1.6">
        Les documents suivants arrivent bientôt à expiration :
      </p>
      <ul style="color:#444;font-size:14px;line-height:1.6">${lignes}</ul>
      <div style="text-align:center;margin:32px 0">
        <a href="${urlDocuments}" style="background:#1a4731;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">
          Voir les documents
        </a>
      </div>
      ${piedEmail()}
    </div>
  `
  return envoyerNotification({
    canal: 'email',
    destinataire: email,
    sujet: `${nomSite} — documents à renouveler`,
    html,
  })
}
