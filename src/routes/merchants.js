const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const QRCode   = require('qrcode');
const db       = require('../database');
const auth     = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

// ─── Public: enrollment info ──────────────────────────────────────────────────

// GET /api/merchants/:id/enroll — merchant branding for the enrollment page
router.get('/:id/enroll', (req, res) => {
  const merchant = db.prepare(
    'SELECT id, name, logo_url, color, plan FROM merchants WHERE id = ?'
  ).get(req.params.id);
  if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });
  res.json({ merchant });
});

// GET /api/merchants/:id/enroll-qr — QR code PNG of the enrollment URL (public)
router.get('/:id/enroll-qr', async (req, res) => {
  const merchant = db.prepare('SELECT id, name FROM merchants WHERE id = ?').get(req.params.id);
  if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

  const baseUrl   = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const enrollUrl = `${baseUrl}/enroll/${merchant.id}`;

  try {
    const buf = await QRCode.toBuffer(enrollUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: 'Erreur génération QR', detail: err.message });
  }
});

// ─── Auth routes ──────────────────────────────────────────────────────────────

// POST /api/merchants/register
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
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({ merchant, token });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// POST /api/merchants/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email et password sont requis' });
  }

  const merchant = db.prepare('SELECT * FROM merchants WHERE email = ?').get(email);
  if (!merchant) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  try {
    const match = await bcrypt.compare(password, merchant.password);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const { password: _, ...merchantSafe } = merchant;
    const token = jwt.sign(
      { id: merchant.id, email: merchant.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ merchant: merchantSafe, token });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// GET /api/merchants/:id/stats
router.get('/:id/stats', auth, (req, res) => {
  const merchantId = parseInt(req.params.id, 10);

  if (req.merchant.id !== merchantId) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const merchant = db.prepare(
    'SELECT id, name, email, logo_url, color, plan FROM merchants WHERE id = ?'
  ).get(merchantId);

  if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

  const { total_customers } = db.prepare(`
    SELECT COUNT(DISTINCT customer_id) AS total_customers FROM cards WHERE merchant_id = ?
  `).get(merchantId);

  const { total_cards } = db.prepare(`
    SELECT COUNT(*) AS total_cards FROM cards WHERE merchant_id = ?
  `).get(merchantId);

  const { total_points } = db.prepare(`
    SELECT COALESCE(SUM(t.points_added), 0) AS total_points
    FROM transactions t JOIN cards c ON c.id = t.card_id
    WHERE c.merchant_id = ?
  `).get(merchantId);

  const top_customers = db.prepare(`
    SELECT cu.id, cu.first_name, cu.phone, cu.email, c.points, c.qr_code
    FROM cards c JOIN customers cu ON cu.id = c.customer_id
    WHERE c.merchant_id = ?
    ORDER BY c.points DESC LIMIT 5
  `).all(merchantId);

  res.json({ merchant, stats: { total_customers, total_cards, total_points, top_customers } });
});

module.exports = router;
