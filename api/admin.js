// api/admin.js — Admin dashboard: login form + user management + aggregate stats
const crypto = require('crypto');
const { supabase } = require('./supabase');

const COOKIE_NAME = 'ek_admin';
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24h seconds

function signToken(password) {
  const expiry = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `ek_admin:${expiry}`;
  const sig = crypto.createHmac('sha256', password).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

function verifyToken(token, password) {
  if (!token || !password) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload;
  try { payload = Buffer.from(b64, 'base64').toString(); } catch { return false; }
  const expected = crypto.createHmac('sha256', password).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return false;
  } catch { return false; }
  const expiry = parseInt(payload.split(':')[1], 10);
  return Number.isFinite(expiry) && Date.now() < expiry;
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return part.slice(idx + 1).trim();
  }
  return null;
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eklipses Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#161616;border:1px solid #2a2a2a;border-radius:8px;padding:40px;width:320px}
h1{font-size:17px;font-weight:600;margin-bottom:24px;color:#fff}
label{display:block;font-size:12px;color:#777;margin-bottom:6px}
input[type=password]{width:100%;padding:9px 12px;background:#0a0a0a;border:1px solid #333;border-radius:5px;color:#e5e5e5;font-size:14px;outline:none}
input[type=password]:focus{border-color:#555}
button{margin-top:14px;width:100%;padding:10px;background:#e5e5e5;color:#0a0a0a;border:none;border-radius:5px;font-size:13px;font-weight:600;cursor:pointer}
button:hover{background:#fff}
button:disabled{opacity:.5;cursor:default}
.err{margin-top:10px;font-size:12px;color:#e05252}
</style>
</head>
<body>
<div class="card">
  <h1>Eklipses Admin</h1>
  <label for="pw">Password</label>
  <input type="password" id="pw" autofocus>
  <button id="btn" onclick="login()">Sign in</button>
  <p class="err" id="err">${error ? esc(error) : ''}</p>
</div>
<script>
document.getElementById('pw').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
async function login() {
  const pw = document.getElementById('pw').value;
  const btn = document.getElementById('btn');
  const err = document.getElementById('err');
  btn.disabled = true;
  err.textContent = '';
  try {
    const res = await fetch(window.location.pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json();
    if (data.success) { window.location.reload(); }
    else { err.textContent = data.error || 'Incorrect password'; btn.disabled = false; }
  } catch (e) { err.textContent = 'Network error'; btn.disabled = false; }
}
</script>
</body>
</html>`;
}

function dashboardPage(users, stats) {
  const fmtDate = ts => ts
    ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const rows = users.map(u => {
    const locked = !!u.blocked;
    return `<tr>
      <td class="mono">${esc(u.email)}</td>
      <td>${u.sessions_used ?? 0} / ${u.sessions_limit ?? '—'}</td>
      <td><span class="badge ${locked ? 'bl' : 'bf'}">${locked ? 'Locked' : 'Free'}</span></td>
      <td>${fmtDate(u.created_at)}</td>
      <td>${fmtDate(u.updated_at)}</td>
      <td>
        <button class="ab ${locked ? 'bu' : 'bl2'}" data-email="${esc(u.email)}" data-action="${locked ? 'unlock' : 'lock'}">
          ${locked ? 'Unlock' : 'Lock'}
        </button>
        <button class="ab br" data-email="${esc(u.email)}" data-action="reset_sessions" style="margin-left:4px">Reset</button>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eklipses Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif;padding:32px 40px}
h1{font-size:19px;font-weight:600;margin-bottom:4px}
.sub{font-size:12px;color:#555;margin-bottom:28px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:28px}
.stat{background:#161616;border:1px solid #222;border-radius:7px;padding:18px}
.sv{font-size:26px;font-weight:700;color:#fff}
.sl{font-size:11px;color:#555;margin-top:3px}
h2{font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
table{width:100%;border-collapse:collapse;background:#161616;border:1px solid #222;border-radius:7px;overflow:hidden;font-size:13px}
th{text-align:left;padding:10px 14px;font-size:11px;color:#555;border-bottom:1px solid #222;font-weight:500;text-transform:uppercase;letter-spacing:.05em}
td{padding:10px 14px;border-bottom:1px solid #1a1a1a}
tr:last-child td{border-bottom:none}
tr:hover td{background:#1a1a1a}
.mono{font-family:monospace;font-size:11px;color:#999}
.badge{display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700}
.bf{background:#1a2a1a;color:#4caf50}.bl{background:#2a1a1a;color:#e05252}
.ab{padding:3px 10px;border:1px solid #333;border-radius:4px;font-size:11px;cursor:pointer;background:transparent;color:#ccc}
.ab:disabled{opacity:.4;cursor:default}
.bl2:hover{border-color:#e05252;color:#e05252}
.bu:hover{border-color:#4caf50;color:#4caf50}
.br:hover{border-color:#888;color:#fff}
#toast{position:fixed;bottom:20px;right:20px;background:#222;border:1px solid #333;border-radius:5px;padding:8px 16px;font-size:12px;display:none;z-index:9}
.section{margin-bottom:28px}
</style>
</head>
<body>
<h1>Eklipses Admin</h1>
<p class="sub">Internal dashboard &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

<div class="stats">
  <div class="stat"><div class="sv">${stats.totalUsers}</div><div class="sl">Total users</div></div>
  <div class="stat"><div class="sv">${stats.totalSessions}</div><div class="sl">Total sessions logged</div></div>
  <div class="stat"><div class="sv">${stats.avgSessions}</div><div class="sl">Avg sessions / user</div></div>
  <div class="stat"><div class="sv">${stats.atLimit}</div><div class="sl">At free limit</div></div>
  <div class="stat"><div class="sv">${stats.lockedCount}</div><div class="sl">Locked users</div></div>
</div>

<div class="section">
  <h2>Users (${users.length})</h2>
  <p style="font-size:11px;color:#444;margin-bottom:10px">Identifiers are IP-based (ip:x.x.x.x) for free users. Subscription status lives in Stripe — not mirrored here yet.</p>
  <table>
    <thead><tr>
      <th>Identifier</th><th>Sessions</th><th>Status</th><th>Joined</th><th>Last active</th><th>Actions</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="color:#444;text-align:center;padding:24px">No users yet</td></tr>'}</tbody>
  </table>
</div>

<div id="toast"></div>
<script>
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3000);
}
document.querySelectorAll('.ab').forEach(btn => {
  btn.addEventListener('click', async () => {
    const { email, action } = btn.dataset;
    btn.disabled = true;
    try {
      const res = await fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email }),
      });
      const data = await res.json();
      if (data.success) { toast(data.message || 'Done'); setTimeout(() => location.reload(), 900); }
      else { toast('Error: ' + (data.error || 'unknown')); btn.disabled = false; }
    } catch (e) { toast('Error: ' + e.message); btn.disabled = false; }
  });
});
</script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).send('ADMIN_PASSWORD env var not set on server');
  }

  // ── POST ────────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};

    // Login attempt: has password field, no action
    if ('password' in body && !body.action) {
      if (body.password !== adminPassword) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
      const token = signToken(adminPassword);
      res.setHeader('Set-Cookie',
        `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`);
      return res.status(200).json({ success: true });
    }

    // Authenticated action: lock / unlock / reset_sessions
    const token = getCookie(req, COOKIE_NAME);
    if (!verifyToken(token, adminPassword)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    const { action, email } = body;
    if (!email) return res.status(400).json({ error: 'email required' });

    if (action === 'lock') {
      const { error } = await supabase.from('user_sessions').update({ blocked: true }).eq('email', email);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, message: `${email} locked` });
    }
    if (action === 'unlock') {
      const { error } = await supabase.from('user_sessions').update({ blocked: false }).eq('email', email);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, message: `${email} unlocked` });
    }
    if (action === 'reset_sessions') {
      const { error } = await supabase.from('user_sessions').update({ sessions_used: 0 }).eq('email', email);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, message: `${email} sessions reset` });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const token = getCookie(req, COOKIE_NAME);
    if (!verifyToken(token, adminPassword)) {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(loginPage());
    }

    if (!supabase) {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(
        dashboardPage([], { totalUsers: 0, totalSessions: 0, avgSessions: '—', lockedCount: 0, atLimit: 0 })
      );
    }

    const { data: users, error } = await supabase
      .from('user_sessions')
      .select('*')
      .order('sessions_used', { ascending: false });

    if (error) return res.status(500).send('Supabase error: ' + error.message);

    const totalUsers = users.length;
    const totalSessions = users.reduce((s, u) => s + (u.sessions_used || 0), 0);
    const avgSessions = totalUsers ? (totalSessions / totalUsers).toFixed(1) : '—';
    const lockedCount = users.filter(u => u.blocked).length;
    const atLimit = users.filter(u => (u.sessions_used || 0) >= (u.sessions_limit || 2)).length;

    return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(
      dashboardPage(users, { totalUsers, totalSessions, avgSessions, lockedCount, atLimit })
    );
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
