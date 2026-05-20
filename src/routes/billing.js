'use strict';
const express = require('express');
const db      = require('../database');
const auth    = require('../middleware/auth');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const PLAN_PRICE_EUR = 1900; // 19.00 €

// ── Checkout ──────────────────────────────────────────────────────────────────

router.post('/create-checkout', auth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré (STRIPE_SECRET_KEY manquant)' });

  try {
    const merchant = await db.one('SELECT * FROM merchants WHERE id = $1', [req.merchant.id]);
    const baseUrl  = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: merchant.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'Fidevo Pro — Abonnement mensuel' },
          unit_amount: PLAN_PRICE_EUR,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/?subscription=success`,
      cancel_url:  `${baseUrl}/subscribe?canceled=true`,
      metadata: { merchant_id: String(merchant.id) },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Billing portal (cancel/update subscription) ───────────────────────────────

router.post('/portal', auth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré' });
  try {
    const merchant = await db.one('SELECT * FROM merchants WHERE id = $1', [req.merchant.id]);
    if (!merchant.stripe_customer_id) return res.status(400).json({ error: 'Aucun abonnement actif' });
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: merchant.stripe_customer_id,
      return_url: `${baseUrl}/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
}

module.exports = { router, webhookHandler };
