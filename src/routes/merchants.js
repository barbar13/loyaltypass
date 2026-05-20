const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const QRCode   = require('qrcode');
const db       = require('../database');
const auth     = require('../middleware/auth');
const email    = require('../email');

const router      = express.Router();
const SALT_ROUNDS = 12;
const JWT_SECRET  = () => process.env.JWT_SECRET  || 'fidevo_dev_secret_change_in_prod';
const JWT_EXPIRES = () => process.env.JWT_EXPIRES_IN || '7d';

// ─── Public: enrollment branding ─────────────────────────────────────────────

router.get('/:id/enroll', async (req, res) => {
  try {
    const merchant = await db.one(
      'SELECT id, name, logo_url, color, plan FROM merchants WHERE id = $1',
      [req.params.id]
    );
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });
    res.json({ merchant });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

router.get('/:id/enroll-qr', async (req, res) => {
  try {
    const merchant = await db.one('SELECT id, name FROM merchants WHERE id = $1', [req.params.id]);
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

    const baseUrl   = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const enrollUrl = `${baseUrl}/enroll/${merchant.id}`;

    const size = Math.min(parseInt(req.query.size, 10) || 400, 800);
    const buf = await QRCode.toBuffer(enrollUrl, {
      width: size, margin: 2, errorCorrectionLevel: 'M',
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

  try {
    const existing = await db.one('SELECT id FROM merchants WHERE email = $1', [email]);
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const id = await db.insert(
      'INSERT INTO merchants (name, email, password, logo_url, color, plan) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, email, hashed, logo_url || null, color || '#6366f1', plan || 'free']
    );

    const merchant = await db.one(
      'SELECT id, name, email, logo_url, color, plan, created_at FROM merchants WHERE id = $1',
      [id]
    );

    const token = jwt.sign(
      { id: merchant.id, email: merchant.email },
      JWT_SECRET(),
      { expiresIn: JWT_EXPIRES() }
    );

    // Welcome email (fire-and-forget)
    const baseUrl   = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    email.sendWelcome({
      to: merchant.email,
      merchantName: merchant.name,
      enrollUrl:    `${baseUrl}/enroll/${merchant.id}`,
      dashboardUrl: `${baseUrl}/`,
    }).catch(() => {});

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

  try {
    const merchant = await db.one('SELECT * FROM merchants WHERE email = $1', [email]);
    if (!merchant) return res.status(401).json({ error: 'Identifiants invalides' });

    if (merchant.disabled) {
      return res.status(403).json({ error: 'Compte désactivé. Contactez le support.' });
    }

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

router.get('/dashboard', auth, async (req, res) => {
  const merchantId = req.merchant.id;
  try {
    const merchant = await db.one(
      'SELECT id, name, email, logo_url, color, plan FROM merchants WHERE id = $1',
      [merchantId]
    );
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

    const [{ total_customers }, { total_points }, { scans_today }] = await Promise.all([
      db.one('SELECT COUNT(*) as total_customers FROM memberships WHERE merchant_id = $1', [merchantId]),
      db.one('SELECT COALESCE(SUM(points), 0) as total_points FROM transactions WHERE merchant_id = $1', [merchantId]),
      db.one(`SELECT COUNT(*) as scans_today FROM transactions WHERE merchant_id = $1 AND ${db.todayExpr}`, [merchantId]),
    ]);

    const [customers, rewards] = await Promise.all([
      db.all(`
        SELECT
          c.id, c.first_name, c.phone, c.qr_code,
          mb.id AS membership_id, mb.points, mb.joined_at,
          (SELECT MAX(t.created_at) FROM transactions t
           WHERE t.merchant_id = $1 AND t.customer_id = c.id) AS last_visit
        FROM memberships mb
        JOIN customers c ON c.id = mb.customer_id
        WHERE mb.merchant_id = $2
        ORDER BY mb.points DESC
        LIMIT 100
      `, [merchantId, merchantId]),
      db.all(
        'SELECT * FROM rewards WHERE merchant_id = $1 ORDER BY points_required ASC',
        [merchantId]
      ),
    ]);

    res.json({
      merchant,
      stats: {
        total_customers: Number(total_customers),
        total_points:    Number(total_points),
        scans_today:     Number(scans_today),
      },
      customers,
      rewards,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── Authenticated: rewards ───────────────────────────────────────────────────

router.post('/rewards', auth, async (req, res) => {
  const { description, points_required } = req.body;
  const merchantId = req.merchant.id;

  if (!description || !points_required) {
    return res.status(400).json({ error: 'description et points_required sont requis' });
  }
  const pts = parseInt(points_required, 10);
  if (isNaN(pts) || pts <= 0) {
    return res.status(400).json({ error: 'points_required doit être un entier positif' });
  }

  try {
    const id = await db.insert(
      'INSERT INTO rewards (merchant_id, description, points_required) VALUES ($1, $2, $3)',
      [merchantId, description.trim(), pts]
    );
    const reward = await db.one('SELECT * FROM rewards WHERE id = $1', [id]);
    res.status(201).json({ reward });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

router.delete('/rewards/:id', auth, async (req, res) => {
  const rewardId = parseInt(req.params.id, 10);
  try {
    const reward = await db.one('SELECT * FROM rewards WHERE id = $1', [rewardId]);
    if (!reward) return res.status(404).json({ error: 'Récompense introuvable' });
    if (reward.merchant_id !== req.merchant.id) return res.status(403).json({ error: 'Accès refusé' });

    await db.run('UPDATE rewards SET active = 0 WHERE id = $1', [rewardId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// ─── Forgot / reset password ──────────────────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  const { email: addr } = req.body;
  if (!addr) return res.status(400).json({ error: 'email est requis' });
  // Always return the same message (security: don't reveal if email exists)
  const MSG = { message: 'Si cet email est enregistré, vous recevrez un lien sous peu.' };
  try {
    const merchant = await db.one('SELECT * FROM merchants WHERE email = $1', [addr.trim().toLowerCase()]);
    if (!merchant) return res.json(MSG);

    const token  = crypto.randomBytes(32).toString('hex');
    const exp    = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 h
    await db.run('UPDATE merchants SET reset_token = $1, reset_token_exp = $2 WHERE id = $3', [token, exp, merchant.id]);

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    email.sendForgotPassword({
      to: merchant.email,
      merchantName: merchant.name,
      resetUrl: `${baseUrl}/reset-password?token=${token}`,
    }).catch(() => {});

    res.json(MSG);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token et password sont requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Minimum 6 caractères' });
  try {
    const merchant = await db.one(
      'SELECT * FROM merchants WHERE reset_token = $1 AND reset_token_exp > $2',
      [token, new Date().toISOString()]
    );
    if (!merchant) return res.status(400).json({ error: 'Lien invalide ou expiré. Veuillez recommencer.' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await db.run(
      'UPDATE merchants SET password = $1, reset_token = NULL, reset_token_exp = NULL WHERE id = $2',
      [hashed, merchant.id]
    );
    res.json({ message: 'Mot de passe mis à jour.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Profile edit ─────────────────────────────────────────────────────────────

router.post('/profile', auth, async (req, res) => {
  const { name, color, password } = req.body;
  const merchantId = req.merchant.id;
  try {
    const sets   = [];
    const params = [];
    if (name)  { params.push(name.trim());  sets.push(`name  = $${params.length}`); }
    if (color) { params.push(color);        sets.push(`color = $${params.length}`); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Minimum 6 caractères' });
      params.push(await bcrypt.hash(password, SALT_ROUNDS));
      sets.push(`password = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Rien à mettre à jour' });
    params.push(merchantId);
    await db.run(`UPDATE merchants SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    const updated = await db.one(
      'SELECT id, name, email, logo_url, color, plan FROM merchants WHERE id = $1', [merchantId]
    );
    res.json({ merchant: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Scan history ─────────────────────────────────────────────────────────────

router.get('/scans', auth, async (req, res) => {
  const merchantId = req.merchant.id;
  const { date_from, date_to } = req.query;
  try {
    const params = [merchantId];
    let where = 'WHERE t.merchant_id = $1';
    if (date_from) { params.push(date_from); where += ` AND DATE(t.created_at) >= $${params.length}`; }
    if (date_to)   { params.push(date_to);   where += ` AND DATE(t.created_at) <= $${params.length}`; }

    const scans = await db.all(`
      SELECT t.id, t.points, t.note, t.created_at,
             c.id AS customer_id, c.first_name, c.phone
      FROM transactions t
      JOIN customers c ON c.id = t.customer_id
      ${where}
      ORDER BY t.created_at DESC
      LIMIT 500
    `, params);

    res.json({ scans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
