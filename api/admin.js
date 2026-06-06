// api/admin.js — Admin dashboard for user management
const { supabase } = require('./supabase');

module.exports = async function handler(req, res) {
  // Secure with admin key
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    // List all users
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ users: data });
  }

  if (req.method === 'POST') {
    const { action, email } = req.body || {};

    if (action === 'block') {
      const { error } = await supabase
        .from('user_sessions')
        .update({ blocked: true })
        .eq('email', email);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, message: `${email} blocked` });
    }

    if (action === 'unblock') {
      const { error } = await supabase
        .from('user_sessions')
        .update({ blocked: false })
        .eq('email', email);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, message: `${email} unblocked` });
    }

    if (action === 'reset_sessions') {
      const { error } = await supabase
        .from('user_sessions')
        .update({ sessions_used: 0 })
        .eq('email', email);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, message: `${email} sessions reset` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
