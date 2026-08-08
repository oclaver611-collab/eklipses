/**
 * tests/test-webhook.js
 *
 * Proof that api/webhook.js:
 *   (a) verifies Stripe signatures and rejects tampered/missing ones
 *   (b) on a valid invoice.payment_failed event, writes blocked=true to Supabase
 *   (c) on a valid customer.subscription.updated with status=active, clears revocation
 *   (d) on a valid customer.subscription.deleted, revokes access
 *
 * Signature generation uses Node's crypto module with Stripe's exact HMAC-SHA256
 * algorithm (t=<timestamp>,v1=<hex-sig>) so no real Stripe credentials are needed.
 *
 * Part 1: unit tests — mocked Supabase, deterministic, no network.
 * Part 2: live HTTP — endpoint existence and signature rejection, no STRIPE_WEBHOOK_SECRET needed.
 */

'use strict';

const path   = require('path');
const crypto = require('crypto');
const https  = require('https');
const { Readable } = require('stream');

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

// Stripe's webhook signature algorithm:
//   signed_payload = "<timestamp>.<json_payload>"
//   sig = HMAC-SHA256(key=secret, data=signed_payload)
//   header = "t=<timestamp>,v1=<hex_sig>"
function generateStripeHeader(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

// Build a minimal Stripe event object of the given type.
function makeEvent(type, data) {
  return JSON.stringify({
    id:      'evt_test_' + Date.now(),
    object:  'event',
    type,
    livemode: false,
    data: { object: data },
  });
}

// Create a fake Node.js readable stream that behaves like an HTTP request body.
function fakeReq(body, headers = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const stream = Readable.from([raw]);
  stream.method  = 'POST';
  stream.headers = headers;
  return stream;
}

function fakeRes() {
  const r = { _status: 200, _body: null };
  r.status = (s)  => { r._status = s; return r; };
  r.json   = (b)  => { r._body = b;  return r; };
  r.end    = ()   => r;
  return r;
}

// ── Mock factory ──────────────────────────────────────────────────────────────

const TEST_SECRET      = 'whsec_test_webhook_proof_secret_1234';
const TEST_STRIPE_KEY  = 'sk_test_fake_for_unit_tests';
const FAKE_CUSTOMER_ID = 'cus_webhook_proof_' + Date.now();

// Track upsert calls so we can assert on them.
let lastUpsert = null;

function makeSupabaseMock() {
  return {
    from() {
      const chain = {
        upsert(row) {
          lastUpsert = row;
          return Promise.resolve({ error: null });
        },
        select()  { return chain; },
        eq()      { return chain; },
        single()  { return Promise.resolve({ data: null, error: null }); },
        delete()  { return chain; },
      };
      return chain;
    },
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
  };
}

function injectMocks() {
  lastUpsert = null;

  // Supabase
  const supPath = require.resolve(path.join(API_DIR, 'supabase'));
  delete require.cache[supPath];
  require.cache[supPath] = {
    id: supPath, filename: supPath, loaded: true,
    exports: { supabase: makeSupabaseMock() }, children: [],
  };

  // Stripe — return a client whose webhooks.constructEvent does real HMAC verification
  // using the standard algorithm (same as the real Stripe library) so signature tests
  // are meaningful without network calls.
  const stripePath = require.resolve('stripe');
  delete require.cache[stripePath];
  require.cache[stripePath] = {
    id: stripePath, filename: stripePath, loaded: true,
    exports: () => ({
      webhooks: {
        constructEvent(rawBody, sig, secret) {
          // Replicate Stripe's verification: parse t= and v1= from header,
          // compute expected sig, compare with timing-safe equality.
          const sigStr   = typeof sig === 'string' ? sig : '';
          const tMatch   = sigStr.match(/t=(\d+)/);
          const v1Match  = sigStr.match(/v1=([a-f0-9]+)/);
          if (!tMatch || !v1Match) throw new Error('Invalid signature header format');
          const timestamp = tMatch[1];
          const received  = v1Match[1];
          const body      = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
          const expected  = crypto.createHmac('sha256', secret)
            .update(`${timestamp}.${body}`, 'utf8').digest('hex');
          let match = false;
          try {
            match = crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
          } catch { match = false; }
          if (!match) throw new Error('No signatures found matching the expected signature for payload');
          return JSON.parse(body);
        },
      },
    }),
    children: [],
  };

  // Set env vars needed by the handler
  process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
  process.env.STRIPE_SECRET_KEY     = TEST_STRIPE_KEY;

  // Fresh handler
  const handlerPath = require.resolve(path.join(API_DIR, 'webhook'));
  delete require.cache[handlerPath];
  return require(handlerPath);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n── api/webhook.js — proof tests ────────────────────────────────────\n');
  console.log('Part 1: Unit (mocked Stripe sig verification + mocked Supabase)\n');

  // 1. invoice.payment_failed with valid signature → blocked=true written to DB
  await test('invoice.payment_failed (valid sig) → Supabase upsert with blocked=true', async () => {
    const handler = injectMocks();
    const payload = makeEvent('invoice.payment_failed', { customer: FAKE_CUSTOMER_ID });
    const sig     = generateStripeHeader(payload, TEST_SECRET);
    const req     = fakeReq(payload, { 'stripe-signature': sig });
    const res     = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 200, `expected 200, got ${res._status}`);
    assert(res._body?.handled === true, `expected handled=true`);
    assert(res._body?.revoked === true, `expected revoked=true`);
    assert(lastUpsert !== null, `expected Supabase upsert to be called`);
    assert(lastUpsert.email === `stripe:${FAKE_CUSTOMER_ID}`, `expected email=stripe:${FAKE_CUSTOMER_ID}, got ${lastUpsert?.email}`);
    assert(lastUpsert.blocked === true, `expected blocked=true in DB, got ${lastUpsert?.blocked}`);
  });

  // 2. Tampered signature → 400 (the security gate)
  await test('Tampered signature → 400 (webhook rejected)', async () => {
    const handler = injectMocks();
    const payload = makeEvent('invoice.payment_failed', { customer: FAKE_CUSTOMER_ID });
    const tampered = 't=9999999999,v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const req = fakeReq(payload, { 'stripe-signature': tampered });
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 400, `expected 400, got ${res._status}`);
    assert(res._body?.error?.includes('signature'), `expected signature error, got: ${res._body?.error}`);
    assert(lastUpsert === null, `DB must NOT be updated on bad signature`);
  });

  // 3. Missing stripe-signature header → 400
  await test('Missing stripe-signature header → 400', async () => {
    const handler = injectMocks();
    const payload = makeEvent('invoice.payment_failed', { customer: FAKE_CUSTOMER_ID });
    const req = fakeReq(payload, {}); // no stripe-signature
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 400, `expected 400, got ${res._status}`);
    assert(lastUpsert === null, `DB must NOT be updated when header is missing`);
  });

  // 4. customer.subscription.deleted → blocked=true
  await test('customer.subscription.deleted (valid sig) → blocked=true', async () => {
    const handler = injectMocks();
    const payload = makeEvent('customer.subscription.deleted', {
      customer: FAKE_CUSTOMER_ID,
      status:   'canceled',
    });
    const sig = generateStripeHeader(payload, TEST_SECRET);
    const req = fakeReq(payload, { 'stripe-signature': sig });
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 200 && res._body?.handled === true, `expected handled`);
    assert(lastUpsert?.blocked === true, `expected blocked=true for subscription.deleted`);
  });

  // 5. customer.subscription.updated with status=active → blocked=false (restore access)
  await test('subscription.updated status=active (valid sig) → blocked=false (access restored)', async () => {
    const handler = injectMocks();
    const payload = makeEvent('customer.subscription.updated', {
      customer: FAKE_CUSTOMER_ID,
      status:   'active',
    });
    const sig = generateStripeHeader(payload, TEST_SECRET);
    const req = fakeReq(payload, { 'stripe-signature': sig });
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 200 && res._body?.handled === true, `expected handled`);
    assert(lastUpsert?.blocked === false, `expected blocked=false for status=active`);
    assert(res._body?.revoked === false, `expected revoked=false in response`);
  });

  // 6. customer.subscription.updated with status=past_due → blocked=true
  await test('subscription.updated status=past_due (valid sig) → blocked=true', async () => {
    const handler = injectMocks();
    const payload = makeEvent('customer.subscription.updated', {
      customer: FAKE_CUSTOMER_ID,
      status:   'past_due',
    });
    const sig = generateStripeHeader(payload, TEST_SECRET);
    const req = fakeReq(payload, { 'stripe-signature': sig });
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 200 && res._body?.handled === true, `expected handled`);
    assert(lastUpsert?.blocked === true, `expected blocked=true for status=past_due`);
  });

  // 7. Unhandled event type → 200 with handled=false (Stripe stops retrying)
  await test('Unhandled event type → 200 acknowledged, handled=false', async () => {
    const handler = injectMocks();
    const payload = makeEvent('payment_intent.created', { id: 'pi_test' });
    const sig = generateStripeHeader(payload, TEST_SECRET);
    const req = fakeReq(payload, { 'stripe-signature': sig });
    const res = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 200, `expected 200 for unhandled event (so Stripe doesn't retry)`);
    assert(res._body?.handled === false, `expected handled=false`);
  });

  // 8. Valid payload but STRIPE_WEBHOOK_SECRET not set → 500
  await test('STRIPE_WEBHOOK_SECRET not configured → 500', async () => {
    const handler = injectMocks();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const payload = makeEvent('invoice.payment_failed', { customer: FAKE_CUSTOMER_ID });
    const sig     = generateStripeHeader(payload, TEST_SECRET);
    const req     = fakeReq(payload, { 'stripe-signature': sig });
    const res     = fakeRes();
    await handler(req, res);
    console.log(`       → HTTP ${res._status}  ${JSON.stringify(res._body)}`);
    assert(res._status === 500, `expected 500 when secret missing, got ${res._status}`);
    // Restore
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
  });

  // ── Part 2: Live HTTP (production endpoint) ──────────────────────────────────
  console.log('\nPart 2: Live HTTP (production endpoint — no STRIPE_WEBHOOK_SECRET needed)\n');

  // 9. POST with no body and no signature → 400 (endpoint exists and checks signature)
  await test('POST with no stripe-signature → 400 (endpoint live, rejects unsigned)', async () => {
    const result = await new Promise((resolve, reject) => {
      const payload = '{}';
      const req = https.request({
        hostname: 'eklipses.vercel.app',
        path:     '/api/webhook',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
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
    console.log(`       → HTTP ${result.status}  ${JSON.stringify(result.body)}`);
    // 400 = signature missing; 500 = STRIPE_WEBHOOK_SECRET not yet set in prod (expected before dashboard setup)
    assert(result.status === 400 || result.status === 500, `expected 400 or 500, got ${result.status}`);
    if (result.status === 500) {
      console.log('       ℹ  500 = STRIPE_WEBHOOK_SECRET not yet set in Vercel (expected — see dashboard setup steps below)');
    } else {
      console.log('       ✓  Endpoint requires stripe-signature; unsigned payloads are rejected');
    }
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '─'.repeat(60));
  console.log(`${total}/${total} tests run — ${passed} PASS  ${failed} FAIL`);

  if (failed > 0) {
    console.log('\nWebhook proof FAILED.');
    process.exit(1);
  } else {
    console.log('\nAll webhook proof tests PASS.');
    console.log('\n⚠  MANUAL STEP REQUIRED to complete finding 5:');
    console.log('   1. Go to https://dashboard.stripe.com/webhooks');
    console.log('   2. "Add endpoint" → URL: https://eklipses.vercel.app/api/webhook');
    console.log('   3. Select events: invoice.payment_failed,');
    console.log('                     customer.subscription.deleted,');
    console.log('                     customer.subscription.updated');
    console.log('   4. Copy the "Signing secret" (starts with whsec_)');
    console.log('   5. Vercel dashboard → Settings → Environment Variables → add:');
    console.log('         STRIPE_WEBHOOK_SECRET = <whsec_...>  (Production + Preview)');
    console.log('   6. Run: deploy.bat "config: add STRIPE_WEBHOOK_SECRET to Vercel"');
    process.exit(0);
  }
})();
