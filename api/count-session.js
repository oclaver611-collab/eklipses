// api/count-session.js — increment session count when a real session ends
const { supabase } = require('./supabase');
const { isDevBypass, isActiveSubscriber, getClientIP } = require('./ratelimit');

const FREE_SESSION_LIMIT = 3;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[count-session] called, exchangeCount:', req.body?.exchangeCount, 'IP:', req.headers['x-forwarded-for'] || req.socket?.remoteAddress);

  if (isDevBypass(req) || await isActiveSubscriber(req)) {
    return res.status(200).json({ allowed: true, sessionsUsed: 0, sessionsRemaining: 999, counted: false });
  }

  const { exchangeCount } = req.body || {};
  if (typeof exchangeCount !== 'number' || exchangeCount < 5) {
    return res.status(200).json({ allowed: true, sessionsUsed: null, sessionsRemaining: null, counted: false });
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
    console.log('[count-session] result:', JSON.stringify(data));

    if (!data) {
      await supabase.from('user_sessions').insert({
        email,
        sessions_used: 1,
        sessions_limit: FREE_SESSION_LIMIT,
        blocked: false,
      });
      return res.status(200).json({
        allowed: true,
        sessionsUsed: 1,
        sessionsRemaining: FREE_SESSION_LIMIT - 1,
        counted: true,
      });
    }

    if (data.sessions_used >= FREE_SESSION_LIMIT) {
      return res.status(200).json({
        allowed: false,
        sessionsUsed: data.sessions_used,
        sessionsRemaining: 0,
        counted: false,
      });
    }

    const newCount = data.sessions_used + 1;
    await supabase
      .from('user_sessions')
      .update({ sessions_used: newCount, updated_at: new Date().toISOString() })
      .eq('email', email);

    return res.status(200).json({
      allowed: newCount < FREE_SESSION_LIMIT,
      sessionsUsed: newCount,
      sessionsRemaining: FREE_SESSION_LIMIT - newCount,
      counted: true,
    });
  } catch (err) {
    console.error('[count-session] error:', err.message);
    return res.status(200).json({ allowed: true, sessionsUsed: null, sessionsRemaining: null, counted: false });
  }
};
