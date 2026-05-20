'use strict';
const express   = require('express');
const webpush   = require('web-push');
const db        = require('../database');

const router = express.Router();

function configureWebPush() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:' + (process.env.EMAIL_USER || 'contact@fidevo.app'),
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    return true;
  }
  return false;
}
configureWebPush();

// GET /api/notifications/vapid-public-key — expose public key to clients
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications non configurées' });
  res.type('text').send(key);
});

// POST /api/notifications/subscribe — store a push subscription for a customer
router.post('/subscribe', async (req, res) => {
  const { subscription, customer_qr_code } = req.body;
  if (!subscription?.endpoint || !customer_qr_code)
    return res.status(400).json({ error: 'subscription et customer_qr_code sont requis' });

  try {
    const customer = await db.one('SELECT id FROM customers WHERE qr_code = $1', [customer_qr_code]);
    if (!customer) return res.status(404).json({ error: 'Client introuvable' });

    // Upsert (ignore duplicate endpoint)
    try {
      await db.insert(
        'INSERT INTO push_subscriptions (customer_id, endpoint, auth, p256dh) VALUES ($1, $2, $3, $4)',
        [customer.id, subscription.endpoint, subscription.keys.auth, subscription.keys.p256dh]
      );
    } catch (_) { /* duplicate endpoint — already subscribed */ }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exported helper: send a push notification to all subscriptions for a customer
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
        // 410 Gone = subscription expired, clean it up
        if (err.statusCode === 410) {
          db.run('DELETE FROM push_subscriptions WHERE endpoint = $1', [s.endpoint]).catch(() => {});
        }
      })
    ));
  } catch (_) {}
}

module.exports = { router, sendToCustomer };
