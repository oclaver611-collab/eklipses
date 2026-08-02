// api/admin.js — Admin dashboard: login + user management + Stripe subscriber view
const crypto = require('crypto');
const { supabase } = require('./supabase');

const COOKIE_NAME    = 'ek_admin';
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24 h

function signToken(password) {
  const expiry  = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `ek_admin:${expiry}`;
  const sig     = crypto.createHmac('sha256', password).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

function verifyToken(token, password) {
  if (!token || !password) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const b64 = token.slice(0, dot);
  const sig  = token.slice(dot + 1);
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
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Stripe data fetch ────────────────────────────────────────────────────────

function subRow(sub) {
  const customer = typeof sub.customer === 'object' && sub.customer ? sub.customer : {};
  return {
    email:              customer.email || '—',
    customerId:         customer.id    || (typeof sub.customer === 'string' ? sub.customer : '—'),
    status:             sub.status,
    startDate:          sub.start_date,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd:   sub.current_period_end,
    cancelAtPeriodEnd:  sub.cancel_at_period_end,
    canceledAt:         sub.canceled_at,
    subscriptionId:     sub.id,
  };
}

async function fetchStripeData() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { subscribers: [], refunds: [], error: 'STRIPE_SECRET_KEY not set' };

  try {
    const stripe = require('stripe')(key);
    const subscribers = [];

    // Active / trialing / past_due — paginate all (usually small)
    for (const status of ['active', 'trialing', 'past_due']) {
      const params = { status, limit: 100, expand: ['data.customer'] };
      let hasMore = true;
      while (hasMore) {
        const page = await stripe.subscriptions.list(params);
        for (const sub of page.data) subscribers.push(subRow(sub));
        hasMore = page.has_more && page.data.length > 0;
        if (hasMore) params.starting_after = page.data[page.data.length - 1].id;
      }
    }

    // Canceled — last 90 days only (created filter avoids fetching all history)
    const since90 = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
    const canceledPage = await stripe.subscriptions.list({
      status: 'canceled', limit: 100, expand: ['data.customer'],
      created: { gte: since90 },
    });
    for (const sub of canceledPage.data) subscribers.push(subRow(sub));

    // Sort: active → trialing → past_due → canceled, then by period end desc
    const ORDER = { active: 0, trialing: 1, past_due: 2, canceled: 3 };
    subscribers.sort((a, b) => {
      const ao = ORDER[a.status] ?? 4;
      const bo = ORDER[b.status] ?? 4;
      if (ao !== bo) return ao - bo;
      return (b.currentPeriodEnd || 0) - (a.currentPeriodEnd || 0);
    });

    // Recent refunds — expand charge → customer for email
    let refunds = [];
    try {
      const refundPage = await stripe.refunds.list({ limit: 20, expand: ['data.charge.customer'] });
      refunds = refundPage.data.map(r => ({
        amount:   r.amount,
        currency: r.currency.toUpperCase(),
        status:   r.status,
        reason:   r.reason || 'not specified',
        created:  r.created,
        email:    r.charge?.customer?.email || '—',
        chargeId: typeof r.charge === 'string' ? r.charge : r.charge?.id || '—',
      }));
    } catch (e) {
      console.warn('[admin] refund fetch skipped:', e.message);
    }

    return { subscribers, refunds, error: null };
  } catch (err) {
    console.error('[admin] Stripe fetch error:', err.message);
    return { subscribers: [], refunds: [], error: err.message };
  }
}

// ── Login page ───────────────────────────────────────────────────────────────

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
  const pw  = document.getElementById('pw').value;
  const btn = document.getElementById('btn');
  const err = document.getElementById('err');
  btn.disabled = true; err.textContent = '';
  try {
    const res  = await fetch(window.location.pathname, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
    const data = await res.json();
    if (data.success) { window.location.reload(); }
    else { err.textContent = data.error || 'Incorrect password'; btn.disabled = false; }
  } catch (e) { err.textContent = 'Network error'; btn.disabled = false; }
}
</script>
</body>
</html>`;
}

// ── Dashboard page ───────────────────────────────────────────────────────────

function dashboardPage(users, stats, stripeData) {
  const activeSubscribers = stripeData.subscribers.filter(s => s.status === 'active' || s.status === 'trialing');

  // ── stat cards ──
  const statsHtml = `
<div class="stats">
  <div class="stat"><div class="sv">${stats.totalUsers}</div><div class="sl">Free users tracked</div></div>
  <div class="stat"><div class="sv">${activeSubscribers.length}</div><div class="sl">Active subscribers</div></div>
  <div class="stat"><div class="sv">${stats.totalSessions}</div><div class="sl">Total sessions logged</div></div>
  <div class="stat"><div class="sv">${stats.avgSessions}</div><div class="sl">Avg sessions / user</div></div>
  <div class="stat"><div class="sv">${stats.atLimit}</div><div class="sl">At free limit</div></div>
  <div class="stat"><div class="sv">${stats.lockedCount}</div><div class="sl">Locked users</div></div>
</div>`;

  // ── Stripe subscriber rows ──
  const stripeRows = stripeData.subscribers.map((s, i) => {
    const rowId = `stripe-${i}`;

    // Status badge
    const badgeClass = { active: 'bf', trialing: 'bt', past_due: 'bw', canceled: 'bl' }[s.status] || 'bl';
    const badgeLabel = { active: 'Active', trialing: 'Trial', past_due: 'Past due', canceled: 'Canceled' }[s.status] || s.status;

    // Next billing: none if canceled or scheduled to cancel
    const nextBilling = (s.status === 'canceled' || s.cancelAtPeriodEnd) ? '—' : fmtDate(s.currentPeriodEnd);

    // Cancellation column
    let cancelCell;
    if (s.canceledAt) {
      cancelCell = `<span style="color:#e05252">Canceled ${fmtDate(s.canceledAt)}</span>`;
    } else if (s.cancelAtPeriodEnd) {
      cancelCell = `<span style="color:#e8a030">Ends ${fmtDate(s.currentPeriodEnd)}</span>`;
    } else {
      cancelCell = '—';
    }

    // Drill-down panel
    const detail = `
<tr id="detail-${rowId}" class="detail-row" style="display:none">
  <td colspan="5" style="padding:14px 18px;background:#0d0d0d;border-bottom:1px solid #222">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px 24px;font-size:12px">
      <div><div class="dl">Customer ID</div><div class="dv mono">${esc(s.customerId)}</div></div>
      <div><div class="dl">Subscription ID</div><div class="dv mono">${esc(s.subscriptionId)}</div></div>
      <div><div class="dl">Subscriber since</div><div class="dv">${fmtDate(s.startDate)}</div></div>
      <div><div class="dl">Current period</div><div class="dv">${fmtDate(s.currentPeriodStart)} → ${fmtDate(s.currentPeriodEnd)}</div></div>
      ${s.canceledAt ? `<div><div class="dl">Canceled at</div><div class="dv" style="color:#e05252">${fmtDate(s.canceledAt)}</div></div>` : ''}
      ${s.cancelAtPeriodEnd && !s.canceledAt ? `<div><div class="dl">Scheduled end</div><div class="dv" style="color:#e8a030">${fmtDate(s.currentPeriodEnd)}</div></div>` : ''}
    </div>
  </td>
</tr>`;

    return `<tr data-expandable="${rowId}" style="cursor:pointer">
  <td class="mono">${esc(s.email)}</td>
  <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
  <td>${fmtDate(s.startDate)}</td>
  <td>${nextBilling}</td>
  <td>${cancelCell}</td>
</tr>${detail}`;
  }).join('');

  // ── Refund rows ──
  const refundRows = stripeData.refunds.map(r => {
    const amt = (r.amount / 100).toFixed(2);
    return `<tr>
  <td class="mono">${esc(r.email)}</td>
  <td>$${amt} ${esc(r.currency)}</td>
  <td><span class="badge ${r.status === 'succeeded' ? 'bf' : 'bl'}">${esc(r.status)}</span></td>
  <td style="color:#777;font-size:12px">${esc(r.reason)}</td>
  <td>${fmtDate(r.created)}</td>
  <td class="mono" style="font-size:10px;color:#444">${esc(r.chargeId)}</td>
</tr>`;
  });

  // ── Free user rows ──
  const userRows = users.map((u, i) => {
    const rowId = `user-${i}`;
    const locked = !!u.blocked;

    const detail = `
<tr id="detail-${rowId}" class="detail-row" style="display:none">
  <td colspan="6" style="padding:14px 18px;background:#0d0d0d;border-bottom:1px solid #222">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px 24px;font-size:12px">
      <div><div class="dl">Identifier</div><div class="dv mono">${esc(u.email)}</div></div>
      <div><div class="dl">Sessions used</div><div class="dv">${u.sessions_used ?? 0} of ${u.sessions_limit ?? '—'}</div></div>
      <div><div class="dl">First seen</div><div class="dv">${fmtDate(u.created_at)}</div></div>
      <div><div class="dl">Last active</div><div class="dv">${fmtDate(u.updated_at)}</div></div>
      <div><div class="dl">Status</div><div class="dv" ${locked ? 'style="color:#e05252"' : ''}>${locked ? 'Locked' : 'Active'}</div></div>
    </div>
    <p style="margin-top:10px;font-size:11px;color:#3a3a3a">Scenario-level history not stored — individual session records would require a session_events log table.</p>
  </td>
</tr>`;

    return `<tr data-expandable="${rowId}" style="cursor:pointer">
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
</tr>${detail}`;
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
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:28px}
.stat{background:#161616;border:1px solid #222;border-radius:7px;padding:18px}
.sv{font-size:26px;font-weight:700;color:#fff}
.sl{font-size:11px;color:#555;margin-top:3px}
h2{font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
table{width:100%;border-collapse:collapse;background:#161616;border:1px solid #222;border-radius:7px;overflow:hidden;font-size:13px}
th{text-align:left;padding:10px 14px;font-size:11px;color:#555;border-bottom:1px solid #222;font-weight:500;text-transform:uppercase;letter-spacing:.05em}
td{padding:10px 14px;border-bottom:1px solid #1a1a1a;vertical-align:middle}
tr[data-expandable]:hover td{background:#141414}
tr[data-expandable].open td{background:#111}
.detail-row td{padding:0}
.mono{font-family:monospace;font-size:11px;color:#999}
.badge{display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700}
.bf{background:#1a2a1a;color:#4caf50}
.bl{background:#2a1a1a;color:#e05252}
.bt{background:#1a2030;color:#5a9fdf}
.bw{background:#2a200a;color:#e8a030}
.ab{padding:3px 10px;border:1px solid #333;border-radius:4px;font-size:11px;cursor:pointer;background:transparent;color:#ccc}
.ab:disabled{opacity:.4;cursor:default}
.bl2:hover{border-color:#e05252;color:#e05252}
.bu:hover{border-color:#4caf50;color:#4caf50}
.br:hover{border-color:#888;color:#fff}
.dl{color:#444;font-size:11px;margin-bottom:3px}
.dv{color:#bbb;font-size:12px}
#toast{position:fixed;bottom:20px;right:20px;background:#222;border:1px solid #333;border-radius:5px;padding:8px 16px;font-size:12px;display:none;z-index:9}
.section{margin-bottom:32px}
.stripe-err{font-size:12px;color:#e05252;margin-bottom:10px}
.note{font-size:11px;color:#444;margin-bottom:10px}
</style>
</head>
<body>
<h1>Eklipses Admin</h1>
<p class="sub">Internal dashboard &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

${statsHtml}

<div class="section">
  <h2>Stripe Subscribers (${stripeData.subscribers.length})</h2>
  ${stripeData.error ? `<p class="stripe-err">Stripe error: ${esc(stripeData.error)}</p>` : ''}
  <p class="note">Click a row to expand subscription details. Canceled subscriptions shown for last 90 days.</p>
  <table>
    <thead><tr>
      <th>Email</th><th>Status</th><th>Since</th><th>Next billing</th><th>Cancellation</th>
    </tr></thead>
    <tbody>${stripeRows || '<tr><td colspan="5" style="color:#444;text-align:center;padding:24px">No subscribers found</td></tr>'}</tbody>
  </table>
</div>

${stripeData.refunds.length ? `
<div class="section">
  <h2>Recent Refunds (${stripeData.refunds.length})</h2>
  <p class="note">Last 20 refunds from Stripe. Charge ID links back to Stripe dashboard.</p>
  <table>
    <thead><tr><th>Customer</th><th>Amount</th><th>Status</th><th>Reason</th><th>Date</th><th>Charge ID</th></tr></thead>
    <tbody>${refundRows.join('')}</tbody>
  </table>
</div>` : ''}

<div class="section">
  <h2>Free Users (${users.length})</h2>
  <p class="note">Identified by IP address. Active subscribers bypass session tracking and don't appear here. Click a row to expand.</p>
  <table>
    <thead><tr>
      <th>Identifier</th><th>Sessions</th><th>Status</th><th>First seen</th><th>Last active</th><th>Actions</th>
    </tr></thead>
    <tbody>${userRows || '<tr><td colspan="6" style="color:#444;text-align:center;padding:24px">No users yet</td></tr>'}</tbody>
  </table>
</div>

<div id="toast"></div>

<script>
// ── Row expand/collapse ──────────────────────────────────────────────────────
document.querySelectorAll('tr[data-expandable]').forEach(row => {
  row.addEventListener('click', function(e) {
    if (e.target.closest('button')) return;
    const detail = document.getElementById('detail-' + this.dataset.expandable);
    if (!detail) return;
    const isOpen = detail.style.display !== 'none';
    detail.style.display = isOpen ? 'none' : 'table-row';
    this.classList.toggle('open', !isOpen);
  });
});

// ── Action buttons ───────────────────────────────────────────────────────────
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
      const res  = await fetch(window.location.pathname, {
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

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).send('ADMIN_PASSWORD env var not set on server');
  }

  // ── POST: login or action ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};

    if ('password' in body && !body.action) {
      if (body.password !== adminPassword) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
      const token = signToken(adminPassword);
      res.setHeader('Set-Cookie',
        `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`);
      return res.status(200).json({ success: true });
    }

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

  // ── GET: render dashboard ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const token = getCookie(req, COOKIE_NAME);
    if (!verifyToken(token, adminPassword)) {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(loginPage());
    }

    const [supabaseResult, stripeData] = await Promise.all([
      supabase
        ? supabase.from('user_sessions').select('*').order('sessions_used', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      fetchStripeData(),
    ]);

    if (supabaseResult.error) {
      return res.status(500).send('Supabase error: ' + supabaseResult.error.message);
    }

    const users         = supabaseResult.data || [];
    const totalUsers    = users.length;
    const totalSessions = users.reduce((s, u) => s + (u.sessions_used || 0), 0);
    const avgSessions   = totalUsers ? (totalSessions / totalUsers).toFixed(1) : '—';
    const lockedCount   = users.filter(u => u.blocked).length;
    const atLimit       = users.filter(u => (u.sessions_used || 0) >= (u.sessions_limit || 2)).length;

    return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(
      dashboardPage(users, { totalUsers, totalSessions, avgSessions, lockedCount, atLimit }, stripeData)
    );
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
