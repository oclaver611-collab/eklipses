// api/webhook.js — Stripe webhook handler
//
// Processes subscription lifecycle events and writes revocation records to
// Supabase so isActiveSubscriber() can revoke access immediately instead of
// waiting for the 5-minute in-memory cache to expire.
//
// DB record: user_sessions row where email = 'stripe:<customerId>'
//   blocked = true  → subscription is lapsed/cancelled/payment-failed
//   blocked = false → subscription is active again (payment retry succeeded)
//
// SETUP (one manual step required — see bottom of this file):
//   Add https://eklipses.vercel.app/api/webhook as a Stripe webhook endpoint
//   and set STRIPE_WEBHOOK_SECRET in Vercel env vars.

// Disable Vercel's body parser — Stripe signature verification requires the
// exact raw bytes as sent by Stripe. If the body is re-serialized (even
// losslessly), the HMAC will not match and every webhook will be rejected.
module.exports.config = { api: { bodyParser: false } };

const { supabase } = require('./supabase');

// Statuses that mean the customer's access should be revoked.
const REVOKED_STATUSES = new Set(['canceled', 'unpaid', 'past_due', 'incomplete_expired']);

// Write or update the subscription status record in Supabase.
async function upsertSubscriberStatus(customerId, blocked) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('user_sessions').upsert({
      email:          `stripe:${customerId}`,
      blocked,
      sessions_used:  0,
      sessions_limit: 0,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'email' });
    if (error) console.error('[webhook] DB upsert error:', error.message);
  } catch (err) {
    console.error('[webhook] DB upsert threw:', err.message);
  }
}

// Best-effort: invalidate the in-memory subscriber cache in ratelimit.js for
// the same serverless instance. Cross-instance invalidation is handled by the
// DB check that isActiveSubscriber() now performs before reading the cache.
function invalidateCache(customerId) {
  try {
    const { subscriberCache } = require('./ratelimit');
    subscriberCache.delete(customerId);
  } catch { /* ratelimit not loaded in this instance — no-op */ }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Read the raw body from the request stream (bodyParser is disabled above).
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
  const stripe = require('stripe')(stripeKey);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  const obj = event.data?.object;
  let customerId = null;
  let blocked    = null;

  switch (event.type) {
    case 'invoice.payment_failed': {
      // obj is an Invoice — customer field is a string ID
      customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      blocked    = true;
      console.log(`[webhook] invoice.payment_failed — revoking ${customerId}`);
      break;
    }
    case 'customer.subscription.deleted': {
      // obj is a Subscription
      customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      blocked    = true;
      console.log(`[webhook] subscription.deleted — revoking ${customerId}`);
      break;
    }
    case 'customer.subscription.updated': {
      // obj is a Subscription with a status field
      customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      const status = obj.status;
      blocked = REVOKED_STATUSES.has(status);
      console.log(`[webhook] subscription.updated — ${customerId} status=${status} revoked=${blocked}`);
      break;
    }
    default:
      // Acknowledge events we don't handle so Stripe doesn't retry them.
      return res.status(200).json({ received: true, handled: false });
  }

  if (!customerId) {
    console.error('[webhook] Could not extract customerId from event:', event.type);
    return res.status(200).json({ received: true, handled: false, error: 'no customerId' });
  }

  await upsertSubscriberStatus(customerId, blocked);
  invalidateCache(customerId);

  return res.status(200).json({ received: true, handled: true, customerId, revoked: blocked });
};

// ── Manual setup required ─────────────────────────────────────────────────────
//
// 1. Go to https://dashboard.stripe.com/webhooks (or test: /test/webhooks)
// 2. Click "Add endpoint"
// 3. Endpoint URL: https://eklipses.vercel.app/api/webhook
// 4. Select events:
//      invoice.payment_failed
//      customer.subscription.deleted
//      customer.subscription.updated
// 5. Click "Add endpoint" → copy the "Signing secret" (starts with whsec_)
// 6. In Vercel dashboard → Settings → Environment Variables → add:
//      STRIPE_WEBHOOK_SECRET = <the whsec_... value>
//    Set for: Production + Preview
// 7. Redeploy (or run deploy.bat) so the new env var is picked up.
