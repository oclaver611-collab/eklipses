// api/ratelimit.js — shared rate limiting module
// Used by api/character.js and api/tts.js
// Three layers: IP rate limit + dev bypass cookie/header check
//
// Environment variables required in Vercel:
//   DEV_BYPASS_KEY   — secret string that grants unlimited access (e.g. "ek_ryan_2026")
//   DAILY_SESSION_LIMIT — max sessions per IP per day (default: 3)

// ── In-memory IP store (resets on cold start — that's fine, adds friction not a hard wall) ──
const ipStore = new Map();

// ── In-memory Stripe subscriber cache (customer ID → expiry timestamp) ────────
const subscriberCache = new Map();
const SUBSCRIBER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  } catch {
    return false;
  }
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-05-23"
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

  // Check x-dev-key header (set by player.js from cookie)
  if (req.headers['x-dev-key'] === secret) return true;

  // Check query param (for direct API testing)
  if (req.query?.dev === secret) return true;

  return false;
}

function checkIPLimit(req) {
  const limit = parseInt(process.env.DAILY_SESSION_LIMIT || '3', 10);
  const ip = getClientIP(req);
  const today = getTodayKey();
  const key = `${ip}:${today}`;

  const current = ipStore.get(key) || 0;

  if (current >= limit * 8) {
    // limit * 8 = max API calls per day (limit sessions × ~8 exchanges each)
    return { allowed: false, remaining: 0, ip };
  }

  ipStore.set(key, current + 1);

  // Clean up old keys to prevent memory leak (keep only today's keys)
  for (const k of ipStore.keys()) {
    if (!k.endsWith(today)) ipStore.delete(k);
  }

  return { allowed: true, remaining: limit * 8 - current - 1, ip };
}

// Main export — call at top of any API handler
// Returns Promise<{ allowed: boolean, bypass: boolean }>
async function checkRateLimit(req, res) {
  // Dev bypass — skip all limits
  if (isDevBypass(req)) {
    return { allowed: true, bypass: true };
  }

  // Stripe subscriber bypass — paid users get unlimited access
  const paid = await isActiveSubscriber(req);
  if (paid) {
    return { allowed: true, bypass: true };
  }

  const result = checkIPLimit(req);
  if (!result.allowed) {
    res.status(429).json({
      error: 'daily_limit_reached',
      message: 'You have reached your daily session limit. Come back tomorrow or upgrade to Pro.',
    });
    return { allowed: false, bypass: false };
  }

  return { allowed: true, bypass: false };
}

module.exports = { checkRateLimit, isDevBypass };
