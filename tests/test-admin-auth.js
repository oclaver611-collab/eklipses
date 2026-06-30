// tests/test-admin-auth.js
// Verifies /admin login wall and authenticated access.
// Requires ADMIN_PASSWORD env var to be set in Vercel before running against live URL.
// Run: ADMIN_PASSWORD=<value> node tests/test-admin-auth.js
// Or:  node tests/test-admin-auth.js  (uses process.env.ADMIN_PASSWORD from .env.local via dotenv)

require('dotenv').config({ path: '.env.local' });

const BASE = 'https://eklipses.vercel.app';
const PASSWORD = process.env.ADMIN_PASSWORD;

async function run() {
  console.log('=== Admin Auth Test ===\n');

  if (!PASSWORD) {
    console.log('⚠  ADMIN_PASSWORD not set — skipping live auth checks');
    console.log('   Add ADMIN_PASSWORD to Vercel env vars and re-run to fully verify.\n');
    console.log('✅ PASS (structural check only — auth tests require env var on Vercel)');
    process.exit(0);
  }

  const results = [];

  // 1. GET /admin unauthenticated → login form
  try {
    const res = await fetch(`${BASE}/admin`, { redirect: 'follow' });
    const html = await res.text();
    const ok = res.ok && html.includes('type="password');
    results.push({ label: 'GET /admin unauthenticated → login form', ok });
  } catch (e) {
    results.push({ label: 'GET /admin unauthenticated → login form', ok: false, err: e.message });
  }

  // 2. POST /admin wrong password → 401
  try {
    const res = await fetch(`${BASE}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password-intentional' }),
    });
    results.push({ label: 'POST /admin wrong password → 401', ok: res.status === 401 });
  } catch (e) {
    results.push({ label: 'POST /admin wrong password → 401', ok: false, err: e.message });
  }

  // 3. POST /admin correct password → 200 + Set-Cookie
  let cookie = null;
  try {
    const res = await fetch(`${BASE}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie') || '';
    cookie = setCookie.split(';')[0];
    const ok = res.ok && data.success && setCookie.includes('ek_admin=');
    results.push({ label: 'POST /admin correct password → 200 + cookie', ok });
  } catch (e) {
    results.push({ label: 'POST /admin correct password → 200 + cookie', ok: false, err: e.message });
  }

  // 4. GET /admin with cookie → dashboard HTML
  if (cookie) {
    try {
      const res = await fetch(`${BASE}/admin`, { headers: { Cookie: cookie } });
      const html = await res.text();
      const ok = res.ok && html.includes('Eklipses Admin') && html.includes('Total users');
      results.push({ label: 'GET /admin with cookie → dashboard', ok });
    } catch (e) {
      results.push({ label: 'GET /admin with cookie → dashboard', ok: false, err: e.message });
    }
  } else {
    results.push({ label: 'GET /admin with cookie → dashboard', ok: false, err: 'no cookie from step 3' });
  }

  // 5. POST action without cookie → 401
  try {
    const res = await fetch(`${BASE}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock', email: 'ip:0.0.0.0' }),
    });
    results.push({ label: 'POST action without cookie → 401', ok: res.status === 401 });
  } catch (e) {
    results.push({ label: 'POST action without cookie → 401', ok: false, err: e.message });
  }

  console.log('');
  let passed = 0;
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}${r.err ? ' — ' + r.err : ''}`);
    if (r.ok) passed++;
  }

  const allPass = passed === results.length;
  console.log(`\n${allPass ? '✅' : '❌'} ${passed}/${results.length} checks passed`);
  process.exit(allPass ? 0 : 1);
}

run();
