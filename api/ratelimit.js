// api/ratelimit.js — subscriber check and server-side session rate limiting
const { supabase } = require('./supabase');

const FREE_SESSION_LIMIT = 2;

const subscriberCache = new Map();
const SUBSCRIBER_CACHE_TTL = 5 * 60 * 1000;

// Exported so webhook.js can do best-effort same-instance cache invalidation.
// Cross-instance revocations are handled by the DB check inside isActiveSubscriber().
exports.subscriberCache = subscriberCache;

// TEST_ACCOUNT_BYPASS — permanently free/unlimited accounts for internal testing.
// Populated via TEST_EMAILS_BYPASS env var (comma-separated emails).
// Clear this env var (or remove entries) before public launch.
const TEST_BYPASS_EMAILS = (process.env.TEST_EMAILS_BYPASS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

async function isActiveSubscriber(req) {
  const customerId = req.headers['x-stripe-customer'];
  if (!customerId || !customerId.startsWith('cus_')) return false;
  if (!process.env.STRIPE_SECRET_KEY) return false;

  // Check webhook-written revocation record BEFORE the in-memory cache so that
  // a subscription cancellation or payment failure revokes access immediately
  // across all serverless instances (not just the one that received the webhook).
  if (supabase) {
    try {
      const { data } = await supabase
        .from('user_sessions')
        .select('blocked')
        .eq('email', `stripe:${customerId}`)
        .single();
      if (data?.blocked === true) return false;
    } catch { /* fail open — DB error never blocks a paying customer */ }
  }

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

// Returns true if the request comes from a whitelisted test account.
// Relies on x-user-email header injected by patchFetch() in player.js.
function isTestAccount(req) {
  if (!TEST_BYPASS_EMAILS.length) return false;
  const email = req.headers['x-user-email'];
  if (!email) return false;
  return TEST_BYPASS_EMAILS.includes(email.trim().toLowerCase());
}

function isDevBypass(req) {
  const secret = process.env.DEV_BYPASS_KEY;
  if (!secret) return false;
  if (req.headers['x-dev-key'] === secret) return true;
  if (req.query?.dev === secret) return true;
  return false;
}

async function checkRateLimit(req, res) {
  // Priority 1: dev bypass (DEV_BYPASS_KEY intentionally not set in production)
  if (isDevBypass(req)) return { allowed: true, bypass: 'dev' };

  // Priority 2: whitelisted test accounts (TEST_EMAILS_BYPASS env var)
  if (isTestAccount(req)) return { allowed: true, bypass: 'test' };

  // Priority 3: active Stripe subscriber — unlimited
  const paid = await isActiveSubscriber(req);
  if (paid) return { allowed: true, bypass: 'subscriber' };

  // Priority 4: enforce the free-session limit server-side.
  // Without this, a caller can bypass the client-side paywall by hitting the API directly.
  // We read the same counter that count-session.js writes (keyed by ip:${ip}).
  if (!supabase) {
    // Supabase not configured (local dev without DB env vars) — fail open.
    return { allowed: true, bypass: false };
  }

  const ip = getClientIP(req);
  const key = `ip:${ip}`;

  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('sessions_used, blocked')
      .eq('email', key)
      .single();

    // PGRST116 = no row found = new user with 0 sessions
    if (error && error.code !== 'PGRST116') throw error;

    if (data?.blocked) {
      res.status(403).json({ error: 'Account blocked.' });
      return { allowed: false };
    }

    const sessionsUsed = data?.sessions_used ?? 0;
    if (sessionsUsed >= FREE_SESSION_LIMIT) {
      res.status(402).json({
        error: 'Free session limit reached. Subscribe to continue.',
        sessionsUsed,
        limit: FREE_SESSION_LIMIT,
      });
      return { allowed: false };
    }

    return { allowed: true, bypass: false };
  } catch (err) {
    // Fail open on DB error — never block a user due to our own infrastructure issue
    console.warn('[ratelimit] session check error — failing open:', err.message);
    return { allowed: true, bypass: false };
  }
}

module.exports = { checkRateLimit, isDevBypass, isActiveSubscriber, getClientIP, isTestAccount, FREE_SESSION_LIMIT };
