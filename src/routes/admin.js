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

// GET /api/admin/merchants — platform overview
router.get('/merchants', adminAuth, (req, res) => {
  const merchants = db.prepare(`
    SELECT
      m.id, m.name, m.email, m.color, m.plan, m.created_at,
      COUNT(DISTINCT mb.customer_id)    AS customer_count,
      COALESCE(SUM(t.points), 0)        AS total_points,
      MAX(t.created_at)                 AS last_activity
    FROM merchants m
    LEFT JOIN memberships mb ON mb.merchant_id = m.id
    LEFT JOIN transactions t  ON t.merchant_id  = m.id
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `).all();

  const totals = merchants.reduce(
    (acc, m) => ({
      merchants: acc.merchants + 1,
      customers: acc.customers + m.customer_count,
      points:    acc.points    + m.total_points,
    }),
    { merchants: 0, customers: 0, points: 0 }
  );

  res.json({ merchants, totals });
});

module.exports = router;
