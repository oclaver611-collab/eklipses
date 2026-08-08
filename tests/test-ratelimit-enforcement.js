/**
 * tests/test-ratelimit-enforcement.js
 *
 * Unit proof that checkRateLimit() actually enforces the free-session limit
 * and that unprotected endpoints (character-stream, coach, drill-eval, etc.)
 * return 402 for callers who have exhausted their free sessions.
 *
 * Uses require.cache injection — no HTTP server, no Playwright, no Supabase
 * credentials needed. Runs standalone with: node tests/test-ratelimit-enforcement.js
 */

'use strict';

const path = require('path');

const API_DIR = path.join(__dirname, '..', 'api');

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeMockSupabase({ sessionsUsed = null, blocked = false, authEmail = null } = {}) {
  return {
    from() {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async single() {
          if (sessionsUsed === null) {
            // Simulates PGRST116: no row found — new user with 0 sessions
            return { data: null, error: { code: 'PGRST116', message: 'no rows found' } };
          }
          return { data: { sessions_used: sessionsUsed, blocked }, error: null };
        },
      };
      return chain;
    },
    auth: {
      async getUser(jwt) {
        if (authEmail && jwt) return { data: { user: { email: authEmail } }, error: null };
        return { data: { user: null }, error: new Error('Invalid JWT') };
      },
    },
  };
}

function injectMockSupabase(opts) {
  const resolved = require.resolve(path.join(API_DIR, 'supabase'));
  delete require.cache[resolved];
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: { supabase: makeMockSupabase(opts) },
    children: [],
  };
}

function freshRatelimit() {
  const resolved = require.resolve(path.join(API_DIR, 'ratelimit'));
  delete require.cache[resolved];
  return require(resolved);
}

function freshHandler(name) {
  const resolved = require.resolve(path.join(API_DIR, name));
  delete require.cache[resolved];
  // Also clear ratelimit so it re-resolves supabase from cache
  const rlPath = require.resolve(path.join(API_DIR, 'ratelimit'));
  delete require.cache[rlPath];
  // Re-load ratelimit first so it picks up the mock supabase
  require(rlPath);
  return require(resolved);
}

function makeReq({ ip = '10.0.0.1', xDevKey = null, xStripeCustomer = null, xUserEmail = null, authorization = null, body = {} } = {}) {
  return {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
      'content-type': 'application/json',
      ...(xDevKey ? { 'x-dev-key': xDevKey } : {}),
      ...(xStripeCustomer ? { 'x-stripe-customer': xStripeCustomer } : {}),
      ...(xUserEmail ? { 'x-user-email': xUserEmail } : {}),
      ...(authorization ? { 'authorization': authorization } : {}),
    },
    query: {},
    socket: { remoteAddress: ip },
    body: { userMessage: 'test', scenarioKey: 'beach', characterId: 'sofia', history: [], ...body },
  };
}

function makeRes() {
  const r = {
    _status: 200,
    _body: null,
    _ended: false,
    status(code) { r._status = code; return r; },
    json(body) { r._body = body; r._ended = true; return r; },
    setHeader() { return r; },
    write() {},
    end() { r._ended = true; },
  };
  return r;
}

