const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const QRCode   = require('qrcode');
const db       = require('../database');
const auth     = require('../middleware/auth');

const router      = express.Router();
const SALT_ROUNDS = 12;
const JWT_SECRET  = () => process.env.JWT_SECRET  || 'loyaltypass_dev_secret_change_in_prod';
const JWT_EXPIRES = () => process.env.JWT_EXPIRES_IN || '7d';

// ─── Public: enrollment branding ─────────────────────────────────────────────

router.get('/:id/enroll', (req, res) => {
  const merchant = db.prepare(
    'SELECT id, name, logo_url, color, plan FROM merchants WHERE id = ?'
  ).get(req.params.id);
  if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });
  res.json({ merchant });
});

router.get('/:id/enroll-qr', async (req, res) => {
  const merchant = db.prepare('SELECT id, name FROM merchants WHERE id = ?').get(req.params.id);
  if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

  const baseUrl   = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const enrollUrl = `${baseUrl}/enroll/${merchant.id}`;

  try {
    const buf = await QRCode.toBuffer(enrollUrl, {
      width: 400, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: 'Erreur génération QR', detail: err.message });
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { name, email, password, logo_url, color, plan } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email et password sont requis' });
  }

  const existing = db.prepare('SELECT id FROM merchants WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }

  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db.prepare(`
      INSERT INTO merchants (name, email, password, logo_url, color, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email, hashed, logo_url || null, color || '#6366f1', plan || 'free');

    const merchant = db.prepare(
      'SELECT id, name, email, logo_url, color, plan, created_at FROM merchants WHERE id = ?'
    ).get(result.lastInsertRowid);

    const token = jwt.sign(
      { id: merchant.id, email: merchant.email },
      JWT_SECRET(),
      { expiresIn: JWT_EXPIRES() }
    );

    res.status(201).json({ merchant, token });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email et password sont requis' });
  }

  const merchant = db.prepare('SELECT * FROM merchants WHERE email = ?').get(email);
  if (!merchant) return res.status(401).json({ error: 'Identifiants invalides' });

  try {
    const match = await bcrypt.compare(password, merchant.password);
    if (!match) return res.status(401).json({ error: 'Identifiants invalides' });

    const { password: _, ...merchantSafe } = merchant;
    const token = jwt.sign(
      { id: merchant.id, email: merchant.email },
      JWT_SECRET(),
      { expiresIn: JWT_EXPIRES() }
    );

    res.json({ merchant: merchantSafe, token });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── Authenticated: dashboard ─────────────────────────────────────────────────

router.get('/dashboard', auth, (req, res) => {
  const merchantId = req.merchant.id;

  const merchant = db.prepare(
    'SELECT id, name, email, logo_url, color, plan FROM merchants WHERE id = ?'
  ).get(merchantId);
  if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

  const { total_customers } = db.prepare(
    'SELECT COUNT(*) as total_customers FROM memberships WHERE merchant_id = ?'
  ).get(merchantId);

  const { total_points } = db.prepare(
    'SELECT COALESCE(SUM(points), 0) as total_points FROM transactions WHERE merchant_id = ?'
  ).get(merchantId);

  const { scans_today } = db.prepare(`
    SELECT COUNT(*) as scans_today FROM transactions
    WHERE merchant_id = ? AND DATE(created_at) = DATE('now', 'localtime')
  `).get(merchantId);

  const customers = db.prepare(`
    SELECT
      c.id, c.first_name, c.phone, c.qr_code,
      mb.points, mb.joined_at,
      (SELECT MAX(t.created_at) FROM transactions t
       WHERE t.merchant_id = ? AND t.customer_id = c.id) as last_visit
    FROM memberships mb
    JOIN customers c ON c.id = mb.customer_id
    WHERE mb.merchant_id = ?
    ORDER BY mb.points DESC
    LIMIT 100
  `).all(merchantId, merchantId);

  const rewards = db.prepare(
    'SELECT * FROM rewards WHERE merchant_id = ? ORDER BY points_required ASC'
  ).all(merchantId);

  res.json({
    merchant,
    stats: { total_customers, total_points, scans_today },
    customers,
    rewards,
  });
});

// ─── Authenticated: rewards ───────────────────────────────────────────────────

router.post('/rewards', auth, (req, res) => {
  const { description, points_required } = req.body;
  const merchantId = req.merchant.id;

  if (!description || !points_required) {
    return res.status(400).json({ error: 'description et points_required sont requis' });
  }
  const pts = parseInt(points_required, 10);
  if (isNaN(pts) || pts <= 0) {
    return res.status(400).json({ error: 'points_required doit être un entier positif' });
  }

  const result = db.prepare(
    'INSERT INTO rewards (merchant_id, description, points_required) VALUES (?, ?, ?)'
  ).run(merchantId, description.trim(), pts);

  const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ reward });
});

router.delete('/rewards/:id', auth, (req, res) => {
  const rewardId = parseInt(req.params.id, 10);
  const reward   = db.prepare('SELECT * FROM rewards WHERE id = ?').get(rewardId);
  if (!reward) return res.status(404).json({ error: 'Récompense introuvable' });
  if (reward.merchant_id !== req.merchant.id) return res.status(403).json({ error: 'Accès refusé' });

  db.prepare('UPDATE rewards SET active = 0 WHERE id = ?').run(rewardId);
  res.json({ success: true });
});

module.exports = router;
