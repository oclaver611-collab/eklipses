// api/verify-payment.js — Verifies a Stripe Checkout session and returns customer ID
// GET ?session_id=cs_xxx → { active: bool, customerId: string }
// Used after successful Stripe Checkout redirect to grant pro access

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  const { session_id } = req.query;
  if (!session_id || !session_id.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session_id' });
  }

  const stripe = require('stripe')(key);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    });

    const paid = session.payment_status === 'paid' || session.status === 'complete';
    const subActive = session.subscription?.status === 'active' || session.subscription?.status === 'trialing';

    if (!paid && !subActive) {
      return res.json({ active: false, customerId: null });
    }

    res.json({
      active: true,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    });
  } catch (err) {
    console.error('[verify-payment] Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
