// Quick proof test: POST /api/create-checkout in test mode and confirm cs_test_... session URL
// Run: node tests/test-checkout-api.js <preview-url>
// Expects STRIPE_SECRET_KEY=sk_test_... + STRIPE_PRO_PRICE_ID_TEST/STRIPE_ELITE_PRICE_ID_TEST on the server.

const BASE = process.argv[2] || 'https://eklipses-1hmfkpaqu-oclaver611-collabs-projects.vercel.app';

async function testPlan(plan) {
  const res = await fetch(`${BASE}/api/create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ plan, email: 'stripe-test@example.com' }),
  });
  const data = await res.json();
  const ok = res.ok && data.url && data.url.startsWith('https://checkout.stripe.com/c/pay/cs_test_');
  console.log(`[${plan}] ${ok ? 'PASS' : 'FAIL'} — ${data.url || data.error}`);
  if (!ok) process.exitCode = 1;
}

(async () => {
  console.log(`Testing against: ${BASE}`);
  await testPlan('pro');
  await testPlan('elite');
})();
