// api/cancel-subscription.js — Cancel a Stripe subscription at period end (no immediate cut-off)
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  const { customerId } = req.body || {};
  if (!customerId || !String(customerId).startsWith('cus_')) {
    return res.status(400).json({ error: 'Valid Stripe customer ID required' });
  }

  const stripe = require('stripe')(key);

  try {
    // Find an active or trialing subscription for this customer
    let sub = null;
    for (const status of ['active', 'trialing']) {
      const list = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
      if (list.data.length) { sub = list.data[0]; break; }
    }

    if (!sub) {
      return res.status(404).json({ error: 'No active subscription found for this account.' });
    }

    if (sub.cancel_at_period_end) {
      const d = new Date(sub.current_period_end * 1000).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
      return res.json({ success: true, alreadyCancelled: true, cancelDate: d });
    }

    const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    const cancelDate = new Date(updated.current_period_end * 1000).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    return res.json({ success: true, cancelDate, subscriptionId: sub.id });
  } catch (err) {
    console.error('[cancel-subscription] Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
