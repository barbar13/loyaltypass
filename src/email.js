'use strict';
const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

async function send({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email] Not configured — would send to ${to}: ${subject}`);
    return;
  }
  try {
    await t.sendMail({ from: `"Fidevo" <${process.env.EMAIL_USER}>`, to, subject, html });
  } catch (err) {
    console.error('[email] Failed:', err.message);
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

function base(content) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:100%">
  <tr><td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:32px 40px;text-align:center">
    <span style="color:white;font-size:24px;font-weight:900;letter-spacing:-0.5px">◆ Fidevo</span>
    <p style="color:rgba(255,255,255,.65);margin:6px 0 0;font-size:13px">La fidélité digitale</p>
  </td></tr>
  <tr><td style="padding:36px 40px">${content}</td></tr>
  <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
      © ${new Date().getFullYear()} Fidevo · <a href="https://fidevo.app/cgu" style="color:#9ca3af">CGU</a> · <a href="https://fidevo.app/privacy" style="color:#9ca3af">Confidentialité</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function btn(url, label) {
  return `<a href="${url}" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;margin-top:24px">${label} →</a>`;
}

exports.sendWelcome = ({ to, merchantName, enrollUrl, dashboardUrl }) =>
  send({
    to, subject: `Bienvenue sur Fidevo, ${merchantName} !`,
    html: base(`
      <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">Bienvenue, ${merchantName} ! 🎉</h2>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 20px">Votre programme de fidélité est actif. Affichez ce lien en caisse pour que vos clients s'inscrivent :</p>
      <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
        <a href="${enrollUrl}" style="color:#6366f1;font-family:monospace;font-size:13px;word-break:break-all">${enrollUrl}</a>
      </div>
      ${btn(dashboardUrl, 'Accéder à mon tableau de bord')}
    `),
  });

exports.sendForgotPassword = ({ to, merchantName, resetUrl }) =>
  send({
    to, subject: 'Réinitialisation de votre mot de passe Fidevo',
    html: base(`
      <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">Réinitialiser votre mot de passe</h2>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 8px">Bonjour ${merchantName},</p>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 20px">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans <strong>1 heure</strong>.</p>
      ${btn(resetUrl, 'Réinitialiser mon mot de passe')}
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.</p>
    `),
  });

exports.sendPointsEarned = ({ to, firstName, points, totalPoints, merchantName, cardUrl }) =>
  send({
    to, subject: `+${points} points chez ${merchantName} !`,
    html: base(`
      <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">+${points} points gagnés ! 🎉</h2>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 20px">Bonjour ${firstName}, vous avez gagné <strong>${points} points</strong> chez <strong>${merchantName}</strong>.<br>Votre solde total : <strong>${totalPoints} points</strong>.</p>
      ${btn(cardUrl, 'Voir ma carte fidélité')}
    `),
  });
