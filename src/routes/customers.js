const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db    = require('../database');
const email = require('../email');

const router = express.Router();

// POST /api/customers/enroll
// Customer scans a merchant QR → creates or finds their universal card + membership
router.post('/enroll', async (req, res) => {
  const { merchant_id, first_name, phone, email: customerEmail } = req.body;

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
      const upEmail = customerEmail ? customerEmail.trim() : customer.email;
      await db.run('UPDATE customers SET first_name = $1, email = $2 WHERE id = $3',
        [first_name.trim(), upEmail || null, customer.id]);
      customer = { ...customer, first_name: first_name.trim(), email: upEmail };
    }
    // Store email for new customer if provided
    if (!customer.email && customerEmail) {
      await db.run('UPDATE customers SET email = $1 WHERE id = $2', [customerEmail.trim(), customer.id]);
      customer = { ...customer, email: customerEmail.trim() };
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

// GET /api/customers/lookup?phone=...
router.get('/lookup', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone est requis' });
  try {
    const customer = await db.one(
      'SELECT id, first_name, qr_code FROM customers WHERE phone = $1',
      [phone.trim()]
    );
    if (!customer) return res.status(404).json({ error: 'Aucune carte trouvée pour ce numéro' });
    res.json({ first_name: customer.first_name, qr_code: customer.qr_code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/join — create standalone customer card (no merchant required)
router.post('/join', async (req, res) => {
  const { first_name, phone, email: customerEmail } = req.body;
  if (!first_name || !phone) return res.status(400).json({ error: 'first_name et phone sont requis' });
  try {
    let customer = await db.one('SELECT * FROM customers WHERE phone = $1', [phone.trim()]);
    const isNew = !customer;
    if (!customer) {
      const id = await db.insert(
        'INSERT INTO customers (first_name, phone, email, qr_code) VALUES ($1, $2, $3, $4)',
        [first_name.trim(), phone.trim(), customerEmail ? customerEmail.trim().toLowerCase() : null, uuidv4()]
      );
      customer = await db.one('SELECT id, first_name, phone, email, qr_code FROM customers WHERE id = $1', [id]);
    }
    const baseUrl = process.env.BASE_URL || 'https://fidelyzio.com';
    const cardUrl = `${baseUrl}/card/${customer.qr_code}`;
    if (isNew && customer.email) {
      email.sendCustomerWelcome({ to: customer.email, firstName: customer.first_name, cardUrl }).catch(() => {});
    }
    res.json({ customer: { id: customer.id, first_name: customer.first_name, phone: customer.phone, qr_code: customer.qr_code } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/recover — send card link to email on file
router.post('/recover', async (req, res) => {
  const { email: queryEmail, phone } = req.body;
  if (!queryEmail && !phone)
    return res.status(400).json({ error: 'email ou phone requis' });

  try {
    let customer;
    if (queryEmail) {
      customer = await db.one(
        'SELECT * FROM customers WHERE LOWER(email) = $1',
        [queryEmail.trim().toLowerCase()]
      );
    } else {
      customer = await db.one('SELECT * FROM customers WHERE phone = $1', [phone.trim()]);
    }

    if (customer?.email) {
      const baseUrl = process.env.BASE_URL || 'https://fidelyzio.com';
      const cardUrl = `${baseUrl}/card/${customer.qr_code}`;
      email.sendCardRecovery({ to: customer.email, firstName: customer.first_name, cardUrl }).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        mb.id, mb.points, mb.stamps_count, mb.joined_at,
        me.id                AS merchant_id,
        me.name              AS merchant_name,
        me.color,
        me.logo_url,
        me.loyalty_mechanic  AS mechanic,
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
