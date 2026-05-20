const express = require('express');
const db      = require('../database');

const router = express.Router();

function adminAuth(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return res.status(503).json({ error: 'ADMIN_PASSWORD non configuré dans .env' });
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || token !== password) return res.status(401).json({ error: 'Mot de passe incorrect' });
  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

// ── Merchants ─────────────────────────────────────────────────────────────────

// GET /api/admin/merchants
router.get('/merchants', adminAuth, async (req, res) => {
  try {
    const merchants = await db.all(`
      SELECT
        m.id, m.name, m.email, m.color, m.plan, m.disabled, m.created_at,
        COUNT(DISTINCT mb.customer_id)  AS customer_count,
        COALESCE(SUM(t.points), 0)      AS total_points,
        MAX(t.created_at)               AS last_activity
      FROM merchants m
      LEFT JOIN memberships mb ON mb.merchant_id = m.id
      LEFT JOIN transactions t  ON t.merchant_id  = m.id
      GROUP BY m.id, m.name, m.email, m.color, m.plan, m.disabled, m.created_at
      ORDER BY m.created_at DESC
    `);

    const totals = merchants.reduce(
      (acc, m) => ({
        merchants: acc.merchants + 1,
        customers: acc.customers + Number(m.customer_count),
        points:    acc.points    + Number(m.total_points),
      }),
      { merchants: 0, customers: 0, points: 0 }
    );

    res.json({ merchants, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/merchants/:id — update plan and/or disabled flag
router.patch('/merchants/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { plan, disabled } = req.body;
  try {
    const merchant = await db.one('SELECT * FROM merchants WHERE id = $1', [id]);
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

    const newPlan     = plan     !== undefined ? plan     : merchant.plan;
    const newDisabled = disabled !== undefined ? (disabled ? 1 : 0) : merchant.disabled;

    await db.run(
      'UPDATE merchants SET plan = $1, disabled = $2 WHERE id = $3',
      [newPlan, newDisabled, id]
    );

    const updated = await db.one(
      'SELECT id, name, email, color, plan, disabled FROM merchants WHERE id = $1', [id]
    );
    res.json({ merchant: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/merchants/:id — hard delete (memberships/transactions cascade)
router.delete('/merchants/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const merchant = await db.one('SELECT id FROM merchants WHERE id = $1', [id]);
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });
    await db.run('DELETE FROM merchants WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/merchants/:id/customers
router.get('/merchants/:id/customers', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const customers = await db.all(`
      SELECT
        c.id, c.first_name, c.phone, c.qr_code,
        mb.points, mb.joined_at,
        COALESCE(MAX(t.created_at), NULL) AS last_visit
      FROM memberships mb
      JOIN customers c ON c.id = mb.customer_id
      LEFT JOIN transactions t ON t.customer_id = c.id AND t.merchant_id = $1
      WHERE mb.merchant_id = $2
      GROUP BY c.id, c.first_name, c.phone, c.qr_code, mb.points, mb.joined_at
      ORDER BY mb.points DESC
    `, [id, id]);
    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Statistics ────────────────────────────────────────────────────────────────

// GET /api/admin/stats
router.get('/stats', adminAuth, async (req, res) => {
  const since30 = daysAgo(30);
  const since7  = daysAgo(7);
  try {
    const [
      scans_per_day,
      customers_per_day,
      top_merchants_raw,
      inactive_raw,
      { total_scans_today },
    ] = await Promise.all([
      db.all(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM transactions WHERE created_at >= $1
         GROUP BY DATE(created_at) ORDER BY day`,
        [since30]
      ),
      db.all(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM customers WHERE created_at >= $1
         GROUP BY DATE(created_at) ORDER BY day`,
        [since30]
      ),
      db.all(
        `SELECT m.id, m.name, m.color, COUNT(t.id) AS scan_count
         FROM merchants m
         LEFT JOIN transactions t ON t.merchant_id = m.id AND t.created_at >= $1
         GROUP BY m.id, m.name, m.color
         ORDER BY scan_count DESC LIMIT 10`,
        [since30]
      ),
      db.all(
        `SELECT m.id, m.name, m.email, m.color, MAX(t.created_at) AS last_scan
         FROM merchants m
         LEFT JOIN transactions t ON t.merchant_id = m.id
         GROUP BY m.id, m.name, m.email, m.color
         HAVING COALESCE(MAX(t.created_at), '1970-01-01') < $1
         ORDER BY last_scan ASC NULLS FIRST`,
        [since7]
      ),
      db.one(
        `SELECT COUNT(*) AS total_scans_today FROM transactions WHERE ${db.todayExpr}`
      ),
    ]);

    res.json({
      scans_per_day,
      customers_per_day,
      top_merchants: top_merchants_raw.map(m => ({ ...m, scan_count: Number(m.scan_count) })),
      inactive_merchants: inactive_raw,
      scans_today: Number(total_scans_today),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Customers ─────────────────────────────────────────────────────────────────

// GET /api/admin/customers?q=search
router.get('/customers', adminAuth, async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  try {
    const customers = await db.all(`
      SELECT
        c.id, c.first_name, c.phone, c.qr_code, c.created_at,
        COUNT(DISTINCT mb.merchant_id)  AS merchant_count,
        COALESCE(SUM(mb.points), 0)     AS total_points,
        COALESCE(MAX(t.created_at), NULL) AS last_activity
      FROM customers c
      LEFT JOIN memberships mb ON mb.customer_id = c.id
      LEFT JOIN transactions t  ON t.customer_id  = c.id
      WHERE ($1 = '' OR LOWER(c.first_name) LIKE $2 OR c.phone LIKE $3)
      GROUP BY c.id, c.first_name, c.phone, c.qr_code, c.created_at
      ORDER BY COALESCE(MAX(t.created_at), '1970-01-01') DESC
      LIMIT 200
    `, [q, `%${q}%`, `%${q}%`]);

    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/customers/:id/transactions
router.get('/customers/:id/transactions', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const customer = await db.one(
      'SELECT id, first_name, phone, qr_code FROM customers WHERE id = $1', [id]
    );
    if (!customer) return res.status(404).json({ error: 'Client introuvable' });

    const [transactions, blocked_attempts] = await Promise.all([
      db.all(`
        SELECT t.id, t.points, t.created_at, 0 AS blocked,
               m.id AS merchant_id, m.name AS merchant_name, m.color
        FROM transactions t
        JOIN merchants m ON m.id = t.merchant_id
        WHERE t.customer_id = $1
        ORDER BY t.created_at DESC LIMIT 50
      `, [id]),
      db.all(`
        SELECT sa.id, sa.points, sa.created_at, 1 AS blocked,
               m.id AS merchant_id, m.name AS merchant_name, m.color
        FROM scan_attempts sa
        JOIN merchants m ON m.id = sa.merchant_id
        WHERE sa.customer_id = $1 AND sa.blocked = 1
        ORDER BY sa.created_at DESC LIMIT 20
      `, [id]),
    ]);

    // Merge and sort by date
    const history = [...transactions, ...blocked_attempts]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 60);

    res.json({ customer, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fraud ─────────────────────────────────────────────────────────────────────

// GET /api/admin/fraud — customers with 3+ blocked scan attempts in last 24h
router.get('/fraud', adminAuth, async (req, res) => {
  const since = daysAgo(1);
  try {
    const flagged = await db.all(`
      SELECT
        c.id, c.first_name, c.phone,
        COUNT(sa.id)               AS blocked_count,
        COUNT(DISTINCT sa.merchant_id) AS merchant_count,
        MAX(sa.created_at)         AS last_attempt
      FROM scan_attempts sa
      JOIN customers c ON c.id = sa.customer_id
      WHERE sa.blocked = 1 AND sa.created_at >= $1
      GROUP BY c.id, c.first_name, c.phone
      HAVING COUNT(sa.id) >= 3
      ORDER BY COUNT(sa.id) DESC
    `, [since]);

    res.json({ flagged: flagged.map(f => ({ ...f, blocked_count: Number(f.blocked_count), merchant_count: Number(f.merchant_count) })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
