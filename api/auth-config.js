// api/auth-config.js — serves public Supabase credentials to the browser client
// The anon key is safe to expose (security enforced by RLS policies on the DB).
module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const url     = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return res.status(200).json({ url: null, anonKey: null });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ url, anonKey });
};
