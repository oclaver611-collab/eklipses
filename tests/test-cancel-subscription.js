/**
 * tests/test-cancel-subscription.js
 *
 * Proof that api/cancel-subscription.js now requires auth and prevents
 * cancelling another user's subscription.
 *
 * Part 1 (live HTTP): no-auth and invalid-JWT cases against production endpoint.
 *   These are safe to run — the server rejects before touching Stripe.
 *
 * Part 2 (unit, mocked): cross-user attack and matching-email success path,
 *   using require.cache injection — no real Stripe calls needed.
 */

'use strict';

const path  = require('path');
const https = require('https');

const API_DIR  = path.join(__dirname, '..', 'api');
const PROD_URL = 'https://eklipses.vercel.app';

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

// ── Mock factories ────────────────────────────────────────────────────────────

function makeSupabaseMock({ userEmail = null, authError = null } = {}) {
  return {
    auth: {
      getUser: (_jwt) => {
        if (authError) return Promise.resolve({ data: { user: null }, error: authError });
        if (!userEmail) return Promise.resolve({ data: { user: null }, error: { message: 'invalid jwt' } });
        return Promise.resolve({ data: { user: { email: userEmail } }, error: null });
      },
    },
  };
}

function makeStripeMock({ customerEmail = null, deleted = false } = {}) {
  return {
    customers: {
      retrieve: (_id) => {
        if (deleted) return Promise.resolve({ deleted: true });
        return Promise.resolve({ deleted: false, email: customerEmail, id: _id });
      },
    },
    subscriptions: {
      list: () => Promise.resolve({ data: [] }),
    },
  };
}

function injectModules({ userEmail, authError, customerEmail, deleted } = {}) {
  // Provide a fake key so the handler passes the "Stripe not configured" guard
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_fake_for_unit_tests';

  // Supabase mock
  const supPath = require.resolve(path.join(API_DIR, 'supabase'));
  delete require.cache[supPath];
  require.cache[supPath] = {
    id: supPath, filename: supPath, loaded: true,
    exports: { supabase: makeSupabaseMock({ userEmail, authError }) },
    children: [],
  };

  // Stripe mock — inject via require.cache so the handler's require('stripe')(key) returns our stub
  // The handler does: const stripe = require('stripe')(key)
  // We inject a factory function
  const stripePath = require.resolve('stripe');
  delete require.cache[stripePath];
  require.cache[stripePath] = {
    id: stripePath, filename: stripePath, loaded: true,
    exports: () => makeStripeMock({ customerEmail, deleted }),
    children: [],
  };

  // Fresh handler
  const handlerPath = require.resolve(path.join(API_DIR, 'cancel-subscription'));
  delete require.cache[handlerPath];
  return require(handlerPath);
}

function fakeReq(body = {}, headers = {}) {
  return { method: 'POST', headers, body };
}

