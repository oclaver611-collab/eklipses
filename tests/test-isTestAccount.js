/**
 * tests/test-isTestAccount.js
 *
 * Proof that isTestAccount() in api/ratelimit.js:
 *   (a) Rejects a spoofed x-user-email header when no valid JWT is present
 *   (b) Rejects an invalid / expired JWT even if email would otherwise match
 *   (c) Grants bypass for a real authenticated JWT whose email is in TEST_EMAILS_BYPASS
 *   (d) Rejects a real JWT whose email is NOT in the bypass list
 *
 * All tests are unit-level (mocked Supabase).
 */

'use strict';

const path = require('path');

const API_DIR = path.join(__dirname, '..', 'api');

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

// ── Mock factory ──────────────────────────────────────────────────────────────

const TEST_EMAIL    = 'okoladonga@gmail.com';
const NON_TEST_EMAIL = 'regular@example.com';
const FAKE_JWT_GOOD = 'valid.jwt.for.test.account';
const FAKE_JWT_BAD  = 'valid.jwt.for.regular.account';
const FAKE_JWT_INVALID = 'garbage.jwt.that.fails.verification';

// Build a Supabase mock whose auth.getUser() returns different users per token.
function makeSupabaseMock(tokenToEmailMap) {
  return {
    from() { return this; },
    auth: {
      async getUser(jwt) {
        const email = tokenToEmailMap[jwt];
        if (!email) return { data: { user: null }, error: new Error('Invalid JWT') };
        return { data: { user: { email } }, error: null };
      },
    },
  };
}

function injectRatelimit(tokenToEmailMap, { bypassEmails = TEST_EMAIL } = {}) {
  // Inject Supabase mock
  const supPath = require.resolve(path.join(API_DIR, 'supabase'));
  delete require.cache[supPath];
  require.cache[supPath] = {
    id: supPath, filename: supPath, loaded: true,
    exports: { supabase: makeSupabaseMock(tokenToEmailMap) },
    children: [],
  };

  // Set env var so isTestAccount() has something to check against
  process.env.TEST_EMAILS_BYPASS = bypassEmails;

  // Fresh ratelimit module
  const rlPath = require.resolve(path.join(API_DIR, 'ratelimit'));
  delete require.cache[rlPath];
  return require(rlPath);
}

function makeReq({ authorization, userEmail } = {}) {
  const headers = {};
  if (authorization) headers['authorization'] = authorization;
  if (userEmail)     headers['x-user-email']  = userEmail;
  return { headers };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n── isTestAccount() — proof tests (finding 3D) ──────────────────────\n');

  // 1. Spoofed x-user-email header, no Authorization header → rejected
  await test('Spoofed x-user-email without JWT → NOT a test account', async () => {
    const { isTestAccount } = injectRatelimit({
      [FAKE_JWT_GOOD]: TEST_EMAIL,
    });
    // Attacker sends only x-user-email, no Authorization
    const req    = makeReq({ userEmail: TEST_EMAIL });
    const result = await isTestAccount(req);
    console.log(`       → isTestAccount: ${result}`);
    assert(result === false, `expected false — header-only spoofing must be rejected`);
  });

  // 2. No Authorization header at all → rejected
  await test('No Authorization header → NOT a test account', async () => {
    const { isTestAccount } = injectRatelimit({});
    const req    = makeReq({});
    const result = await isTestAccount(req);
    console.log(`       → isTestAccount: ${result}`);
    assert(result === false, `expected false`);
  });

  // 3. Invalid / garbage JWT → Supabase returns error → rejected
  await test('Invalid JWT → Supabase verification fails → NOT a test account', async () => {
    const { isTestAccount } = injectRatelimit({
      // FAKE_JWT_INVALID is not in the map → getUser returns error
    });
    const req    = makeReq({ authorization: `Bearer ${FAKE_JWT_INVALID}` });
    const result = await isTestAccount(req);
    console.log(`       → isTestAccount: ${result}`);
    assert(result === false, `expected false — invalid JWT must be rejected`);
  });

  // 4. Valid JWT for a non-bypass email → allowed: false
  await test('Valid JWT but email NOT in bypass list → NOT a test account', async () => {
    const { isTestAccount } = injectRatelimit({
      [FAKE_JWT_BAD]: NON_TEST_EMAIL,
    });
    const req    = makeReq({ authorization: `Bearer ${FAKE_JWT_BAD}` });
    const result = await isTestAccount(req);
    console.log(`       → isTestAccount: ${result} (email=${NON_TEST_EMAIL})`);
    assert(result === false, `expected false — non-bypass email must not get bypass`);
  });

  // 5. Valid JWT for the whitelisted test email → allowed: true
  await test('Valid JWT for bypass email → IS a test account', async () => {
    const { isTestAccount } = injectRatelimit({
      [FAKE_JWT_GOOD]: TEST_EMAIL,
    });
    const req    = makeReq({ authorization: `Bearer ${FAKE_JWT_GOOD}` });
    const result = await isTestAccount(req);
    console.log(`       → isTestAccount: ${result} (email=${TEST_EMAIL})`);
    assert(result === true, `expected true — authenticated test account must get bypass`);
  });

  // 6. Spoofed x-user-email + valid JWT for NON-bypass email → rejected
  //    (attacker adds spoofed header hoping it takes precedence — it must not)
  await test('Spoofed x-user-email + JWT for wrong email → rejected', async () => {
    const { isTestAccount } = injectRatelimit({
      [FAKE_JWT_BAD]: NON_TEST_EMAIL,
    });
    // Attacker sends both the spoofed header AND a valid-but-wrong JWT
    const req    = makeReq({ authorization: `Bearer ${FAKE_JWT_BAD}`, userEmail: TEST_EMAIL });
    const result = await isTestAccount(req);
    console.log(`       → isTestAccount: ${result}`);
    assert(result === false, `expected false — JWT email governs, not x-user-email header`);
  });

  // 7. TEST_EMAILS_BYPASS env var empty → short-circuit, no JWT check needed
  await test('Empty TEST_EMAILS_BYPASS → always false, no JWT verification', async () => {
    const { isTestAccount } = injectRatelimit({ [FAKE_JWT_GOOD]: TEST_EMAIL }, { bypassEmails: '' });
    const req    = makeReq({ authorization: `Bearer ${FAKE_JWT_GOOD}` });
    const result = await isTestAccount(req);
    console.log(`       → isTestAccount: ${result}`);
    assert(result === false, `expected false — no bypass emails configured`);
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '─'.repeat(60));
  console.log(`${total}/${total} tests run — ${passed} PASS  ${failed} FAIL`);

  if (failed > 0) {
    console.log('\nFinding 3D proof FAILED.');
    process.exit(1);
  } else {
    console.log('\nAll finding 3D proof tests PASS.');
    console.log('Spoofed x-user-email header is rejected; JWT-verified test accounts still work.');
    process.exit(0);
  }
})();
