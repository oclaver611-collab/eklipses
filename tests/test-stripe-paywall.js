// tests/test-stripe-paywall.js
// Verifies the paywall shows both Pro and Elite plan cards after 3 sessions.
//
// Reset note: /api/admin supports { action:'reset_sessions', email:'ip:<your-ip>' }
// with x-admin-key header, but requires ADMIN_KEY env var on Vercel (not currently set).
// This test handles the case where sessions are already exhausted and skips to the UI check.

const { chromium } = require('playwright');

const BASE = 'https://eklipses.vercel.app';

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function exhaustSessions() {
  const check = await fetchJSON(`${BASE}/api/check-session`);
  console.log(`   Current: sessionsUsed=${check.sessionsUsed}, allowed=${check.allowed}`);

  const needed = Math.max(0, 3 - (check.sessionsUsed || 0));
  if (needed === 0) {
    console.log('   Already at limit — skipping count-session calls');
    return;
  }

  for (let i = 0; i < needed; i++) {
    const data = await fetchJSON(`${BASE}/api/count-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeCount: 10 }),
    });
    console.log(`   count-session ${i + 1}/${needed}: sessionsUsed=${data.sessionsUsed}, allowed=${data.allowed}`);
  }

  const after = await fetchJSON(`${BASE}/api/check-session`);
  if (after.allowed !== false) {
    throw new Error(`Sessions not exhausted after counting — got allowed=${after.allowed}. ` +
      'IP mismatch between Node.js and browser? Try running on the same network.');
  }
  console.log('   Sessions exhausted (allowed=false) ✓');
}

async function run() {
  let browser;
  let passed = false;
  const errors = [];

  try {
    console.log('=== Paywall Test: Pro + Elite plan cards ===\n');

    // ── Step 1: exhaust sessions via direct API calls ──────────────────────────
    console.log('1. Exhausting sessions via /api/count-session...');
    await exhaustSessions();

    // ── Step 2: open browser, skip onboarding, load scenario shelf ────────────
    console.log('\n2. Launching browser (no dev bypass)...');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });

    // Pre-set localStorage so onboarding is already "seen" and no pro subscription
    await page.addInitScript(() => {
      localStorage.setItem('ek-onboarding-v1', '1');
      localStorage.removeItem('ek-stripe-cus');
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Bypass the Kokoro preload overlay — remove it via JS and render the shelf directly.
    // The deployed site loads a WASM model which hangs in headless mode.
    console.log('   Bypassing start overlay...');
    await page.waitForSelector('#ek-start-overlay', { state: 'attached', timeout: 15000 });
    await page.evaluate(() => {
      const overlay = document.getElementById('ek-start-overlay');
      if (overlay) overlay.remove();
      if (typeof renderShelf === 'function') renderShelf();
    });

    // ── Step 3: wait for scenario shelf ───────────────────────────────────────
    console.log('3. Waiting for scenario cards...');
    // Use 'attached' — cards exist in DOM but may be off-screen in headless viewport
    await page.waitForSelector('.sc-card', { state: 'attached', timeout: 10000 });
    const cardCount = await page.locator('.sc-card').count();
    console.log(`   Found ${cardCount} scenario card(s) ✓`);

    // ── Step 4: trigger playScenario on first card ─────────────────────────────
    // Use evaluate to bypass Playwright visibility check — layout puts shelf off-screen headlessly
    console.log('4. Triggering first scenario...');
    const clicked = await page.evaluate(() => {
      const card = document.querySelector('.sc-card');
      if (!card) return false;
      card.click();
      return true;
    });
    if (!clicked) throw new Error('No .sc-card found to click');

    // ── Step 5: wait for paywall ───────────────────────────────────────────────
    console.log('5. Waiting for paywall (up to 10s)...');
    await page.waitForSelector('#ek-paywall', { timeout: 10000 });
    console.log('   Paywall appeared ✓');

    // ── Step 6: check both plan cards ─────────────────────────────────────────
    console.log('6. Checking plan cards...');
    const paywallHTML = await page.locator('#ek-paywall').innerHTML();

    const checks = {
      'Pro label':        paywallHTML.includes('>Pro<'),
      'Pro price $19.99': paywallHTML.includes('$19.99'),
      'Pro button':       await page.locator('.ek-plan-btn[data-plan="pro"]').isVisible(),
      'Elite label':      paywallHTML.includes('>Elite<'),
      'Elite price $39.99': paywallHTML.includes('$39.99'),
      'Elite button':     await page.locator('.ek-plan-btn[data-plan="elite"]').isVisible(),
    };

    for (const [label, ok] of Object.entries(checks)) {
      console.log(`   ${ok ? '✅' : '❌'} ${label}`);
      if (!ok) errors.push(label);
    }

    passed = errors.length === 0;

  } catch (err) {
    console.log(`\n❌ FATAL: ${err.message}`);
    errors.push(err.message);
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n' + '─'.repeat(44));
  if (passed) {
    console.log('✅ PASS — Both Pro and Elite plan cards present');
  } else {
    console.log('❌ FAIL');
    for (const e of errors) console.log(`   • ${e}`);
  }

  process.exit(passed ? 0 : 1);
}

run();
