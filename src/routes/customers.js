const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

// POST /api/customers/enroll
// Customer scans a merchant QR → creates or finds their universal card + membership
router.post('/enroll', async (req, res) => {
  const { merchant_id, first_name, phone } = req.body;

  if (!merchant_id || !first_name || !phone) {
    return res.status(400).json({ error: 'merchant_id, first_name et phone sont requis' });
  }

  try {
    const merchant = await db.one(
      'SELECT id, name, color, logo_url FROM merchants WHERE id = $1',
      [merchant_id]
    );
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

    // Idempotent by phone — update name on re-enroll
    let customer = await db.one('SELECT * FROM customers WHERE phone = $1', [phone.trim()]);
    if (!customer) {
      const id = await db.insert(
        'INSERT INTO customers (first_name, phone, qr_code) VALUES ($1, $2, $3)',
        [first_name.trim(), phone.trim(), uuidv4()]
      );
      customer = await db.one('SELECT * FROM customers WHERE id = $1', [id]);
    } else {
      await db.run('UPDATE customers SET first_name = $1 WHERE id = $2', [first_name.trim(), customer.id]);
      customer = { ...customer, first_name: first_name.trim() };
    }

    // Idempotent membership
    let membership = await db.one(
      'SELECT * FROM memberships WHERE merchant_id = $1 AND customer_id = $2',
      [merchant_id, customer.id]
    );
    const isNew = !membership;

    if (!membership) {
      const id = await db.insert(
        'INSERT INTO memberships (merchant_id, customer_id) VALUES ($1, $2)',
        [merchant_id, customer.id]
      );
      membership = await db.one('SELECT * FROM memberships WHERE id = $1', [id]);
    }

    const rewards = await db.all(
      'SELECT * FROM rewards WHERE merchant_id = $1 AND active = 1 ORDER BY points_required ASC',
      [merchant_id]
    );

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
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// GET /api/customers/:qr_code
// Customer views their universal loyalty card — all merchants + points + rewards
router.get('/:qr_code', async (req, res) => {
  try {
    const customer = await db.one(
      'SELECT id, first_name, phone, qr_code, created_at FROM customers WHERE qr_code = $1',
      [req.params.qr_code]
    );
    if (!customer) return res.status(404).json({ error: 'Carte introuvable' });

    const memberships = await db.all(`
      SELECT
        mb.id, mb.points, mb.joined_at,
        me.id       AS merchant_id,
        me.name     AS merchant_name,
        me.color,
        me.logo_url,
        (SELECT MAX(t.created_at) FROM transactions t
         WHERE t.merchant_id = me.id AND t.customer_id = mb.customer_id) AS last_visit
      FROM memberships mb
      JOIN merchants me ON me.id = mb.merchant_id
      WHERE mb.customer_id = $1
      ORDER BY mb.points DESC
    `, [customer.id]);

    const membershipsFull = await Promise.all(
      memberships.map(async mb => ({
        ...mb,
        rewards: await db.all(
          'SELECT * FROM rewards WHERE merchant_id = $1 AND active = 1 ORDER BY points_required ASC',
          [mb.merchant_id]
        ),
      }))
    );

    // Redemption history (negative-point transactions)
    const redemptions = await db.all(`
      SELECT t.id, t.points, t.created_at, t.note,
             m.id AS merchant_id, m.name AS merchant_name, m.color
      FROM transactions t
      JOIN merchants m ON m.id = t.merchant_id
      WHERE t.customer_id = $1 AND t.points < 0
      ORDER BY t.created_at DESC
      LIMIT 20
    `, [customer.id]);

    res.json({ customer, memberships: membershipsFull, redemptions });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

module.exports = router;
