// api/ratelimit.js — Supabase-backed rate limiting
// Falls back to in-memory if Supabase is unavailable
const { supabase } = require('./supabase');

const ipStore = new Map(); // fallback only
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

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Supabase-backed session tracking by IP
async function checkAndIncrementSupabase(ip) {
  if (!supabase) return null; // fallback to in-memory
  try {
    const limit = parseInt(process.env.DAILY_SESSION_LIMIT || '1', 10);
    const email = `ip:${ip}`; // use ip: prefix for non-authenticated users

    const { data, error } = await supabase
      .from('user_sessions')
      .select('sessions_used, blocked, sessions_limit')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

    if (!data) {
      // New IP — create record
      await supabase.from('user_sessions').insert({
        email,
        sessions_used: 1,
        sessions_limit: limit,
        blocked: false,
      });
      return { allowed: true, remaining: limit - 1 };
    }

    if (data.blocked) return { allowed: false, remaining: 0, blocked: true };

    const effectiveLimit = data.sessions_limit || limit;
    if (data.sessions_used >= effectiveLimit * 8) {
      return { allowed: false, remaining: 0 };
    }

    await supabase
      .from('user_sessions')
      .update({ sessions_used: data.sessions_used + 1, updated_at: new Date().toISOString() })
      .eq('email', email);

    return { allowed: true, remaining: effectiveLimit * 8 - data.sessions_used - 1 };
  } catch (err) {
    console.error('[ratelimit] Supabase error, falling back to memory:', err.message);
    return null;
  }
}

function checkIPLimitMemory(req) {
  const limit = parseInt(process.env.DAILY_SESSION_LIMIT || '1', 10);
  const ip = getClientIP(req);
  const today = getTodayKey();
  const key = `${ip}:${today}`;
  const current = ipStore.get(key) || 0;
  if (current >= limit * 8) return { allowed: false, remaining: 0, ip };
  ipStore.set(key, current + 1);
  for (const k of ipStore.keys()) { if (!k.endsWith(today)) ipStore.delete(k); }
  return { allowed: true, remaining: limit * 8 - current - 1, ip };
}

async function checkRateLimit(req, res) {
  if (isDevBypass(req)) return { allowed: true, bypass: true };
  const paid = await isActiveSubscriber(req);
  if (paid) return { allowed: true, bypass: true };

  const ip = getClientIP(req);
  let result = await checkAndIncrementSupabase(ip);
  if (!result) result = checkIPLimitMemory(req);

  if (!result.allowed) {
    res.status(429).json({
      error: 'daily_limit_reached',
      message: result.blocked
        ? 'Your account has been suspended. Contact support.'
        : 'You have reached your daily session limit. Come back tomorrow or upgrade to Pro.',
    });
    return { allowed: false, bypass: false };
  }

  return { allowed: true, bypass: false };
}

module.exports = { checkRateLimit, isDevBypass };
