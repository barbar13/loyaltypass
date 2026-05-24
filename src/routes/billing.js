'use strict';
const express = require('express');
const db      = require('../database');
const auth    = require('../middleware/auth');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const PRICE_ID = 'price_1TaZhXGgy4SouTrybrox7Oxg';

// Creates a Stripe checkout session. Returns the URL or null if Stripe is not configured.
async function createCheckoutSession(merchantEmail, merchantId) {
  const stripe = getStripe();
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    payment_method_collection: 'always',
    mode: 'subscription',
    customer_email: merchantEmail,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    subscription_data: { trial_period_days: 14 },
    success_url: 'https://fidelyzio.com/scanner?subscribed=true',
    cancel_url:  'https://fidelyzio.com/register',
    metadata: { merchant_id: String(merchantId) },
  });
  return session.url;
}

// ── Checkout ──────────────────────────────────────────────────────────────────

router.post('/create-checkout', auth, async (req, res) => {
  try {
    const merchant = await db.one('SELECT id, email FROM merchants WHERE id = $1', [req.merchant.id]);
    const url = await createCheckoutSession(merchant.email, merchant.id);
    if (!url) return res.status(503).json({ error: 'Stripe non configuré (STRIPE_SECRET_KEY manquant)' });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Billing portal (cancel/update subscription) ───────────────────────────────

router.post('/portal', auth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré' });
  try {
    const merchant = await db.one('SELECT stripe_customer_id FROM merchants WHERE id = $1', [req.merchant.id]);
    if (!merchant.stripe_customer_id) return res.status(400).json({ error: 'Aucun abonnement actif' });
    const session = await stripe.billingPortal.sessions.create({
      customer: merchant.stripe_customer_id,
      return_url: 'https://fidelyzio.com/scanner',
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Webhook handler (raw body — must be registered before express.json()) ─────

async function webhookHandler(req, res) {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe] Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const merchantId = s.metadata?.merchant_id;
        if (merchantId) {
          await db.run(
            'UPDATE merchants SET subscription_status = $1, stripe_customer_id = $2, stripe_subscription_id = $3 WHERE id = $4',
            ['active', s.customer, s.subscription, merchantId]
          );
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        await db.run(
          "UPDATE merchants SET subscription_status = 'active' WHERE stripe_customer_id = $1",
          [inv.customer]
        );
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        await db.run(
          "UPDATE merchants SET subscription_status = 'suspended' WHERE stripe_customer_id = $1",
          [inv.customer]
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await db.run(
          "UPDATE merchants SET subscription_status = 'canceled', stripe_subscription_id = NULL WHERE stripe_customer_id = $1",
          [sub.customer]
        );
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe] Webhook handler error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

module.exports = { router, webhookHandler, createCheckoutSession };
