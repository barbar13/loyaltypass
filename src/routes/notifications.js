'use strict';
const express  = require('express');
const webpush  = require('web-push');
const db       = require('../database');

const router = express.Router();

function configureWebPush() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:contact@fidelyzio.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    return true;
  }
  return false;
}
configureWebPush();

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications non configurées' });
  res.type('text').send(key);
});

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
  const { subscription, customer_qr_code } = req.body;
  if (!subscription?.endpoint || !customer_qr_code)
    return res.status(400).json({ error: 'subscription et customer_qr_code sont requis' });

  try {
    const customer = await db.one('SELECT id FROM customers WHERE qr_code = $1', [customer_qr_code]);
    if (!customer) return res.status(404).json({ error: 'Client introuvable' });
    try {
      await db.insert(
        'INSERT INTO push_subscriptions (customer_id, endpoint, auth, p256dh) VALUES ($1, $2, $3, $4)',
        [customer.id, subscription.endpoint, subscription.keys.auth, subscription.keys.p256dh]
      );
    } catch (_) { /* duplicate */ }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Core push helper: send to a single customer ────────────────────────────────

async function sendToCustomer(customerId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  try {
    const subs = await db.all('SELECT * FROM push_subscriptions WHERE customer_id = $1', [customerId]);
    const payloadStr = JSON.stringify(payload);
    await Promise.allSettled(subs.map(s =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { auth: s.auth, p256dh: s.p256dh } },
        payloadStr
      ).catch(err => {
        if (err.statusCode === 410)
          db.run('DELETE FROM push_subscriptions WHERE endpoint = $1', [s.endpoint]).catch(() => {});
      })
    ));
  } catch (_) {}
}

// ── Audience-based send + log ─────────────────────────────────────────────────
// audience: 'all' | 'inactive' | 'near_reward' | 'auto_inactive'

async function sendToMerchantAudience(merchantId, audience, title, body) {
  if (!process.env.VAPID_PUBLIC_KEY) return { sent: 0, error: 'Push non configuré (VAPID manquant)' };

  const baseUrl = process.env.BASE_URL || 'https://fidelyzio.com';

  try {
    let members = [];

    if (audience === 'all') {
      members = await db.all(
        'SELECT customer_id, points FROM memberships WHERE merchant_id = $1',
        [merchantId]
      );
    } else if (audience === 'inactive' || audience === 'auto_inactive') {
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
      members = await db.all(`
        SELECT mb.customer_id, mb.points
        FROM memberships mb
        LEFT JOIN (
          SELECT customer_id, MAX(created_at) AS last_visit
          FROM transactions
          WHERE merchant_id = $1 AND points > 0
          GROUP BY customer_id
        ) lv ON lv.customer_id = mb.customer_id
        WHERE mb.merchant_id = $1
          AND (lv.last_visit IS NULL OR lv.last_visit < $2)
      `, [merchantId, cutoff]);
    } else if (audience === 'near_reward') {
      const rewards = await db.all(
        'SELECT points_required FROM rewards WHERE merchant_id = $1 AND active = 1',
        [merchantId]
      );
      if (rewards.length === 0) return { sent: 0 };
      const all = await db.all(
        'SELECT customer_id, points FROM memberships WHERE merchant_id = $1',
        [merchantId]
      );
      members = all.filter(m => {
        const pts = Number(m.points);
        return rewards.some(r => pts >= r.points_required * 0.8 && pts < r.points_required);
      });
    }

    if (!members.length) return { sent: 0 };

    // Fetch subscriptions for each member and send
    const payload = JSON.stringify({ title, body, url: baseUrl });
    let sent = 0;

    await Promise.allSettled(members.map(async m => {
      const subs = await db.all('SELECT * FROM push_subscriptions WHERE customer_id = $1', [m.customer_id]);
      await Promise.allSettled(subs.map(s =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { auth: s.auth, p256dh: s.p256dh } },
          payload
        ).then(() => { sent++; })
         .catch(err => {
           if (err.statusCode === 410)
             db.run('DELETE FROM push_subscriptions WHERE endpoint = $1', [s.endpoint]).catch(() => {});
         })
      ));
    }));

    // Log notification
    await db.insert(
      'INSERT INTO notification_logs (merchant_id, title, body, audience, recipient_count) VALUES ($1, $2, $3, $4, $5)',
      [merchantId, title, body, audience, sent]
    );

    return { sent };
  } catch (err) {
    console.error('[Notifications] sendToMerchantAudience:', err.message);
    return { sent: 0, error: err.message };
  }
}

// ── Daily automatic notifications ─────────────────────────────────────────────
// Called once per day (scheduled in index.js). Sends inactive-customer reminders
// to every active merchant that hasn't already received one today.

async function sendAutoNotifications() {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const merchants = await db.all(
      "SELECT id, name FROM merchants WHERE subscription_status IN ('active', 'trial')"
    );

    for (const merchant of merchants) {
      // Skip if already sent today for this merchant
      const already = await db.one(
        "SELECT id FROM notification_logs WHERE merchant_id = $1 AND audience = 'auto_inactive' AND DATE(sent_at) = $2",
        [merchant.id, today]
      );
      if (already) continue;

      const result = await sendToMerchantAudience(
        merchant.id, 'auto_inactive',
        `On ne vous a pas vu depuis un moment !`,
        `Venez récupérer vos points chez ${merchant.name} !`
      );
      if (result.sent > 0)
        console.log(`[AutoNotif] Merchant ${merchant.id} (${merchant.name}): ${result.sent} notifications envoyées`);
    }
  } catch (err) {
    console.error('[AutoNotif] Erreur:', err.message);
  }
}

module.exports = { router, sendToCustomer, sendToMerchantAudience, sendAutoNotifications };