// ── Test runner ───────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n── Rate-limit enforcement — unit tests ──────────────────────────────\n');

  // 1. New user (no DB row) → allowed
  injectMockSupabase({ sessionsUsed: null });
  {
    const { checkRateLimit } = freshRatelimit();
    await test('New user (no DB row) → allowed', async () => {
      const req = makeReq({ ip: '1.2.3.4' });
      const res = makeRes();
      const result = await checkRateLimit(req, res);
      assert(result.allowed === true, `expected allowed=true, got ${result.allowed}`);
      assert(res._status === 200, `expected no error sent, got status ${res._status}`);
    });
  }

  // 2. User with 1 session (below limit) → allowed
  injectMockSupabase({ sessionsUsed: 1 });
  {
    const { checkRateLimit } = freshRatelimit();
    await test('1 session used (under FREE_SESSION_LIMIT=2) → allowed', async () => {
      const req = makeReq({ ip: '1.2.3.5' });
      const res = makeRes();
      const result = await checkRateLimit(req, res);
      assert(result.allowed === true, `expected allowed=true, got ${result.allowed}`);
    });
  }

  // 3. User with 2 sessions (AT limit) → 402 [THE EXPLOIT CASE]
  injectMockSupabase({ sessionsUsed: 2 });
  {
    const { checkRateLimit, FREE_SESSION_LIMIT } = freshRatelimit();
    await test('2 sessions used (AT FREE_SESSION_LIMIT) → 402 Payment Required [exploit path blocked]', async () => {
      const req = makeReq({ ip: '99.99.99.99' });
      const res = makeRes();
      const result = await checkRateLimit(req, res);
      assert(result.allowed === false, `expected allowed=false`);
      assert(res._status === 402, `expected status 402, got ${res._status}`);
      assert(typeof res._body?.error === 'string' && res._body.error.includes('limit reached'),
        `expected limit-reached error in body, got: ${JSON.stringify(res._body)}`);
      assert(res._body?.sessionsUsed === 2, `expected sessionsUsed=2 in body`);
      assert(res._body?.limit === FREE_SESSION_LIMIT, `expected limit=${FREE_SESSION_LIMIT} in body`);
    });
  }

  // 4. Blocked user → 403
  injectMockSupabase({ sessionsUsed: 0, blocked: true });
  {
    const { checkRateLimit } = freshRatelimit();
    await test('Blocked user (sessions_used=0 but blocked=true) → 403 Forbidden', async () => {
      const req = makeReq({ ip: '5.5.5.5' });
      const res = makeRes();
      const result = await checkRateLimit(req, res);
      assert(result.allowed === false, `expected allowed=false`);
      assert(res._status === 403, `expected status 403, got ${res._status}`);
    });
  }

  // 5. Dev bypass overrides the limit
  injectMockSupabase({ sessionsUsed: 2 }); // at limit
  {
    process.env.DEV_BYPASS_KEY = 'test-dev-secret-xyz';
    const { checkRateLimit } = freshRatelimit();
    await test('Dev bypass header → allowed even with 2 sessions used', async () => {
      const req = makeReq({ ip: '99.99.99.99', xDevKey: 'test-dev-secret-xyz' });
      const res = makeRes();
      const result = await checkRateLimit(req, res);
      assert(result.allowed === true, `expected allowed=true for dev bypass`);
      assert(result.bypass === 'dev', `expected bypass='dev', got '${result.bypass}'`);
    });
    delete process.env.DEV_BYPASS_KEY;
  }

  // 6. TEST_EMAILS_BYPASS overrides the limit (3D fix: requires verified JWT, not just header)
  injectMockSupabase({ sessionsUsed: 2, authEmail: 'tester@example.com' }); // at limit
  {
    process.env.TEST_EMAILS_BYPASS = 'tester@example.com';
    const { checkRateLimit } = freshRatelimit();
    await test('TEST_EMAILS_BYPASS account with valid JWT → allowed even with 2 sessions used', async () => {
      const req = makeReq({ ip: '99.99.99.99', authorization: 'Bearer mock-valid-jwt' });
      const res = makeRes();
      const result = await checkRateLimit(req, res);
      assert(result.allowed === true, `expected allowed=true for test account`);
      assert(result.bypass === 'test', `expected bypass='test', got '${result.bypass}'`);
    });
    delete process.env.TEST_EMAILS_BYPASS;
  }

  // 7. character-stream handler returns 402 for capped user (direct API exploit path)
  injectMockSupabase({ sessionsUsed: 2 });
  {
    const handler = freshHandler('character-stream');
    await test('/api/character-stream → 402 when user is past session limit (direct HTTP exploit blocked)', async () => {
      const req = makeReq({ ip: '99.99.99.99' });
      const res = makeRes();
      await handler(req, res);
      assert(res._status === 402, `expected 402 from character-stream, got ${res._status}`);
      assert(res._body?.error?.includes('limit reached'),
        `expected limit-reached error in body, got: ${JSON.stringify(res._body)}`);
    });
  }

  // 8. coach.js handler returns 402 for capped user
  injectMockSupabase({ sessionsUsed: 2 });
  {
    const handler = freshHandler('coach');
    await test('/api/coach → 402 when user is past session limit', async () => {
      const req = makeReq({ ip: '99.99.99.99' });
      const res = makeRes();
      await handler(req, res);
      assert(res._status === 402, `expected 402 from coach, got ${res._status}`);
    });
  }

  // 9. drill-eval.js handler returns 402 for capped user
  injectMockSupabase({ sessionsUsed: 2 });
  {
    const handler = freshHandler('drill-eval');
    await test('/api/drill-eval → 402 when user is past session limit', async () => {
      const req = makeReq({ ip: '99.99.99.99' });
      const res = makeRes();
      await handler(req, res);
      assert(res._status === 402, `expected 402 from drill-eval, got ${res._status}`);
    });
  }

  // 10. coach-suggest.js handler returns 402 for capped user
  injectMockSupabase({ sessionsUsed: 2 });
  {
    const handler = freshHandler('coach-suggest');
    await test('/api/coach-suggest → 402 when user is past session limit', async () => {
      const req = makeReq({ ip: '99.99.99.99' });
      const res = makeRes();
      await handler(req, res);
      assert(res._status === 402, `expected 402 from coach-suggest, got ${res._status}`);
    });
  }

  // 11. elevenlabs.js handler returns 402 for capped user
  injectMockSupabase({ sessionsUsed: 2 });
  {
    const handler = freshHandler('elevenlabs');
    await test('/api/elevenlabs → 402 when user is past session limit', async () => {
      const req = makeReq({ ip: '99.99.99.99' });
      const res = makeRes();
      await handler(req, res);
      assert(res._status === 402, `expected 402 from elevenlabs, got ${res._status}`);
    });
  }

  // 12. mary.js handler returns 402 for capped user (finding 3F — newly added)
  injectMockSupabase({ sessionsUsed: 2 });
  {
    const handler = freshHandler('mary');
    await test('/api/mary → 402 when user is past session limit', async () => {
      const req = makeReq({ ip: '99.99.99.99' });
      const res = makeRes();
      await handler(req, res);
      assert(res._status === 402, `expected 402 from mary, got ${res._status}`);
      assert(res._body?.error?.includes('limit reached'),
        `expected limit-reached error in body, got: ${JSON.stringify(res._body)}`);
    });
  }

  // 13. coach-moment.js handler returns 402 for capped user (finding 3F — newly added)
  injectMockSupabase({ sessionsUsed: 2 });
  {
    const handler = freshHandler('coach-moment');
    await test('/api/coach-moment → 402 when user is past session limit', async () => {
      const req = makeReq({ ip: '99.99.99.99' });
      const res = makeRes();
      await handler(req, res);
      assert(res._status === 402, `expected 402 from coach-moment, got ${res._status}`);
      assert(res._body?.error?.includes('limit reached'),
        `expected limit-reached error in body, got: ${JSON.stringify(res._body)}`);
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '─'.repeat(60));
  console.log(`${total}/${total} tests run — ${passed} PASS  ${failed} FAIL`);

  if (failed > 0) {
    console.log('\nRate-limit enforcement FAILED — do not deploy.');
    process.exit(1);
  } else {
    console.log('\nAll rate-limit enforcement checks PASS.');
    console.log('Direct API exploit path (character-stream/coach/drill-eval/coach-suggest/elevenlabs/mary/coach-moment');
    console.log('past the session limit) is confirmed blocked with HTTP 402.');
    process.exit(0);
  }
})();
