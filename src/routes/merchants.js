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
const JWT_SECRET  = () => process.env.JWT_SECRET  || 'fidelyzio_dev_secret_change_in_prod';
const JWT_EXPIRES = () => process.env.JWT_EXPIRES_IN || '30d';

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
  const { name, email: merchantEmail, password, logo_url, color, plan } = req.body;

  if (!name || !merchantEmail || !password) {
    return res.status(400).json({ error: 'name, email et password sont requis' });
  }

  try {
    const existing = await db.one('SELECT id FROM merchants WHERE email = $1', [merchantEmail]);
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const id = await db.insert(
      'INSERT INTO merchants (name, email, password, logo_url, color, plan, trial_ends_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [name, merchantEmail, hashed, logo_url || null, color || '#6366f1', plan || 'free', trialEndsAt]
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
              stripe_customer_id
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

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get('/analytics', auth, async (req, res) => {
  const merchantId = req.merchant.id;
  try {
    const now = Date.now();

    // Timestamp boundaries (ms since epoch) — used for ALL JS comparisons
    const ts30  = now - 30 * 86400000;
    const ts7   = now - 7  * 86400000;
    const ts14  = now - 14 * 86400000;
    const nowDate = new Date();
    const tsMonthStart     = new Date(nowDate.getFullYear(), nowDate.getMonth(),     1).getTime();
    const tsLastMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1).getTime();

    // Convert any DB timestamp (Date object from pg, or "YYYY-MM-DD HH:MM:SS" string from SQLite)
    // to milliseconds. All JS date comparisons use toTs() to stay DB-agnostic.
    function toTs(val) {
      if (!val) return null;
      if (val instanceof Date) return val.getTime();
      const s = String(val).trim();
      // SQLite stores "YYYY-MM-DD HH:MM:SS" (UTC) — add T and Z so Date parses it as UTC
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s))
        return new Date(s.replace(' ', 'T') + 'Z').getTime();
      return new Date(s).getTime();
    }

    // Extract "YYYY-MM-DD" from any DB timestamp value
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
        'SELECT id, customer_id, points, note, created_at FROM transactions WHERE merchant_id = $1 ORDER BY created_at',
        [merchantId]
      ),
    ]);

    console.log(`[Analytics] merchant=${merchantId} memberships=${memberships.length} transactions=${allTxns.length}`);

    // ── Customer analysis ─────────────────────────────────────────────────
    const positiveTxns   = allTxns.filter(t => t.points > 0);
    const positiveTxns30 = positiveTxns.filter(t => toTs(t.created_at) >= ts30);
    const redemptions    = allTxns.filter(t => t.points < 0);

    const activeCustomers   = memberships.filter(m => { const ts = toTs(m.last_visit); return ts !== null && ts >= ts30; });
    const inactiveCustomers = memberships.filter(m => { const ts = toTs(m.last_visit); return ts === null || ts < ts30; });
    const avgVisitFreq = activeCustomers.length > 0
      ? Math.round((positiveTxns30.length / activeCustomers.length) * 10) / 10 : 0;

    const topCustomers = memberships
      .map(m => ({ first_name: m.first_name, phone: m.phone, points: Number(m.points),
                   visit_count: Number(m.visit_count), last_visit: m.last_visit }))
      .sort((a, b) => b.points - a.points).slice(0, 50);

    const lostCustomers = inactiveCustomers
      .sort((a, b) => (toTs(a.last_visit) || 0) - (toTs(b.last_visit) || 0)).slice(0, 20)
      .map(m => ({ first_name: m.first_name, phone: m.phone, points: Number(m.points), last_visit: m.last_visit }));

    const newThisWeek = memberships.filter(m => toTs(m.joined_at) >= ts7).length;
    const newLastWeek = memberships.filter(m => { const ts = toTs(m.joined_at); return ts >= ts14 && ts < ts7; }).length;

    // ── Time analysis ─────────────────────────────────────────────────────
    const scansDayMap = {};
    positiveTxns30.forEach(t => {
      const d = toDateStr(t.created_at);
      if (d) scansDayMap[d] = (scansDayMap[d] || 0) + 1;
    });
    const scansPerDay = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now - i * 86400000).toISOString().slice(0, 10);
      scansPerDay.push({ day, count: scansDayMap[day] || 0 });
    }

    const scansByWeekday = Array(7).fill(0);
    positiveTxns30.forEach(t => {
      const ts = toTs(t.created_at);
      if (ts) scansByWeekday[(new Date(ts).getUTCDay() + 6) % 7]++;
    });

    const scansByHour = Array(24).fill(0);
    positiveTxns30.forEach(t => {
      const ts = toTs(t.created_at);
      if (ts) scansByHour[new Date(ts).getUTCHours()]++;
    });

    const thisMonthScans     = positiveTxns.filter(t => toTs(t.created_at) >= tsMonthStart).length;
    const lastMonthScans     = positiveTxns.filter(t => { const ts = toTs(t.created_at); return ts >= tsLastMonthStart && ts < tsMonthStart; }).length;
    const thisMonthCustomers = memberships.filter(m => toTs(m.joined_at) >= tsMonthStart).length;
    const lastMonthCustomers = memberships.filter(m => { const ts = toTs(m.joined_at); return ts >= tsLastMonthStart && ts < tsMonthStart; }).length;

    // ── Rewards analysis ──────────────────────────────────────────────────
    const totalPointsDistrib   = positiveTxns.reduce((s, t) => s + t.points, 0);
    const totalPointsRedeemed  = redemptions.reduce((s, t) => s + Math.abs(t.points), 0);
    const customersWhoRedeemed = new Set(redemptions.map(r => r.customer_id));
    const redemptionRate       = memberships.length > 0
      ? Math.round((customersWhoRedeemed.size / memberships.length) * 100) : 0;

    const rewardCounts = {};
    redemptions.forEach(t => {
      const k = (t.note || '').replace(/^Récompense\s*:\s*/i, '').trim() || 'Inconnu';
      rewardCounts[k] = (rewardCounts[k] || 0) + 1;
    });
    const mostPopularReward = Object.keys(rewardCounts).sort((a, b) => rewardCounts[b] - rewardCounts[a])[0] || null;

    let avgPointsBeforeFirstRedemption = 0;
    if (redemptions.length > 0) {
      const firstRedeemTs = {};
      redemptions.forEach(r => {
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

    const cumulativeCustomers = [];
    for (let i = 11; i >= 0; i--) {
      const wEndTs = now - i * 7 * 86400000;
      const label  = new Date(wEndTs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      cumulativeCustomers.push({ label, count: memberships.filter(m => { const ts = toTs(m.joined_at); return ts !== null && ts <= wEndTs; }).length });
    }

    const loyaltyScores = memberships.filter(m => Number(m.visit_count) > 0)
      .map(m => Number(m.points) / Number(m.visit_count));
    const avgLoyaltyScore = loyaltyScores.length > 0
      ? Math.round(loyaltyScores.reduce((a, b) => a + b, 0) / loyaltyScores.length) : 0;

    const weeklyScans       = positiveTxns.filter(t => toTs(t.created_at) >= ts7).length;
    const weeklyRedemptions = redemptions.filter(t => toTs(t.created_at) >= ts7).length;

    console.log(`[Analytics] active=${activeCustomers.length} inactive=${inactiveCustomers.length} scans30=${positiveTxns30.length} thisMonth=${thisMonthScans}`);

    res.json({
      active_customers:    activeCustomers.length,
      inactive_customers:  inactiveCustomers.length,
      avg_visit_frequency: avgVisitFreq,
      top_customers:       topCustomers,
      lost_customers:      lostCustomers,
      new_customers_this_week: newThisWeek,
      new_customers_last_week: newLastWeek,
      scans_per_day:       scansPerDay,
      scans_by_weekday:    scansByWeekday,
      scans_by_hour:       scansByHour,
      this_month_scans:    thisMonthScans,
      last_month_scans:    lastMonthScans,
      this_month_customers: thisMonthCustomers,
      last_month_customers: lastMonthCustomers,
      total_points_distributed:           totalPointsDistrib,
      total_points_redeemed:              totalPointsRedeemed,
      total_redeemed:                     redemptions.length,
      redemption_rate:                    redemptionRate,
      most_popular_reward:                mostPopularReward,
      avg_points_before_first_redemption: avgPointsBeforeFirstRedemption,
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

module.exports = router;
