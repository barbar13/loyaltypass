'use strict';
const jwt = require('jsonwebtoken');
const db  = require('../database');

// Google Wallet pass generation via JWT (RS256 signed with service account key)
// Required env vars:
//   GOOGLE_WALLET_ISSUER_ID       — from Google Pay & Wallet Console
//   GOOGLE_WALLET_CREDENTIALS     — service account JSON (base64-encoded or raw JSON string)

function getCredentials() {
  const raw = process.env.GOOGLE_WALLET_CREDENTIALS;
  if (!raw) return null;
  try {
    // Accept either raw JSON string or base64-encoded JSON
    const str = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// GET /api/google-wallet/:qr_code
async function generateWalletPass(req, res) {
  const issuerId    = process.env.GOOGLE_WALLET_ISSUER_ID;
  const credentials = getCredentials();

  if (!issuerId || !credentials) {
    return res.status(503).json({ error: 'Google Wallet non configuré (GOOGLE_WALLET_ISSUER_ID + GOOGLE_WALLET_CREDENTIALS requis)' });
  }

  const { qr_code } = req.params;
  try {
    const customer = await db.one(
      'SELECT id, first_name, qr_code FROM customers WHERE qr_code = $1', [qr_code]
    );
    if (!customer) return res.status(404).json({ error: 'Client introuvable' });

    const memberships = await db.all(
      `SELECT mb.points, me.name AS merchant_name, me.color
       FROM memberships mb JOIN merchants me ON me.id = mb.merchant_id
       WHERE mb.customer_id = $1 ORDER BY mb.points DESC LIMIT 1`,
      [customer.id]
    );
    const topMerchant = memberships[0];

    const objectId  = `${issuerId}.fidelyzio_${customer.id}`;
    const classId   = `${issuerId}.fidelyzio_loyalty_v1`;
    const hexColor  = topMerchant?.color || '#6366f1';

    const passObject = {
      id: objectId,
      classId,
      state: 'ACTIVE',
      hexBackgroundColor: hexColor,
      cardTitle: { defaultValue: { language: 'fr', value: 'Fidelyzio' } },
      subheader: { defaultValue: { language: 'fr', value: topMerchant?.merchant_name || 'Ma carte fidélité' } },
      header: { defaultValue: { language: 'fr', value: `${topMerchant?.points ?? 0} pts` } },
      textModulesData: [
        { id: 'holder', header: 'Titulaire', body: customer.first_name },
        { id: 'points', header: 'Points',    body: String(topMerchant?.points ?? 0) },
      ],
      barcode: { type: 'QR_CODE', value: customer.qr_code, alternateText: '' },
      logo: { sourceUri: { uri: `${process.env.BASE_URL || 'https://fidelyzio.com'}/logo.png` } },
    };

    const claims = {
      iss: credentials.client_email,
      aud: 'google',
      origins: [process.env.BASE_URL || 'https://fidelyzio.com'],
      typ: 'savetowallet',
      payload: { genericObjects: [passObject] },
    };

    const token = jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });
    res.json({ url: `https://pay.google.com/gp/v/save/${token}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { generateWalletPass };
