const express = require('express');
const db   = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/scan/lookup/:customer_qr_code
// Preview a customer before confirming points — read-only, no side effects
router.get('/lookup/:customer_qr_code', auth, (req, res) => {
  const merchantId = req.merchant.id;

  const customer = db.prepare(
    'SELECT id, first_name, phone FROM customers WHERE qr_code = ?'
  ).get(req.params.customer_qr_code);

  if (!customer) {
    return res.status(404).json({ error: 'Client introuvable — QR code invalide' });
  }

  const membership = db.prepare(
    'SELECT * FROM memberships WHERE merchant_id = ? AND customer_id = ?'
  ).get(merchantId, customer.id);

  const { cnt } = db.prepare(`
    SELECT COUNT(*) as cnt FROM transactions
    WHERE merchant_id = ? AND customer_id = ? AND DATE(created_at) = DATE('now', 'localtime')
  `).get(merchantId, customer.id);

  const rewards = db.prepare(
    'SELECT * FROM rewards WHERE merchant_id = ? AND active = 1 ORDER BY points_required ASC'
  ).all(merchantId);

  res.json({
    customer: { id: customer.id, first_name: customer.first_name, phone: customer.phone },
    membership: membership || { points: 0, joined_at: null },
    is_new_customer: !membership,
    already_scanned_today: cnt > 0,
    rewards,
  });
});

// POST /api/scan
// Merchant scans customer QR → adds points (max 1 per customer per merchant per day)
router.post('/', auth, (req, res) => {
  const { customer_qr_code, points } = req.body;
  const merchantId = req.merchant.id;

  if (!customer_qr_code) {
    return res.status(400).json({ error: 'customer_qr_code est requis' });
  }

  const pts = parseInt(points, 10);
  if (!Number.isInteger(pts) || pts <= 0 || pts > 9999) {
    return res.status(400).json({ error: 'points doit être un entier entre 1 et 9999' });
  }

  const customer = db.prepare(
    'SELECT * FROM customers WHERE qr_code = ?'
  ).get(customer_qr_code);
  if (!customer) {
    return res.status(404).json({ error: 'Client introuvable — QR code invalide' });
  }

  // Anti-fraud: max 1 point transaction per customer per merchant per calendar day
  const { cnt } = db.prepare(`
    SELECT COUNT(*) as cnt FROM transactions
    WHERE merchant_id = ? AND customer_id = ? AND DATE(created_at) = DATE('now', 'localtime')
  `).get(merchantId, customer.id);

  if (cnt > 0) {
    return res.status(429).json({
      error: 'Ce client a déjà reçu des points aujourd\'hui chez vous.',
      already_scanned: true,
    });
  }

  // Find or create membership
  let membership = db.prepare(
    'SELECT * FROM memberships WHERE merchant_id = ? AND customer_id = ?'
  ).get(merchantId, customer.id);

  db.exec('BEGIN');
  try {
    if (!membership) {
      const r = db.prepare(
        'INSERT INTO memberships (merchant_id, customer_id, points) VALUES (?, ?, ?)'
      ).run(merchantId, customer.id, pts);
      membership = db.prepare('SELECT * FROM memberships WHERE id = ?').get(r.lastInsertRowid);
    } else {
      db.prepare('UPDATE memberships SET points = points + ? WHERE id = ?').run(pts, membership.id);
    }
    db.prepare(
      'INSERT INTO transactions (merchant_id, customer_id, points) VALUES (?, ?, ?)'
    ).run(merchantId, customer.id, pts);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Erreur lors du scan', detail: err.message });
  }

  const updatedMembership = db.prepare('SELECT * FROM memberships WHERE merchant_id = ? AND customer_id = ?')
    .get(merchantId, customer.id);

  const rewards = db.prepare(
    'SELECT * FROM rewards WHERE merchant_id = ? AND active = 1 ORDER BY points_required ASC'
  ).all(merchantId);

  res.json({
    customer: { id: customer.id, first_name: customer.first_name, phone: customer.phone },
    membership: updatedMembership,
    points_added: pts,
    rewards,
  });
});

module.exports = router;
