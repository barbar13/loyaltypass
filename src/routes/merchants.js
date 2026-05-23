const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const QRCode   = require('qrcode');
const db       = require('../database');
const auth     = require('../middleware/auth');
const email    = require('../email');
const { sendToMerchantAudience } = require('./notifications');

const router      = express.Router();
const SALT_ROUNDS = 12;
const JWT_SECRET  = () => process.env.JWT_SECRET  || 'fidelyzio_dev_secret_change_in_prod';
const JWT_EXPIRES = () => process.env.JWT_EXPIRES_IN || '90d';

// ─── Public: nearby merchants ─────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get('/nearby', async (req, res) => {
  const { lat, lng, radius, city } = req.query;
  try {
    if (city) {
      const merchants = await db.all(
        `SELECT id, name, business_type, color, city
         FROM merchants
         WHERE subscription_status IN ('active', 'trial')
           AND (disabled IS NULL OR disabled = 0)
           AND city IS NOT NULL
           AND LOWER(city) LIKE $1
         ORDER BY name LIMIT 20`,
        [`%${city.trim().toLowerCase()}%`]
      );
      return res.json({ merchants });
    }

    if (!lat || !lng) return res.status(400).json({ error: 'lat et lng ou city requis' });
    const latN = parseFloat(lat), lngN = parseFloat(lng);
    const radiusKm = Math.min(parseFloat(radius) || 10, 100);
    if (isNaN(latN) || isNaN(lngN)) return res.status(400).json({ error: 'Coordonnées invalides' });

    const all = await db.all(
      `SELECT id, name, business_type, color, city, lat, lng
       FROM merchants
       WHERE subscription_status IN ('active', 'trial')
         AND (disabled IS NULL OR disabled = 0)
         AND lat IS NOT NULL AND lng IS NOT NULL`,
      []
    );

    const nearby = all
      .map(m => ({ ...m, distance_km: Math.round(haversineKm(latN, lngN, m.lat, m.lng) * 10) / 10 }))
      .filter(m => m.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 20);

    res.json({ merchants: nearby });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  // Rename destructured `email` to `merchantEmail` to avoid shadowing the email module
  const { name, email: merchantEmail, password, logo_url, color, plan, business_type } = req.body;

  if (!name || !merchantEmail || !password) {
    return res.status(400).json({ error: 'name, email et password sont requis' });
  }

  try {
    const existing = await db.one('SELECT id FROM merchants WHERE email = $1', [merchantEmail]);
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    // Stamps mechanic for café/epicerie types; points for everything else
    const defaultMechanic = ['cafe', 'epicerie'].includes(business_type) ? 'stamps' : 'points';
    const id = await db.insert(
      'INSERT INTO merchants (name, email, password, logo_url, color, plan, business_type, loyalty_mechanic, trial_ends_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [name, merchantEmail, hashed, logo_url || null, color || '#6366f1', plan || 'free', business_type || null, defaultMechanic, trialEndsAt]
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
      dashboardUrl: `${baseUrl}/scanner`,
    }).catch(() => {});

    res.status(201).json({ merchant, token });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email: merchantEmail, password } = req.body;

  if (!merchantEmail || !password) {
    return res.status(400).json({ error: 'email et password sont requis' });
  }

  try {
    const merchant = await db.one('SELECT * FROM merchants WHERE email = $1', [merchantEmail]);
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
      `SELECT id, name, email, logo_url, color, plan,
              subscription_status, trial_ends_at, trial_reminder_sent,
              stripe_customer_id, business_type, loyalty_mechanic
       FROM merchants WHERE id = $1`,
      [merchantId]
    );
    if (!merchant) return res.status(404).json({ error: 'Marchand introuvable' });

    // Auto-expire trial
    if (merchant.subscription_status === 'trial' && merchant.trial_ends_at) {
      if (new Date(merchant.trial_ends_at) < new Date()) {
        await db.run("UPDATE merchants SET subscription_status = 'suspended' WHERE id = $1", [merchantId]);
        merchant.subscription_status = 'suspended';
      } else {
        // Trial reminder emails at J-3 and J-1
        const daysLeft  = Math.ceil((new Date(merchant.trial_ends_at) - new Date()) / 86400000);
        const reminded  = merchant.trial_reminder_sent || '';
        const baseUrl   = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const subUrl    = `${baseUrl}/subscribe`;
        if (daysLeft <= 3 && daysLeft > 1 && !reminded.includes('3d')) {
          email.sendTrialReminder({ to: merchant.email, merchantName: merchant.name, daysLeft, subscribeUrl: subUrl }).catch(() => {});
          db.run("UPDATE merchants SET trial_reminder_sent = $1 WHERE id = $2", [reminded + ',3d', merchantId]).catch(() => {});
        } else if (daysLeft <= 1 && daysLeft >= 0 && !reminded.includes('1d')) {
          email.sendTrialReminder({ to: merchant.email, merchantName: merchant.name, daysLeft, subscribeUrl: subUrl }).catch(() => {});
          db.run("UPDATE merchants SET trial_reminder_sent = $1 WHERE id = $2", [reminded + ',1d', merchantId]).catch(() => {});
        }
      }
    }

    const [{ total_customers }, { total_points }, { scans_today }] = await Promise.all([
      db.one('SELECT COUNT(*) as total_customers FROM memberships WHERE merchant_id = $1', [merchantId]),
      db.one('SELECT COALESCE(SUM(points), 0) as total_points FROM transactions WHERE merchant_id = $1', [merchantId]),
      db.one(`SELECT COUNT(*) as scans_today FROM transactions WHERE merchant_id = $1 AND points > 0 AND ${db.todayExpr}`, [merchantId]),
    ]);

    const [customers, rewards] = await Promise.all([
      db.all(`
        SELECT
          c.id, c.first_name, c.phone, c.email, c.qr_code,
          mb.id AS membership_id, mb.points, mb.stamps_count, mb.joined_at,
          (SELECT MAX(t.created_at) FROM transactions t
           WHERE t.merchant_id = $1 AND t.customer_id = c.id AND t.points > 0) AS last_visit,
          (SELECT COUNT(*) FROM transactions t
           WHERE t.merchant_id = $1 AND t.customer_id = c.id AND t.points > 0) AS visit_count
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

    const trialDaysLeft = merchant.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(merchant.trial_ends_at) - new Date()) / 86400000))
      : null;

    res.json({
      merchant: {
        id: merchant.id, name: merchant.name, email: merchant.email,
        logo_url: merchant.logo_url, color: merchant.color, plan: merchant.plan,
        subscription_status: merchant.subscription_status,
        trial_days_left: trialDaysLeft,
        has_stripe: !!merchant.stripe_customer_id,
        business_type:    merchant.business_type    || null,
        loyalty_mechanic: merchant.loyalty_mechanic || 'points',
      },
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
  const { description, points_required, mechanic = 'points' } = req.body;
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
      'INSERT INTO rewards (merchant_id, description, points_required, mechanic) VALUES ($1, $2, $3, $4)',
      [merchantId, description.trim(), pts, ['points','stamps'].includes(mechanic) ? mechanic : 'points']
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
  const { name, color, password, loyalty_mechanic } = req.body;
  const merchantId = req.merchant.id;
  try {
    const sets   = [];
    const params = [];
    if (name)  { params.push(name.trim());  sets.push(`name  = $${params.length}`); }
    if (color) { params.push(color);        sets.push(`color = $${params.length}`); }
    if (loyalty_mechanic && ['points', 'stamps'].includes(loyalty_mechanic)) {
      params.push(loyalty_mechanic);
      sets.push(`loyalty_mechanic = $${params.length}`);
    }
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
  const { date_from, date_to, customer_id } = req.query;
  try {
    const params = [merchantId];
    let where = 'WHERE t.merchant_id = $1';
    if (date_from)   { params.push(date_from);              where += ` AND DATE(t.created_at) >= $${params.length}`; }
    if (date_to)     { params.push(date_to);                where += ` AND DATE(t.created_at) <= $${params.length}`; }
    if (customer_id) { params.push(parseInt(customer_id, 10)); where += ` AND t.customer_id = $${params.length}`; }

    const scans = await db.all(`
      SELECT t.id, t.points, t.type, t.note, t.created_at,
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

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get('/analytics', auth, async (req, res) => {
  const merchantId = req.merchant.id;
  try {
    const now = Date.now();

    // ── Date range from query params (defaults: last 30 days) ─────────────
    const tsFrom = req.query.date_from
      ? new Date(req.query.date_from + 'T00:00:00Z').getTime()
      : now - 30 * 86400000;
    const tsTo = req.query.date_to
      ? new Date(req.query.date_to   + 'T23:59:59Z').getTime()
      : now;

    // Always-relative boundaries (for weekly KPI cards, never changes)
    const ts7  = now - 7  * 86400000;
    const ts14 = now - 14 * 86400000;
    const nowDate = new Date();
    const tsMonthStart     = new Date(nowDate.getFullYear(), nowDate.getMonth(),     1).getTime();
    const tsLastMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1).getTime();

    // Convert any DB timestamp (Date object from pg, or "YYYY-MM-DD HH:MM:SS" string from SQLite)
    // to milliseconds. All JS comparisons use toTs() to stay DB-agnostic.
    function toTs(val) {
      if (!val) return null;
      if (val instanceof Date) return val.getTime();
      const s = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s))
        return new Date(s.replace(' ', 'T') + 'Z').getTime();
      return new Date(s).getTime();
    }
    function toDateStr(val) {
      if (!val) return null;
      if (val instanceof Date) return val.toISOString().slice(0, 10);
      return String(val).slice(0, 10);
    }

    const [memberships, allTxns] = await Promise.all([
      db.all(`
        SELECT mb.customer_id, mb.points, mb.joined_at,
               c.first_name, c.phone,
               MAX(CASE WHEN t.points > 0 THEN t.created_at END) AS last_visit,
               COUNT(CASE WHEN t.points > 0 THEN 1 END)          AS visit_count
        FROM memberships mb
        JOIN customers c ON c.id = mb.customer_id
        LEFT JOIN transactions t
          ON t.merchant_id = mb.merchant_id AND t.customer_id = mb.customer_id
        WHERE mb.merchant_id = $1
        GROUP BY mb.customer_id, mb.points, mb.joined_at, c.first_name, c.phone
      `, [merchantId]),
      db.all(
        'SELECT id, customer_id, points, type, note, created_at FROM transactions WHERE merchant_id = $1 ORDER BY created_at',
        [merchantId]
      ),
    ]);

    console.log(`[Analytics] merchant=${merchantId} period=${new Date(tsFrom).toISOString().slice(0,10)}→${new Date(tsTo).toISOString().slice(0,10)} memberships=${memberships.length} txns=${allTxns.length}`);

    // ── Split transactions by period / all-time / positive / redemptions ──
    const allPosTxns   = allTxns.filter(t => t.points > 0);
    const allRedeems   = allTxns.filter(t => t.points < 0);

    // Transactions within the selected period
    const periodTxns    = allTxns.filter(t => { const ts = toTs(t.created_at); return ts >= tsFrom && ts <= tsTo; });
    const periodPosTxns = periodTxns.filter(t => t.points > 0);
    const periodRedeems = periodTxns.filter(t => t.points < 0);

    // ── Customer analysis (period-scoped) ─────────────────────────────────
    const activeCustomers   = memberships.filter(m => { const ts = toTs(m.last_visit); return ts !== null && ts >= tsFrom && ts <= tsTo; });
    const inactiveCustomers = memberships.filter(m => { const ts = toTs(m.last_visit); return ts === null || ts < tsFrom || ts > tsTo; });
    const avgVisitFreq = activeCustomers.length > 0
      ? Math.round((periodPosTxns.length / activeCustomers.length) * 10) / 10 : 0;

    const topCustomers = memberships
      .map(m => ({ first_name: m.first_name, phone: m.phone, points: Number(m.points),
                   visit_count: Number(m.visit_count), last_visit: m.last_visit }))
      .sort((a, b) => b.points - a.points).slice(0, 50);

    const lostCustomers = inactiveCustomers
      .sort((a, b) => (toTs(a.last_visit) || 0) - (toTs(b.last_visit) || 0)).slice(0, 20)
      .map(m => ({ first_name: m.first_name, phone: m.phone, points: Number(m.points), last_visit: m.last_visit }));

    // New customers in period and weekly (always last 7d)
    const newInPeriod = memberships.filter(m => { const ts = toTs(m.joined_at); return ts >= tsFrom && ts <= tsTo; }).length;
    const newThisWeek = memberships.filter(m => toTs(m.joined_at) >= ts7).length;
    const newLastWeek = memberships.filter(m => { const ts = toTs(m.joined_at); return ts >= ts14 && ts < ts7; }).length;

    // ── Scans per day (one slot per day in the selected period) ───────────
    const periodDays  = Math.max(1, Math.ceil((tsTo - tsFrom) / 86400000));
    const scansDayMap = {};
    periodPosTxns.forEach(t => {
      const d = toDateStr(t.created_at);
      if (d) scansDayMap[d] = (scansDayMap[d] || 0) + 1;
    });
    const scansPerDay = [];
    for (let i = 0; i < periodDays; i++) {
      const day = new Date(tsFrom + i * 86400000).toISOString().slice(0, 10);
      scansPerDay.push({ day, count: scansDayMap[day] || 0 });
    }

    // Weekday + hour distribution within period
    const scansByWeekday = Array(7).fill(0);
    periodPosTxns.forEach(t => { const ts = toTs(t.created_at); if (ts) scansByWeekday[(new Date(ts).getUTCDay() + 6) % 7]++; });

    const scansByHour = Array(24).fill(0);
    periodPosTxns.forEach(t => { const ts = toTs(t.created_at); if (ts) scansByHour[new Date(ts).getUTCHours()]++; });

    // ── Month comparisons (always calendar months, independent of range) ──
    const thisMonthScans     = allPosTxns.filter(t => toTs(t.created_at) >= tsMonthStart).length;
    const lastMonthScans     = allPosTxns.filter(t => { const ts = toTs(t.created_at); return ts >= tsLastMonthStart && ts < tsMonthStart; }).length;
    const thisMonthCustomers = memberships.filter(m => toTs(m.joined_at) >= tsMonthStart).length;
    const lastMonthCustomers = memberships.filter(m => { const ts = toTs(m.joined_at); return ts >= tsLastMonthStart && ts < tsMonthStart; }).length;

    // ── Rewards analysis (period-scoped) ─────────────────────────────────
    const totalPointsDistrib  = periodPosTxns.filter(t => (t.type || 'points') === 'points').reduce((s, t) => s + t.points, 0);
    const totalPointsRedeemed = periodRedeems.filter(t => (t.type || 'points') === 'points').reduce((s, t) => s + Math.abs(t.points), 0);
    const totalStampsDistrib  = periodPosTxns.filter(t => t.type === 'stamps').length;
    const totalStampsRedeemed = periodRedeems.filter(t => t.type === 'stamps').length;
    const customersWhoRedeemed = new Set(allRedeems.map(r => r.customer_id));
    const redemptionRate = memberships.length > 0
      ? Math.round((customersWhoRedeemed.size / memberships.length) * 100) : 0;

    const rewardCounts = {};
    periodRedeems.forEach(t => {
      const k = (t.note || '').replace(/^Récompense\s*:\s*/i, '').trim() || 'Inconnu';
      rewardCounts[k] = (rewardCounts[k] || 0) + 1;
    });
    const mostPopularReward = Object.keys(rewardCounts).sort((a, b) => rewardCounts[b] - rewardCounts[a])[0] || null;

    let avgPointsBeforeFirstRedemption = 0;
    if (allRedeems.length > 0) {
      const firstRedeemTs = {};
      allRedeems.forEach(r => {
        const ts = toTs(r.created_at);
        if (ts && (!firstRedeemTs[r.customer_id] || ts < firstRedeemTs[r.customer_id]))
          firstRedeemTs[r.customer_id] = ts;
      });
      const vals = Object.entries(firstRedeemTs).map(([cid, redeemTs]) =>
        allTxns.filter(t => String(t.customer_id) === cid && t.points > 0 && toTs(t.created_at) < redeemTs)
               .reduce((s, t) => s + t.points, 0)
      );
      if (vals.length > 0)
        avgPointsBeforeFirstRedemption = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    // ── Business indicators ───────────────────────────────────────────────
    const returnCustomers = memberships.filter(m => Number(m.visit_count) > 1).length;
    const retentionRate   = memberships.length > 0
      ? Math.round((returnCustomers / memberships.length) * 100) : 0;

    // Weekly new customers within period (up to 12 weeks, backwards from tsTo)
    const numWeeks = Math.min(12, Math.max(1, Math.ceil(periodDays / 7)));
    const cumulativeCustomers = [];
    for (let i = numWeeks; i >= 0; i--) {
      const wEndTs = tsTo - i * 7 * 86400000;
      const label  = new Date(wEndTs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      cumulativeCustomers.push({ label, count: memberships.filter(m => { const ts = toTs(m.joined_at); return ts !== null && ts <= wEndTs; }).length });
    }

    const loyaltyScores = memberships.filter(m => Number(m.visit_count) > 0)
      .map(m => Number(m.points) / Number(m.visit_count));
    const avgLoyaltyScore = loyaltyScores.length > 0
      ? Math.round(loyaltyScores.reduce((a, b) => a + b, 0) / loyaltyScores.length) : 0;

    const weeklyScans       = allPosTxns.filter(t => toTs(t.created_at) >= ts7).length;
    const weeklyRedemptions = allRedeems.filter(t => toTs(t.created_at) >= ts7).length;

    console.log(`[Analytics] active=${activeCustomers.length} inactive=${inactiveCustomers.length} periodScans=${periodPosTxns.length} thisMonth=${thisMonthScans}`);

    res.json({
      // Period metadata so the frontend can display the label
      date_from: new Date(tsFrom).toISOString().slice(0, 10),
      date_to:   new Date(tsTo).toISOString().slice(0, 10),
      period_days: periodDays,

      // Period-scoped metrics
      active_customers:    activeCustomers.length,
      inactive_customers:  inactiveCustomers.length,
      avg_visit_frequency: avgVisitFreq,
      new_customers_in_period: newInPeriod,
      top_customers:       topCustomers,
      lost_customers:      lostCustomers,
      scans_per_day:       scansPerDay,
      scans_by_weekday:    scansByWeekday,
      scans_by_hour:       scansByHour,
      total_points_distributed: totalPointsDistrib,
      total_points_redeemed:    totalPointsRedeemed,
      total_stamps_distributed: totalStampsDistrib,
      total_stamps_redeemed:    totalStampsRedeemed,
      total_redeemed:           periodRedeems.length,
      redemption_rate:          redemptionRate,
      most_popular_reward:      mostPopularReward,
      avg_points_before_first_redemption: avgPointsBeforeFirstRedemption,

      // Calendar-month comparisons (independent of date range)
      new_customers_this_week: newThisWeek,
      new_customers_last_week: newLastWeek,
      this_month_scans:    thisMonthScans,
      last_month_scans:    lastMonthScans,
      this_month_customers: thisMonthCustomers,
      last_month_customers: lastMonthCustomers,

      // All-time / snapshot metrics
      retention_rate:       retentionRate,
      cumulative_customers: cumulativeCustomers,
      avg_loyalty_score:    avgLoyaltyScore,
      weekly_new_customers: newThisWeek,
      weekly_scans:         weeklyScans,
      weekly_redemptions:   weeklyRedemptions,
    });
  } catch (err) {
    console.error('[Analytics] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Push notifications ───────────────────────────────────────────────────────

// POST /api/merchants/notify — send a manual push notification to an audience
router.post('/notify', auth, async (req, res) => {
  const merchantId = req.merchant.id;
  const { title, body, audience = 'all' } = req.body;

  if (!title?.trim() || !body?.trim())
    return res.status(400).json({ error: 'title et body sont requis' });
  if (title.length > 50)
    return res.status(400).json({ error: 'title max 50 caractères' });
  if (body.length > 150)
    return res.status(400).json({ error: 'body max 150 caractères' });
  if (!['all', 'inactive', 'near_reward'].includes(audience))
    return res.status(400).json({ error: 'audience invalide' });

  const result = await sendToMerchantAudience(merchantId, audience, title.trim(), body.trim());
  if (result.error && !process.env.VAPID_PUBLIC_KEY)
    return res.status(503).json({ error: result.error });

  res.json({ sent: result.sent ?? 0 });
});

// GET /api/merchants/notifications — history of sent notifications
router.get('/notifications', auth, async (req, res) => {
  const merchantId = req.merchant.id;
  try {
    const notifications = await db.all(
      'SELECT id, title, body, audience, recipient_count, sent_at FROM notification_logs WHERE merchant_id = $1 ORDER BY sent_at DESC LIMIT 50',
      [merchantId]
    );
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
