const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

// POST /api/customers/enroll
// Customer scans a merchant QR → creates or finds their universal card + membership
router.post('/enroll', (req, res) => {
  const { merchant_id, first_name, phone } = req.body;

  if (!merchant_id || !first_name || !phone) {
    return res.status(400).json({ error: 'merchant_id, first_name et phone sont requis' });
  }

  const merchant = db.prepare(
    'SELECT id, name, color, logo_url FROM merchants WHERE id = ?'
  ).get(merchant_id);
  if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

  // Idempotent by phone — update name on re-enroll
  let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone.trim());
  if (!customer) {
    const r = db.prepare(
      'INSERT INTO customers (first_name, phone, qr_code) VALUES (?, ?, ?)'
    ).run(first_name.trim(), phone.trim(), uuidv4());
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid);
  } else {
    db.prepare('UPDATE customers SET first_name = ? WHERE id = ?').run(first_name.trim(), customer.id);
    customer = { ...customer, first_name: first_name.trim() };
  }

  // Idempotent membership
  let membership = db.prepare(
    'SELECT * FROM memberships WHERE merchant_id = ? AND customer_id = ?'
  ).get(merchant_id, customer.id);
  const isNew = !membership;

  if (!membership) {
    const r = db.prepare(
      'INSERT INTO memberships (merchant_id, customer_id) VALUES (?, ?)'
    ).run(merchant_id, customer.id);
    membership = db.prepare('SELECT * FROM memberships WHERE id = ?').get(r.lastInsertRowid);
  }

  const rewards = db.prepare(
    'SELECT * FROM rewards WHERE merchant_id = ? AND active = 1 ORDER BY points_required ASC'
  ).all(merchant_id);

  res.status(isNew ? 201 : 200).json({
    customer: {
      id: customer.id,
      first_name: customer.first_name,
      phone: customer.phone,
      qr_code: customer.qr_code,
    },
    membership,
    merchant,
    rewards,
    is_new: isNew,
  });
});

// GET /api/customers/:qr_code
// Customer views their universal loyalty card: all merchants + points + rewards
router.get('/:qr_code', (req, res) => {
  const customer = db.prepare(
    'SELECT id, first_name, phone, qr_code, created_at FROM customers WHERE qr_code = ?'
  ).get(req.params.qr_code);
  if (!customer) return res.status(404).json({ error: 'Carte introuvable' });

  const memberships = db.prepare(`
    SELECT
      mb.id, mb.points, mb.joined_at,
      me.id   AS merchant_id,
      me.name AS merchant_name,
      me.color,
      me.logo_url,
      (SELECT MAX(t.created_at) FROM transactions t
       WHERE t.merchant_id = me.id AND t.customer_id = mb.customer_id) AS last_visit
    FROM memberships mb
    JOIN merchants me ON me.id = mb.merchant_id
    WHERE mb.customer_id = ?
    ORDER BY mb.points DESC
  `).all(customer.id);

  const membershipsFull = memberships.map(mb => ({
    ...mb,
    rewards: db.prepare(
      'SELECT * FROM rewards WHERE merchant_id = ? AND active = 1 ORDER BY points_required ASC'
    ).all(mb.merchant_id),
  }));

  res.json({ customer, memberships: membershipsFull });
});

module.exports = router;