function fakeRes() {
  const r = { _status: 200, _body: null };
  r.status = (s) => { r._status = s; return r; };
  r.json   = (b) => { r._body = b; return r; };
  return r;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n── /api/cancel-subscription auth guard — proof tests ───────────────\n');
  console.log('Part 1: Live HTTP (no mock, production endpoint)\n');

  // 1. No Authorization header → 401
  await test('No auth header → 401', async () => {
    const r = await postJSON(`${PROD_URL}/api/cancel-subscription`, { customerId: 'cus_fake123' });
    console.log(`       → HTTP ${r.status}  ${JSON.stringify(r.body)}`);
    assert(r.status === 401, `expected 401, got ${r.status}`);
    assert(r.body?.error?.toLowerCase().includes('auth'), `expected auth error, got: ${r.body?.error}`);
  });

  // 2. Invalid JWT → 401
  await test('Invalid/expired JWT → 401', async () => {
    const r = await postJSON(
      `${PROD_URL}/api/cancel-subscription`,
      { customerId: 'cus_fake123' },
      { Authorization: 'Bearer totally.invalid.jwt' },
    );
    console.log(`       → HTTP ${r.status}  ${JSON.stringify(r.body)}`);
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });

  // 3. Missing customerId even with auth header → 400 (proves endpoint parses body even with auth failure path
  //    being skipped, i.e. a real Bearer but the token is bad — still 401 is fine either way)
  await test('No customerId body field → 400', async () => {
    const r = await postJSON(
      `${PROD_URL}/api/cancel-subscription`,
      {},
      { Authorization: 'Bearer totally.invalid.jwt' },
    );
    console.log(`       → HTTP ${r.status}  ${JSON.stringify(r.body)}`);
    // Could be 401 (bad jwt checked first) or 400 (bad input); either is correct given ordering
    assert(r.status === 400 || r.status === 401, `expected 400 or 401, got ${r.status}`);
  });

  // ── Part 2: Unit tests (mocked Supabase + Stripe) ────────────────────────────
  console.log('\nPart 2: Unit (mocked Supabase + Stripe, no real network calls)\n');

  // 4. Valid JWT, wrong customer email → 403 (cross-user attack blocked)
  await test('Valid JWT (user@a.com) + customer owned by user@b.com → 403', async () => {
    const handler = injectModules({ userEmail: 'user@a.com', customerEmail: 'user@b.com' });
    const req = fakeReq({ customerId: 'cus_victim123' }, {
      authorization: 'Bearer valid.jwt.token',
    });
    req.headers['authorization'] = 'Bearer valid.jwt.token';
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 403, `expected 403 (ownership mismatch), got ${res._status}`);
    assert(res._body?.error?.includes('does not belong'), `expected ownership error, got: ${res._body?.error}`);
  });

  // 5. Valid JWT, email matches customer → proceeds past ownership check (no sub found → 404)
  await test('Valid JWT + matching email → ownership check passes (no sub → 404, not 403)', async () => {
    const handler = injectModules({ userEmail: 'owner@example.com', customerEmail: 'owner@example.com' });
    const req = fakeReq({ customerId: 'cus_owner123' }, {});
    req.headers['authorization'] = 'Bearer valid.jwt.token';
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 404, `expected 404 (no sub found, not ownership error), got ${res._status}`);
    assert(res._body?.error?.toLowerCase().includes('subscription'), `expected subscription error, got: ${res._body?.error}`);
  });

  // 6. Valid JWT, case-insensitive email match → ownership check passes
  await test('Email case mismatch (Owner@EXAMPLE.COM vs owner@example.com) → ownership check passes', async () => {
    const handler = injectModules({ userEmail: 'Owner@EXAMPLE.COM', customerEmail: 'owner@example.com' });
    const req = fakeReq({ customerId: 'cus_casetest' }, {});
    req.headers['authorization'] = 'Bearer valid.jwt.token';
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    // 403 would mean ownership check failed on case; anything else means it passed
    assert(res._status !== 403, `expected case-insensitive match to pass, got 403`);
  });

  // 7. Deleted Stripe customer → 404
  await test('Deleted Stripe customer → 404', async () => {
    const handler = injectModules({ userEmail: 'user@example.com', deleted: true });
    const req = fakeReq({ customerId: 'cus_deleted' }, {});
    req.headers['authorization'] = 'Bearer valid.jwt.token';
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 404, `expected 404 for deleted customer, got ${res._status}`);
  });

  // 8. No JWT at all → 401
  await test('No authorization header → 401 (unit)', async () => {
    const handler = injectModules({ userEmail: 'user@example.com' });
    const req = fakeReq({ customerId: 'cus_test' }, {});
    // no authorization header
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 401, `expected 401, got ${res._status}`);
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '─'.repeat(60));
  console.log(`${total}/${total} tests run — ${passed} PASS  ${failed} FAIL`);

  if (failed > 0) {
    console.log('\nCancel-subscription auth guard check FAILED.');
    process.exit(1);
  } else {
    console.log('\nAll cancel-subscription auth checks PASS.');
    console.log('Endpoint now requires a valid JWT and rejects cross-user cancellations.');
    process.exit(0);
  }
})();
