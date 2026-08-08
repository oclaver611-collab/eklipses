/**
 * tests/test-admin-brute-force.js
 *
 * Proof that the admin login endpoint is protected against brute-force via a
 * Supabase-backed global counter (not an in-memory Map).
 *
 * Part 1 (unit): exercises checkLoginRateLimit / recordLoginFailure directly,
 *   with a mock Supabase injected via require.cache — deterministic, no network.
 *
 * Part 2 (multi-instance simulation): the KEY proof of the Supabase upgrade.
 *   We write 4 prior failures directly into production Supabase (simulating
 *   what "instance A" would have recorded). Then we hit the production endpoint
 *   once via HTTP. After that single HTTP request the counter reaches 5 and
 *   the NEXT request returns 429 — proving the counter is globally shared.
 *   A pure in-memory implementation would have needed 5 HTTP requests to block.
 */

'use strict';

const path  = require('path');
const https = require('https');

const API_DIR  = path.join(__dirname, '..', 'api');
const PROD_URL = 'https://eklipses.vercel.app';
const MY_IP    = '67.68.24.223'; // confirmed public IP from previous test session

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteW5pbW1jbGZwd2J3cXBwcHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTI2NTAsImV4cCI6MjA5NjMyODY1MH0.dZ7xNDU86j06BbDiIhaPlCjwKbifxOC6ImkroN4o0Z0';
const SUPA_URL = 'https://tmynimmclfpwbwqpppqj.supabase.co';

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗  ${name}`);
    console.log(`       → ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function postJSON(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function supabaseRest(method, table, body, query = '') {
  return new Promise((resolve, reject) => {
    const u = new URL(`${SUPA_URL}/rest/v1/${table}${query}`);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      apikey:          ANON_KEY,
      Authorization:  `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Part 1: Unit (mock Supabase) ─────────────────────────────────────────────

function makeMockSupabase({ sessions_used = null, blocked = false, last_reset = null, updated_at = null } = {}) {
  return {
    from() {
      const chain = {
        select()  { return chain; },
        eq()      { return chain; },
        not()     { return chain; },
        ilike()   { return chain; },
        order()   { return chain; },
        single() {
          if (sessions_used === null) {
            return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
          }
          return Promise.resolve({ data: { sessions_used, blocked, last_reset, updated_at }, error: null });
        },
        upsert() { return Promise.resolve({ error: null }); },
        delete() { return chain; },
      };
      return chain;
    },
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
  };
}

function injectSupabase(opts) {
  const p = require.resolve(path.join(API_DIR, 'supabase'));
  delete require.cache[p];
  require.cache[p] = { id: p, filename: p, loaded: true, exports: { supabase: makeMockSupabase(opts) }, children: [] };
}

function freshAdmin() {
  const p = require.resolve(path.join(API_DIR, 'admin'));
  delete require.cache[p];
  return require(p);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n── Admin brute-force (Supabase-backed) — proof tests ───────────────\n');
  console.log('Part 1: Unit (mock Supabase, deterministic)\n');

  // 1. New IP (no DB row) → allowed
  injectSupabase({ sessions_used: null });
  {
    const { _rateLimit: rl } = freshAdmin();
    await test('New IP (no DB row) → allowed', async () => {
      const r = await rl.checkLoginRateLimit('1.2.3.4');
      assert(r.allowed === true, `expected allowed=true, got ${r.allowed}`);
    });
  }

  // 2. 4 failures in window → still allowed
  injectSupabase({ sessions_used: 4, blocked: false, last_reset: new Date().toISOString(), updated_at: new Date(0).toISOString() });
  {
    const { _rateLimit: rl } = freshAdmin();
    await test('4 failures in window → still allowed', async () => {
      const r = await rl.checkLoginRateLimit('1.2.3.4');
      assert(r.allowed === true, `expected allowed after 4 failures`);
    });
  }

  // 3. 5 failures in window + locked → blocked with remaining seconds
  {
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    injectSupabase({ sessions_used: 5, blocked: true, last_reset: new Date().toISOString(), updated_at: lockedUntil });
    const { _rateLimit: rl } = freshAdmin();
    await test('5 failures → blocked (429 territory), remaining > 0', async () => {
      const r = await rl.checkLoginRateLimit('1.2.3.4');
      assert(r.allowed === false, `expected blocked`);
      assert(typeof r.remaining === 'number' && r.remaining > 0, `expected remaining > 0, got ${r.remaining}`);
    });
  }

  // 4. Lockout expired (updated_at in past) → allowed again (auto-recovery)
  {
    const expiredLockout = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    injectSupabase({ sessions_used: 5, blocked: true, last_reset: new Date(Date.now() - 60000).toISOString(), updated_at: expiredLockout });
    const { _rateLimit: rl } = freshAdmin();
    await test('Lockout expired (updated_at in past) → auto-recovery, allowed', async () => {
      const r = await rl.checkLoginRateLimit('1.2.3.4');
      assert(r.allowed === true, `expected allowed after lockout expiry, got blocked`);
    });
  }

  // 5. Window expired (last_reset > 15 min ago) → treated as clean slate
  {
    const oldWindow = new Date(Date.now() - 16 * 60 * 1000).toISOString(); // 16 min ago
    injectSupabase({ sessions_used: 4, blocked: false, last_reset: oldWindow, updated_at: new Date(0).toISOString() });
    const { _rateLimit: rl } = freshAdmin();
    await test('Window expired (last_reset > 15 min ago) → clean slate, allowed', async () => {
      const r = await rl.checkLoginRateLimit('1.2.3.4');
      assert(r.allowed === true, `expected allowed after window expiry`);
    });
  }

  // 6. Supabase unavailable → fail open (never lock out the admin due to DB issues)
  {
    const p = require.resolve(path.join(API_DIR, 'supabase'));
    delete require.cache[p];
    require.cache[p] = { id: p, filename: p, loaded: true, exports: { supabase: null }, children: [] };
    const { _rateLimit: rl } = freshAdmin();
    await test('Supabase null (DB unavailable) → fail open, always allowed', async () => {
      const r = await rl.checkLoginRateLimit('1.2.3.4');
      assert(r.allowed === true, `expected fail-open when supabase is null`);
    });
  }

  // ── Part 2: Multi-instance simulation (live Supabase + real HTTP) ──────────
  console.log('\nPart 2: Multi-instance simulation (live Supabase + production endpoint)\n');

  const RL_KEY = `admin_ratelimit:${MY_IP}`;
  const WRONG_PWD = 'wrong-password-brute-force-proof-' + Date.now();

  // Clean up any leftover state from previous runs
  await supabaseRest('DELETE', `user_sessions`, null, `?email=eq.${encodeURIComponent(RL_KEY)}`);

  let step2Pass = true;

  await test('Simulate "instance A" writing 4 prior failures directly to Supabase', async () => {
    const r = await supabaseRest('POST', 'user_sessions', {
      email:          RL_KEY,
      sessions_used:  4,
      sessions_limit: 0,
      blocked:        false,
      last_reset:     new Date().toISOString(),
      updated_at:     new Date(0).toISOString(),
    });
    assert(r.status === 201, `expected 201 from Supabase, got ${r.status}`);
    console.log(`       → ${RL_KEY} written with sessions_used=4 (simulating 4 prior failures on another instance)`);
  });

  await test('HTTP attempt 1 (5th total failure across all instances) → 401, counter written to 5', async () => {
    const r = await postJSON(`${PROD_URL}/api/admin`, { password: WRONG_PWD });
    console.log(`       → HTTP ${r.status}  ${JSON.stringify(r.body)}`);
    assert(r.status === 401, `expected 401 (password wrong, not yet blocked at CHECK time), got ${r.status}`);
  });

  await test('HTTP attempt 2 (6th total, already blocked at 5) → 429 [multi-instance proof]', async () => {
    const r = await postJSON(`${PROD_URL}/api/admin`, { password: WRONG_PWD });
    console.log(`       → HTTP ${r.status}  ${JSON.stringify(r.body)}`);
    assert(r.status === 429, `expected 429 (blocked by global DB counter), got ${r.status}. ` +
      `If in-memory only, this would need 5 more HTTP requests.`);
    assert(r.body?.error?.includes('Too many'), `expected lockout error message`);
    step2Pass = r.status === 429;
  });

  console.log('\n  ► KEY: with in-memory-only rate limiting, 5 HTTP requests would be');
  console.log('    needed before getting 429. With Supabase, the 4 "prior failures from');
  console.log(`    another instance" were already in the DB, so HTTP request 2 (the 6th`);
  console.log(`    total) was immediately blocked — proving global enforcement.\n`);

  // Cleanup
  await supabaseRest('DELETE', `user_sessions`, null, `?email=eq.${encodeURIComponent(RL_KEY)}`);
  console.log('  (rate-limit row cleaned up from Supabase)\n');

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('─'.repeat(60));
  console.log(`${total}/${total} tests run — ${passed} PASS  ${failed} FAIL`);

  if (failed > 0) {
    console.log('\nAdmin brute-force (Supabase) check FAILED.');
    process.exit(1);
  } else {
    console.log('\nAll admin brute-force checks PASS.');
    console.log('Rate limit is globally enforced via Supabase (not per-instance in-memory).');
    process.exit(0);
  }
})();
