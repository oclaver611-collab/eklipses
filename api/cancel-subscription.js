// api/cancel-subscription.js — Cancel a Stripe subscription at period end (no immediate cut-off)
// Requires a valid Supabase session JWT. Cross-checks the caller's identity
// against the Stripe customer's email — the client-provided customerId is NOT
// trusted on its own.
const { supabase } = require('./supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  // ── Authentication ────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!jwt) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'Auth service not configured' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user?.email) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const { customerId } = req.body || {};
  if (!customerId || !String(customerId).startsWith('cus_')) {
    return res.status(400).json({ error: 'Valid Stripe customer ID required' });
  }

  const stripe = require('stripe')(key);

  try {
    // ── Ownership check ───────────────────────────────────────────────────
    // Retrieve the Stripe customer and verify their email matches the
    // authenticated Supabase user. This prevents any caller who knows (or
    // guesses) a cus_xxx ID from cancelling someone else's subscription.
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return res.status(404).json({ error: 'Stripe customer not found' });
    }
    if (!customer.email || customer.email.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ error: 'This subscription does not belong to your account.' });
    }

    // ── Find and cancel the active subscription ───────────────────────────
    let sub = null;
    for (const status of ['active', 'trialing']) {
      const list = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
      if (list.data.length) { sub = list.data[0]; break; }
    }

    if (!sub) {
      return res.status(404).json({ error: 'No active subscription found for this account.' });
    }

    if (sub.cancel_at_period_end) {
      const ts = sub.cancel_at || sub.current_period_end;
      const d = ts
        ? new Date(ts * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'end of billing period';
      return res.json({ success: true, alreadyCancelled: true, cancelDate: d });
    }

    const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    // cancel_at is set by Stripe (API 2026-05-27+) when cancel_at_period_end=true.
    // Older API versions used current_period_end; fall back for forward compatibility.
    const periodEndTs = updated.cancel_at || updated.current_period_end;
    const cancelDate = periodEndTs
      ? new Date(periodEndTs * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'end of billing period';

    return res.json({ success: true, cancelDate, subscriptionId: sub.id });
  } catch (err) {
    console.error('[cancel-subscription] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
