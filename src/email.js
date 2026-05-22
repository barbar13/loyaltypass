'use strict';
const { Resend } = require('resend');

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendEmail(to, subject, html) {
  const client = getClient();
  if (!client) {
    console.log(`[email] Not configured — would send to ${to}: ${subject}`);
    return;
  }
  try {
    await client.emails.send({
      from: 'Fidelyzio <noreply@fidelyzio.com>',
      to,
      subject,
      html,
    });
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
    <span style="color:white;font-size:24px;font-weight:900;letter-spacing:-0.5px">◆ Fidelyzio</span>
    <p style="color:rgba(255,255,255,.65);margin:6px 0 0;font-size:13px">La fidélité digitale</p>
  </td></tr>
  <tr><td style="padding:36px 40px">${content}</td></tr>
  <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
      © ${new Date().getFullYear()} Fidelyzio · <a href="https://fidelyzio.com/cgu" style="color:#9ca3af">CGU</a> · <a href="https://fidelyzio.com/privacy" style="color:#9ca3af">Confidentialité</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function btn(url, label, color) {
  const bg = color || '#6366f1';
  return `<a href="${url}" style="display:inline-block;background:${bg};color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;margin-top:24px">${label} →</a>`;
}

exports.sendEmail = sendEmail;

exports.sendWelcome = ({ to, merchantName, enrollUrl, dashboardUrl }) =>
  sendEmail(to, `Bienvenue sur Fidelyzio, ${merchantName} !`, base(`
    <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">Bienvenue, ${merchantName} !</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 20px">Votre programme de fidélité est actif. Affichez ce lien en caisse pour que vos clients s'inscrivent :</p>
    <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
      <a href="${enrollUrl}" style="color:#6366f1;font-family:monospace;font-size:13px;word-break:break-all">${enrollUrl}</a>
    </div>
    ${btn(dashboardUrl, 'Accéder à mon tableau de bord')}
  `));

exports.sendForgotPassword = ({ to, merchantName, resetUrl }) =>
  sendEmail(to, 'Réinitialisation de votre mot de passe Fidelyzio', base(`
    <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">Réinitialiser votre mot de passe</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 8px">Bonjour ${merchantName},</p>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 20px">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans <strong>1 heure</strong>.</p>
    ${btn(resetUrl, 'Réinitialiser mon mot de passe')}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.</p>
  `));

exports.sendTrialReminder = ({ to, merchantName, daysLeft, subscribeUrl }) =>
  sendEmail(to, daysLeft <= 1
    ? 'Votre essai Fidelyzio expire demain !'
    : `Votre essai Fidelyzio expire dans ${daysLeft} jours`,
    base(`
    <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">${daysLeft <= 1 ? 'Derniers instants !' : `Plus que ${daysLeft} jours`}</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 20px">Bonjour ${merchantName}, votre période d'essai gratuite de 14 jours se termine ${daysLeft <= 1 ? 'demain' : `dans ${daysLeft} jours`}. Passez à Fidelyzio Pro pour continuer à fidéliser vos clients.</p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px;margin:0 0 24px">
      <p style="color:#92400e;font-weight:600;margin:0;font-size:15px">Fidelyzio Pro — 19 €/mois</p>
      <p style="color:#92400e;margin:4px 0 0;font-size:13px">Scans illimités · Export CSV · Récompenses · Support</p>
    </div>
    ${btn(subscribeUrl, "S'abonner maintenant")}
  `));

exports.sendPointsEarned = ({ to, firstName, points, totalPoints, merchantName, cardUrl }) =>
  sendEmail(to, `+${points} points chez ${merchantName} !`, base(`
    <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">+${points} points gagnés !</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 20px">Bonjour ${firstName}, vous avez gagné <strong>${points} points</strong> chez <strong>${merchantName}</strong>.<br>Votre solde total : <strong>${totalPoints} points</strong>.</p>
    ${btn(cardUrl, 'Voir ma carte fidélité')}
  `));

exports.sendCardRecovery = ({ to, firstName, cardUrl }) =>
  sendEmail(to, 'Votre carte Fidelyzio', base(`
    <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">Voici votre carte, ${firstName} !</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">Vous avez demandé à retrouver votre carte de fidélité Fidelyzio. Cliquez sur le bouton ci-dessous pour y accéder :</p>
    ${btn(cardUrl, 'Voir ma carte fidélité', '#f0b429')}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Vous n'avez pas fait cette demande ? Ignorez cet e-mail.</p>
  `));

exports.sendCustomerWelcome = ({ to, firstName, cardUrl }) =>
  sendEmail(to, 'Bienvenue sur Fidelyzio !', base(`
    <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800">Bienvenue, ${firstName} !</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">Votre carte de fidélité Fidelyzio est prête. Présentez-la en caisse pour commencer à accumuler des points et des récompenses.</p>
    ${btn(cardUrl, 'Voir ma carte fidélité', '#f0b429')}
  `));
