import nodemailer from 'nodemailer'

function createTransporter() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function envoyerEmailReinitialisation(email: string, prenom: string, lien: string) {
  const transporter = createTransporter()

  if (!transporter) {
    // Pas de SMTP configuré — afficher le lien en console (dev)
    console.log('\n[RESET PASSWORD LINK]', lien, '\n')
    return { ok: true, mode: 'console' }
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@scout-ascci.ci'

  await transporter.sendMail({
    from: `"SCOUT ASCCI" <${from}>`,
    to: email,
    subject: 'Réinitialisation de votre mot de passe',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#1a4731;font-size:22px;margin:0">⚜️ SCOUT ASCCI</h1>
          <p style="color:#666;font-size:14px;margin-top:4px">Côte d'Ivoire</p>
        </div>
        <p style="color:#222;font-size:15px">Bonjour <strong>${prenom}</strong>,</p>
        <p style="color:#444;font-size:14px;line-height:1.6">
          Vous avez demandé la réinitialisation de votre mot de passe.
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
          Ce lien est valable <strong>1 heure</strong>.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${lien}" style="background:#1a4731;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="color:#999;font-size:12px;line-height:1.6">
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
          Votre mot de passe ne sera pas modifié.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#bbb;font-size:11px;text-align:center">
          Association Scouts Catholiques de Côte d'Ivoire
        </p>
      </div>
    `,
  })

  return { ok: true, mode: 'email' }
}
