// api/check-session.js — read session count without incrementing
const { supabase } = require('./supabase');
const { isDevBypass, isActiveSubscriber, getClientIP, isTestAccount } = require('./ratelimit');

const FREE_SESSION_LIMIT = 2;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (isDevBypass(req) || isTestAccount(req) || await isActiveSubscriber(req)) {
    return res.status(200).json({ allowed: true, sessionsUsed: 0, sessionsRemaining: 999 });
  }

  const ip = getClientIP(req);
  const email = `ip:${ip}`;

  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('sessions_used')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const sessionsUsed = data?.sessions_used || 0;
    const allowed = sessionsUsed < FREE_SESSION_LIMIT;

    return res.status(200).json({
      allowed,
      sessionsUsed,
      sessionsRemaining: Math.max(0, FREE_SESSION_LIMIT - sessionsUsed),
    });
  } catch (err) {
    console.error('[check-session] error:', err.message);
    return res.status(200).json({ allowed: true, sessionsUsed: 0, sessionsRemaining: FREE_SESSION_LIMIT });
  }
};
