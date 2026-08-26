// api/create-checkout.js — Creates a Stripe Checkout session for Eklipses Pro or Elite
// POST { email?, plan? } → { url: string }
// Requires env: STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, STRIPE_ELITE_PRICE_ID

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  const stripe = require('stripe')(key);
  const { email, plan } = req.body || {};

  // In test mode, prefer _TEST-suffixed price IDs so Preview deployments can use
  // test-mode Stripe prices without overwriting the Production (live-mode) values.
  const isTestMode = key.startsWith('sk_test_');

  // DEBUG — remove once confirmed clean
  const _rawPro = process.env.STRIPE_PRO_PRICE_ID_TEST || '';
  console.log('[create-checkout] DEBUG STRIPE_PRO_PRICE_ID_TEST:', JSON.stringify(_rawPro), 'charCode[0]:', _rawPro.charCodeAt(0));

  const priceId = plan === 'elite'
    ? (isTestMode && process.env.STRIPE_ELITE_PRICE_ID_TEST) || process.env.STRIPE_ELITE_PRICE_ID
    : (isTestMode && process.env.STRIPE_PRO_PRICE_ID_TEST) || process.env.STRIPE_PRO_PRICE_ID;

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
