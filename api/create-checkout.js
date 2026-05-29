// api/create-checkout.js — Creates a Stripe Checkout session for Eklipses Pro
// POST { email? } → { url: string }
// Requires env: STRIPE_SECRET_KEY, STRIPE_PRICE_ID

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  const stripe = require('stripe')(key);
  const { email } = req.body || {};

  const origin = (req.headers.origin || req.headers.referer || 'https://eklipses.vercel.app').replace(/\/$/, '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // $14.99/month price ID from Stripe dashboard
          quantity: 1,
        },
      ],
      customer_email: email || undefined,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 0, // no trial — already had 3 free sessions
      },
      success_url: `${origin}/?stripe_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata: {
        source: 'eklipses-paywall',
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[create-checkout] Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
