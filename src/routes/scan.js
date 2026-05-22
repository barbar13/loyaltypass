const express = require('express');
const db      = require('../database');
const auth    = require('../middleware/auth');
const email   = require('../email');
const { sendToCustomer } = require('./notifications');

const router = express.Router();

// GET /api/scan/lookup/:customer_qr_code
// Preview a customer before confirming points — read-only, no side effects
router.get('/lookup/:customer_qr_code', auth, async (req, res) => {
  const merchantId = req.merchant.id;
  try {
    const customer = await db.one(
      'SELECT id, first_name, phone FROM customers WHERE qr_code = $1',
      [req.params.customer_qr_code]
    );
    if (!customer) {
      return res.status(404).json({ error: 'Client introuvable — QR code invalide' });
    }

    const [membership, alreadyRow, rewards] = await Promise.all([
      db.one(
        'SELECT * FROM memberships WHERE merchant_id = $1 AND customer_id = $2',
        [merchantId, customer.id]
      ),
      db.one(
        `SELECT COUNT(*) AS cnt FROM transactions WHERE merchant_id = $1 AND customer_id = $2 AND ${db.todayExpr}`,
        [merchantId, customer.id]
      ),
      db.all(
        'SELECT * FROM rewards WHERE merchant_id = $1 AND active = 1 ORDER BY points_required ASC',
        [merchantId]
      ),
    ]);

    res.json({
      customer: { id: customer.id, first_name: customer.first_name, phone: customer.phone },
      membership: membership ?? { points: 0, joined_at: null },
      is_new_customer:       !membership,
      already_scanned_today: Number(alreadyRow.cnt) > 0,
      rewards,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

// POST /api/scan
// Merchant scans customer QR → adds points (max 1 per customer per merchant per day)
router.post('/', auth, async (req, res) => {
  const { customer_qr_code, points } = req.body;
  const merchantId = req.merchant.id;

  if (!customer_qr_code) {
    return res.status(400).json({ error: 'customer_qr_code est requis' });
  }
  const pts = parseInt(points, 10);
  if (!Number.isInteger(pts) || pts <= 0 || pts > 9999) {
    return res.status(400).json({ error: 'points doit être un entier entre 1 et 9999' });
  }

  try {
    // Subscription gate — suspended or expired trial cannot scan
    const merchantFull = await db.one('SELECT subscription_status, trial_ends_at FROM merchants WHERE id = $1', [merchantId]);
    const subStatus = merchantFull?.subscription_status;
    if (subStatus === 'suspended' || subStatus === 'canceled') {
      return res.status(402).json({ error: 'Abonnement inactif. Abonnez-vous sur /subscribe pour continuer.', redirect: '/subscribe' });
    }
    if (subStatus === 'trial' && merchantFull.trial_ends_at && new Date(merchantFull.trial_ends_at) < new Date()) {
      await db.run("UPDATE merchants SET subscription_status = 'suspended' WHERE id = $1", [merchantId]);
      return res.status(402).json({ error: 'Période d\'essai expirée. Abonnez-vous sur /subscribe.', redirect: '/subscribe' });
    }

    const customer = await db.one(
      'SELECT id, first_name, phone, email, qr_code FROM customers WHERE qr_code = $1',
      [customer_qr_code]
    );
    if (!customer) {
      return res.status(404).json({ error: 'Client introuvable — QR code invalide' });
    }

    // Anti-fraud: max 1 point transaction per customer per merchant per calendar day
    const { cnt } = await db.one(
      `SELECT COUNT(*) AS cnt FROM transactions WHERE merchant_id = $1 AND customer_id = $2 AND ${db.todayExpr}`,
      [merchantId, customer.id]
    );
    if (Number(cnt) > 0) {
      // Log blocked attempt for fraud detection (fire-and-forget)
      db.run(
        'INSERT INTO scan_attempts (merchant_id, customer_id, points, blocked) VALUES ($1, $2, $3, 1)',
        [merchantId, customer.id, pts]
      ).catch(() => {});
      return res.status(429).json({
        error: "Ce client a déjà reçu des points aujourd'hui chez vous.",
        already_scanned: true,
      });
    }

    // Atomically upsert membership + log transaction
    const updatedMembership = await db.transaction(async (tx) => {
      let membership = await tx.one(
        'SELECT * FROM memberships WHERE merchant_id = $1 AND customer_id = $2',
        [merchantId, customer.id]
      );

      if (!membership) {
        const id = await tx.insert(
          'INSERT INTO memberships (merchant_id, customer_id, points) VALUES ($1, $2, $3)',
          [merchantId, customer.id, pts]
        );
        membership = await tx.one('SELECT * FROM memberships WHERE id = $1', [id]);
      } else {
        await tx.run(
          'UPDATE memberships SET points = points + $1 WHERE id = $2',
          [pts, membership.id]
        );
        membership = await tx.one('SELECT * FROM memberships WHERE id = $1', [membership.id]);
      }

      await tx.run(
        'INSERT INTO transactions (merchant_id, customer_id, points) VALUES ($1, $2, $3)',
        [merchantId, customer.id, pts]
      );

      return membership;
    });

    const rewards = await db.all(
      'SELECT * FROM rewards WHERE merchant_id = $1 AND active = 1 ORDER BY points_required ASC',
      [merchantId]
    );

    // Fire-and-forget notifications
    (async () => {
      try {
        const merchant = await db.one('SELECT name FROM merchants WHERE id = $1', [merchantId]);
        const baseUrl  = process.env.BASE_URL || 'https://fidelyzio.com';
        const cardUrl  = `${baseUrl}/card/${customer.qr_code}`;

        if (customer.email) {
          email.sendPointsEarned({
            to: customer.email, firstName: customer.first_name,
            points: pts, totalPoints: updatedMembership.points,
            merchantName: merchant.name, cardUrl,
          }).catch(() => {});
        }

        // Check if reward just became available
        const newPts = Number(updatedMembership.points);
        const oldPts = newPts - pts;
        const unlockedReward = rewards.find(r => newPts >= r.points_required);

        let pushTitle, pushBody;
        if (unlockedReward) {
          pushTitle = `Récompense disponible chez ${merchant.name} !`;
          pushBody  = `${unlockedReward.description} — ${newPts} pts`;
        } else {
          // Check if customer just crossed 80% of any reward threshold
          const nearReward = rewards.find(r => {
            const thresh = r.points_required;
            return newPts >= thresh * 0.8 && oldPts < thresh * 0.8;
          });
          if (nearReward) {
            const remaining = nearReward.points_required - newPts;
            pushTitle = `Plus que ${remaining} points !`;
            pushBody  = `Encore ${remaining} pts pour "${nearReward.description}" chez ${merchant.name} !`;
          } else {
            pushTitle = `+${pts} points chez ${merchant.name} !`;
            pushBody  = `Votre solde : ${newPts} pts`;
          }
        }

        sendToCustomer(customer.id, { title: pushTitle, body: pushBody, url: cardUrl });
      } catch (_) {}
    })();

    res.json({
      customer:   { id: customer.id, first_name: customer.first_name, phone: customer.phone },
      membership: updatedMembership,
      points_added: pts,
      rewards,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du scan', detail: err.message });
  }
});

// POST /api/scan/redeem
// Merchant redeems a reward for a customer — deducts points + logs with negative value
router.post('/redeem', auth, async (req, res) => {
  const { membership_id, reward_id } = req.body;
  const merchantId = req.merchant.id;

  if (!membership_id || !reward_id) {
    return res.status(400).json({ error: 'membership_id et reward_id sont requis' });
  }

  try {
    const [membership, reward] = await Promise.all([
      db.one('SELECT * FROM memberships WHERE id = $1 AND merchant_id = $2', [membership_id, merchantId]),
      db.one('SELECT * FROM rewards WHERE id = $1 AND merchant_id = $2 AND active = 1', [reward_id, merchantId]),
    ]);

    if (!membership) return res.status(404).json({ error: 'Adhésion introuvable' });
    if (!reward)     return res.status(404).json({ error: 'Récompense introuvable ou inactive' });
    if (membership.points < reward.points_required) {
      return res.status(400).json({ error: 'Points insuffisants pour cette récompense' });
    }

    await db.transaction(async (tx) => {
      await tx.run(
        'UPDATE memberships SET points = points - $1 WHERE id = $2',
        [reward.points_required, membership.id]
      );
      await tx.run(
        'INSERT INTO transactions (merchant_id, customer_id, points, note) VALUES ($1, $2, $3, $4)',
        [merchantId, membership.customer_id, -reward.points_required, `Récompense : ${reward.description}`]
      );
    });

    const [updated, customer] = await Promise.all([
      db.one('SELECT * FROM memberships WHERE id = $1', [membership.id]),
      db.one('SELECT id, first_name, phone FROM customers WHERE id = $1', [membership.customer_id]),
    ]);

    res.json({
      success: true,
      customer,
      membership: updated,
      reward,
      points_deducted: reward.points_required,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
