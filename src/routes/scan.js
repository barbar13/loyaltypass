const express = require('express');
const db   = require('../database');
const auth = require('../middleware/auth');

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
    const customer = await db.one(
      'SELECT id, first_name, phone FROM customers WHERE qr_code = $1',
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

module.exports = router;
