// api/ratelimit.js — subscriber check and dev bypass (no session counting)
const subscriberCache = new Map();
const SUBSCRIBER_CACHE_TTL = 5 * 60 * 1000;

async function isActiveSubscriber(req) {
  const customerId = req.headers['x-stripe-customer'];
  if (!customerId || !customerId.startsWith('cus_')) return false;
  if (!process.env.STRIPE_SECRET_KEY) return false;
  const cached = subscriberCache.get(customerId);
  if (cached && cached.expires > Date.now()) return cached.active;
  try {
    const r = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=1`,
      { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
    );
    const data = await r.json();
    const active = Array.isArray(data.data) && data.data.length > 0;
    subscriberCache.set(customerId, { active, expires: Date.now() + SUBSCRIBER_CACHE_TTL });
    return active;
  } catch { return false; }
}

function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function isDevBypass(req) {
  const secret = process.env.DEV_BYPASS_KEY;
  if (!secret) return false;
  if (req.headers['x-dev-key'] === secret) return true;
  if (req.query?.dev === secret) return true;
  return false;
}

async function checkRateLimit(req, res) {
  if (isDevBypass(req)) return { allowed: true, bypass: true };
  const paid = await isActiveSubscriber(req);
  if (paid) return { allowed: true, bypass: true };
  return { allowed: true, bypass: false };
}

module.exports = { checkRateLimit, isDevBypass, isActiveSubscriber, getClientIP };
