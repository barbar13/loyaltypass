const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCodeLib = require('qrcode');
const db       = require('../database');
const auth     = require('../middleware/auth');
const { generatePkpass } = require('../passes/pkpass');

const router = express.Router();

// ─── Public: self-enrollment ──────────────────────────────────────────────────

// POST /api/cards/enroll — customer registers themselves via the enrollment page
router.post('/enroll', async (req, res) => {
  const { merchant_id, first_name, phone } = req.body;

  if (!merchant_id || !first_name || !phone) {
    return res.status(400).json({ error: 'merchant_id, first_name et phone sont requis' });
  }

  const merchant = db.prepare(
    'SELECT id, name, color FROM merchants WHERE id = ?'
  ).get(merchant_id);
  if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

  // Find or create customer by phone (idempotent — update first_name on re-enroll)
  let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
  if (!customer) {
    const r = db.prepare(
      'INSERT INTO customers (first_name, phone) VALUES (?, ?)'
    ).run(first_name.trim(), phone.trim());
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid);
  } else {
    db.prepare('UPDATE customers SET first_name = ? WHERE id = ?').run(first_name.trim(), customer.id);
    customer = { ...customer, first_name: first_name.trim() };
  }

  // Find or create card (idempotent)
  let card = db.prepare(
    'SELECT * FROM cards WHERE merchant_id = ? AND customer_id = ?'
  ).get(merchant_id, customer.id);
  const isNew = !card;

  if (!card) {
    const r = db.prepare(
      'INSERT INTO cards (merchant_id, customer_id, qr_code) VALUES (?, ?, ?)'
    ).run(merchant_id, customer.id, uuidv4());
    card = db.prepare('SELECT * FROM cards WHERE id = ?').get(r.lastInsertRowid);
  }

  // pkpass URL only when Apple certs are configured
  const appleConfigured = process.env.APPLE_WWDR_CERT && process.env.APPLE_PASS_CERT && process.env.APPLE_PASS_KEY;
  const pkpass_url = appleConfigured ? `/api/cards/${card.id}/pass` : null;

  res.status(isNew ? 201 : 200).json({
    card,
    customer: { id: customer.id, first_name: customer.first_name, phone: customer.phone },
    merchant: { id: merchant.id, name: merchant.name, color: merchant.color },
    pkpass_url,
    is_new: isNew,
  });
});

// GET /api/cards/:id/pass — download signed .pkpass for Apple Wallet
router.get('/:id/pass', async (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(card.customer_id);
  const merchant = db.prepare(
    'SELECT id, name, color FROM merchants WHERE id = ?'
  ).get(card.merchant_id);

  try {
    const passBuffer = await generatePkpass({ card, customer, merchant });
    if (!passBuffer) {
      return res.status(501).json({
        error: 'Apple Wallet non configuré',
        setup: 'Définissez APPLE_WWDR_CERT, APPLE_PASS_CERT et APPLE_PASS_KEY dans .env. Voir developer.apple.com/wallet.',
      });
    }
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${merchant.name}-fidelite.pkpass"`);
    res.send(passBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Erreur génération du pass' });
  }
});

// ─── Merchant auth routes ─────────────────────────────────────────────────────

// POST /api/cards/create
router.post('/create', auth, (req, res) => {
  const { phone, email } = req.body;

  if (!phone && !email) {
    return res.status(400).json({ error: 'phone ou email du client requis' });
  }

  let customer = null;
  if (email)  customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
  if (!customer && phone) customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
  if (!customer) {
    const result = db.prepare('INSERT INTO customers (phone, email) VALUES (?, ?)').run(phone || null, email || null);
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  }

  const existingCard = db.prepare(
    'SELECT * FROM cards WHERE merchant_id = ? AND customer_id = ?'
  ).get(req.merchant.id, customer.id);

  if (existingCard) {
    return res.status(409).json({ error: 'Ce client a déjà une carte chez ce marchand', card: existingCard });
  }

  const result = db.prepare(
    'INSERT INTO cards (merchant_id, customer_id, points, qr_code) VALUES (?, ?, 0, ?)'
  ).run(req.merchant.id, customer.id, uuidv4());

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ card, customer });
});

// POST /api/cards/scan
router.post('/scan', auth, (req, res) => {
  const { qr_code, points } = req.body;

  if (!qr_code || points === undefined) {
    return res.status(400).json({ error: 'qr_code et points sont requis' });
  }
  if (!Number.isInteger(points) || points <= 0) {
    return res.status(400).json({ error: 'points doit être un entier positif' });
  }

  const card = db.prepare('SELECT * FROM cards WHERE qr_code = ?').get(qr_code);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });
  if (card.merchant_id !== req.merchant.id) {
    return res.status(403).json({ error: "Cette carte n'appartient pas à votre établissement" });
  }

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE cards SET points = points + ? WHERE id = ?').run(points, card.id);
    db.prepare('INSERT INTO transactions (card_id, points_added) VALUES (?, ?)').run(card.id, points);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Erreur lors du scan' });
  }

  const updatedCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id);
  const customer   = db.prepare('SELECT id, first_name, phone, email FROM customers WHERE id = ?').get(card.customer_id);
  res.json({ card: updatedCard, customer, points_added: points });
});

// GET /api/cards/qr-image/:text — server-side QR PNG (avoids client-side lib CDN issues)
router.get('/qr-image/:text', async (req, res) => {
  const { text } = req.params;
  if (!text || text.length > 256) return res.status(400).json({ error: 'Invalid text' });
  const size = parseInt(req.query.size, 10) || 200;
  const buf = await QRCodeLib.toBuffer(text, { type: 'png', width: Math.min(size, 400), margin: 1 });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(buf);
});

// GET /api/cards/:qr_code — card info by QR UUID
router.get('/:qr_code', (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE qr_code = ?').get(req.params.qr_code);
  if (!card) return res.status(404).json({ error: 'Carte introuvable' });

  const customer = db.prepare('SELECT id, first_name, phone, email FROM customers WHERE id = ?').get(card.customer_id);
  const merchant = db.prepare('SELECT id, name, logo_url, color, plan FROM merchants WHERE id = ?').get(card.merchant_id);
  const transactions = db.prepare(
    'SELECT id, points_added, date FROM transactions WHERE card_id = ? ORDER BY date DESC LIMIT 20'
  ).all(card.id);

  res.json({ card, customer, merchant, transactions });
});

module.exports = router;
