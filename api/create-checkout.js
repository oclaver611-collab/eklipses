// api/create-checkout.js — Creates a Stripe Checkout session for Eklipses Pro or Elite
// POST { email?, plan? } → { url: string }
// Requires env: STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, STRIPE_ELITE_PRICE_ID

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  const stripe = require('stripe')(key);
  const { email, plan } = req.body || {};

  const priceId = plan === 'elite'
    ? process.env.STRIPE_ELITE_PRICE_ID
    : process.env.STRIPE_PRO_PRICE_ID;

  if (!priceId) return res.status(500).json({ error: `Price ID not configured for plan: ${plan || 'pro'}` });

  const origin = (req.headers.origin || req.headers.referer || 'https://eklipses.vercel.app').replace(/\/$/, '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email || undefined,
      allow_promotion_codes: true,
      success_url: `${origin}/?stripe_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata: {
        source: 'eklipses-paywall',
        plan: plan || 'pro',
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[create-checkout] Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
