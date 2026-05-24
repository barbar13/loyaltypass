'use strict';
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

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

// ── Merchants ─────────────────────────────────────────────────────────────────

router.patch('/merchants/:id/trial', adminAuth, async (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const days = parseInt(req.body.days, 10) || 7;
  try {
    const merchant = await db.one('SELECT * FROM merchants WHERE id = $1', [id]);
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });
    const base = merchant.trial_ends_at && new Date(merchant.trial_ends_at) > new Date()
      ? new Date(merchant.trial_ends_at)
      : new Date();
    base.setDate(base.getDate() + days);
    await db.run(
      "UPDATE merchants SET trial_ends_at = $1, subscription_status = 'trial' WHERE id = $2",
      [base.toISOString(), id]
    );
    const updated = await db.one('SELECT id, name, subscription_status, trial_ends_at FROM merchants WHERE id = $1', [id]);
    res.json({ merchant: updated });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.get('/merchants', adminAuth, async (req, res) => {
  try {
    const merchants = await db.all(`
      SELECT
        m.id, m.name, m.email, m.color, m.plan, m.disabled, m.created_at,
        m.subscription_status, m.trial_ends_at,
        COUNT(DISTINCT mb.customer_id)  AS customer_count,
        COALESCE(SUM(t.points), 0)      AS total_points,
        MAX(t.created_at)               AS last_activity
      FROM merchants m
      LEFT JOIN memberships mb ON mb.merchant_id = m.id
      LEFT JOIN transactions t  ON t.merchant_id  = m.id
      GROUP BY m.id, m.name, m.email, m.color, m.plan, m.disabled, m.created_at,
               m.subscription_status, m.trial_ends_at
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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/merchants/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { plan, disabled, subscription_status } = req.body;
  try {
    const merchant = await db.one('SELECT * FROM merchants WHERE id = $1', [id]);
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

    const newPlan     = plan                !== undefined ? plan                : merchant.plan;
    const newDisabled = disabled            !== undefined ? (disabled ? 1 : 0)  : merchant.disabled;
    const newStatus   = subscription_status !== undefined ? subscription_status : merchant.subscription_status;

    await db.run(
      'UPDATE merchants SET plan = $1, disabled = $2, subscription_status = $3 WHERE id = $4',
      [newPlan, newDisabled, newStatus, id]
    );
    const updated = await db.one(
      'SELECT id, name, email, color, plan, disabled, subscription_status FROM merchants WHERE id = $1', [id]
    );
    res.json({ merchant: updated });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/merchants/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const merchant = await db.one('SELECT id FROM merchants WHERE id = $1', [id]);
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });
    await db.run('DELETE FROM merchants WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/dashboard', adminAuth, async (req, res) => {
  const since84    = daysAgo(84);
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  try {
    const [statusCounts, newThisMonth, signupRows, feedRows] = await Promise.all([
      db.all('SELECT subscription_status, COUNT(*) AS cnt FROM merchants GROUP BY subscription_status'),
      db.one('SELECT COUNT(*) AS cnt FROM merchants WHERE created_at >= $1', [monthStart]),
      db.all('SELECT created_at FROM merchants WHERE created_at >= $1 ORDER BY created_at', [since84]),
      db.all(`
        SELECT t.created_at, t.points, t.type,
               m.name AS merchant_name, m.color,
               c.first_name AS customer_name
        FROM transactions t
        JOIN merchants m ON m.id = t.merchant_id
        JOIN customers c ON c.id = t.customer_id
        ORDER BY t.created_at DESC
        LIMIT 12
      `),
    ]);

    const counts = {};
    statusCounts.forEach(r => { counts[r.subscription_status] = Number(r.cnt); });
    const active   = counts.active   || 0;
    const trial    = counts.trial    || 0;
    const suspended = counts.suspended || 0;
    const canceled  = counts.canceled  || 0;
    const mrr       = active * 29;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const growth_weeks = Array.from({ length: 12 }, (_, i) => {
      const ws = new Date(today); ws.setDate(today.getDate() - (11 - i) * 7);
      const we = new Date(ws);    we.setDate(ws.getDate() + 7);
      const s  = ws.toISOString().slice(0, 10);
      const e  = we.toISOString().slice(0, 10);
      const count = signupRows.filter(r => {
        const d = String(r.created_at).slice(0, 10);
        return d >= s && d < e;
      }).length;
      return { label: ws.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), count };
    });

    const churnRate = (active + canceled) > 0
      ? Math.round((canceled / (active + canceled)) * 100) : 0;

    res.json({
      kpi: { active, trial, mrr, new_this_month: Number(newThisMonth.cnt), churn_rate: churnRate },
      funnel: { total: active + trial + suspended + canceled, trial, active, suspended, canceled },
      growth_weeks,
      live_feed: feedRows,
    });
  } catch (err) {
    console.error('[admin] dashboard error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Business ──────────────────────────────────────────────────────────────────

router.get('/business', adminAuth, async (req, res) => {
  const since30  = daysAgo(30);
  const since180 = daysAgo(180);
  const in7days  = new Date(Date.now() + 7 * 86400000).toISOString();
  const now = new Date();
  try {
    const [statusCounts, topMerchants, atRisk, signupRows] = await Promise.all([
      db.all('SELECT subscription_status, COUNT(*) AS cnt FROM merchants GROUP BY subscription_status'),
      db.all(`
        SELECT m.id, m.name, m.color, m.email, m.subscription_status,
               COUNT(DISTINCT mb.customer_id) AS customer_count,
               COUNT(t.id)                    AS scan_count
        FROM merchants m
        LEFT JOIN memberships mb ON mb.merchant_id = m.id
        LEFT JOIN transactions t  ON t.merchant_id  = m.id AND t.created_at >= $1
        GROUP BY m.id, m.name, m.color, m.email, m.subscription_status
        ORDER BY scan_count DESC
        LIMIT 10
      `, [since30]),
      db.all(`
        SELECT id, name, email, trial_ends_at, subscription_status
        FROM merchants
        WHERE subscription_status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at <= $1
        ORDER BY trial_ends_at ASC
      `, [in7days]),
      db.all('SELECT created_at, subscription_status FROM merchants WHERE created_at >= $1', [since180]),
    ]);

    const counts = {};
    statusCounts.forEach(r => { counts[r.subscription_status] = Number(r.cnt); });
    const active   = counts.active   || 0;
    const trial    = counts.trial    || 0;
    const canceled = counts.canceled || 0;
    const mrr      = active * 29;
    const arr      = mrr * 12;
    const convRate = (active + trial) > 0 ? Math.round((active / (active + trial)) * 100) : 0;
    const churnRate = (active + canceled) > 0 ? Math.round((canceled / (active + canceled)) * 100) : 0;

    const mrr_evolution = Array.from({ length: 6 }, (_, i) => {
      const d        = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label    = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const activeThen = signupRows.filter(m =>
        String(m.created_at).slice(0, 10) <= monthEnd && m.subscription_status === 'active'
      ).length;
      return { label, mrr: activeThen * 29 };
    });

    res.json({
      mrr, arr, active, trial,
      conversion_rate: convRate,
      churn_rate: churnRate,
      at_risk: atRisk.map(m => ({
        ...m,
        days_left: m.trial_ends_at
          ? Math.max(0, Math.ceil((new Date(m.trial_ends_at) - new Date()) / 86400000))
          : null,
      })),
      top_merchants: topMerchants.map(m => ({
        ...m,
        scan_count: Number(m.scan_count),
        customer_count: Number(m.customer_count),
      })),
      mrr_evolution,
    });
  } catch (err) {
    console.error('[admin] business error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Statistics ────────────────────────────────────────────────────────────────

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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Customers ─────────────────────────────────────────────────────────────────

// Must be registered BEFORE /customers/:id/transactions to avoid route conflict
router.get('/customers/stats', adminAuth, async (req, res) => {
  const since56 = daysAgo(56);
  try {
    const [totalRow, topCustomers, signupRows] = await Promise.all([
      db.one('SELECT COUNT(*) AS cnt FROM customers'),
      db.all(`
        SELECT c.id, c.first_name, c.phone,
               COALESCE(SUM(mb.points), 0)   AS total_points,
               COUNT(DISTINCT mb.merchant_id) AS merchant_count,
               MAX(t.created_at)              AS last_activity
        FROM customers c
        LEFT JOIN memberships mb ON mb.customer_id = c.id
        LEFT JOIN transactions t  ON t.customer_id  = c.id
        GROUP BY c.id, c.first_name, c.phone
        ORDER BY total_points DESC
        LIMIT 10
      `),
      db.all('SELECT created_at FROM customers WHERE created_at >= $1 ORDER BY created_at', [since56]),
    ]);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const new_per_week = Array.from({ length: 8 }, (_, i) => {
      const ws = new Date(today); ws.setDate(today.getDate() - (7 - i) * 7);
      const we = new Date(ws);    we.setDate(ws.getDate() + 7);
      const s  = ws.toISOString().slice(0, 10);
      const e  = we.toISOString().slice(0, 10);
      const count = signupRows.filter(r => {
        const d = String(r.created_at).slice(0, 10);
        return d >= s && d < e;
      }).length;
      return { label: ws.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), count };
    });

    res.json({
      total: Number(totalRow.cnt),
      new_per_week,
      top_customers: topCustomers.map(c => ({
        ...c,
        total_points: Number(c.total_points),
        merchant_count: Number(c.merchant_count),
      })),
    });
  } catch (err) {
    console.error('[admin] customers/stats error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/customers', adminAuth, async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  try {
    const customers = await db.all(`
      SELECT
        c.id, c.first_name, c.phone, c.qr_code, c.created_at,
        COUNT(DISTINCT mb.merchant_id)    AS merchant_count,
        COALESCE(SUM(mb.points), 0)       AS total_points,
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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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

    const history = [...transactions, ...blocked_attempts]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 60);

    res.json({ customer, history });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────

router.get('/analytics', adminAuth, async (req, res) => {
  const since30 = daysAgo(30);
  const since7  = daysAgo(7);
  try {
    const [txRows, redeemRow, merchantCities, atRiskRows] = await Promise.all([
      db.all('SELECT created_at, type FROM transactions WHERE created_at >= $1', [since30]),
      db.one("SELECT COUNT(*) AS cnt FROM transactions WHERE type = 'redeem' AND created_at >= $1", [since30]),
      db.all(`
        SELECT COALESCE(city, 'Inconnue') AS city, COUNT(*) AS cnt
        FROM merchants
        GROUP BY city
        ORDER BY cnt DESC
        LIMIT 15
      `),
      db.all(`
        SELECT m.id, m.name, m.color, MAX(t.created_at) AS last_scan
        FROM merchants m
        LEFT JOIN transactions t ON t.merchant_id = m.id
        GROUP BY m.id, m.name, m.color
        HAVING COALESCE(MAX(t.created_at), '1970-01-01') < $1
        ORDER BY last_scan ASC NULLS FIRST
      `, [since7]),
    ]);

    const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let pointsCount = 0, stampsCount = 0;
    txRows.forEach(tx => {
      const d = new Date(tx.created_at);
      if (!isNaN(d)) {
        heatmap[(d.getDay() + 6) % 7][d.getHours()]++;
      }
      if (tx.type === 'stamps') stampsCount++;
      else if (tx.type !== 'redeem') pointsCount++;
    });

    const totalScans     = pointsCount + stampsCount;
    const redeems        = Number(redeemRow.cnt || 0);
    const redemptionRate = totalScans > 0 ? Math.round((redeems / totalScans) * 100) : 0;

    res.json({
      points_count: pointsCount,
      stamps_count: stampsCount,
      heatmap,
      avg_scans_per_day: totalScans > 0 ? Math.round((totalScans / 30) * 10) / 10 : 0,
      redemption_rate:   redemptionRate,
      city_distribution: merchantCities.map(c => ({ city: c.city, cnt: Number(c.cnt) })),
      at_risk_merchants: atRiskRows,
    });
  } catch (err) {
    console.error('[admin] analytics error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Fraud ─────────────────────────────────────────────────────────────────────

router.get('/fraud', adminAuth, async (req, res) => {
  const since = daysAgo(1);
  try {
    const flagged = await db.all(`
      SELECT
        c.id, c.first_name, c.phone,
        COUNT(sa.id)                   AS blocked_count,
        COUNT(DISTINCT sa.merchant_id) AS merchant_count,
        MAX(sa.created_at)             AS last_attempt
      FROM scan_attempts sa
      JOIN customers c ON c.id = sa.customer_id
      WHERE sa.blocked = 1 AND sa.created_at >= $1
      GROUP BY c.id, c.first_name, c.phone
      HAVING COUNT(sa.id) >= 3
      ORDER BY COUNT(sa.id) DESC
    `, [since]);

    res.json({ flagged: flagged.map(f => ({
      ...f,
      blocked_count:  Number(f.blocked_count),
      merchant_count: Number(f.merchant_count),
    })) });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
