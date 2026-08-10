/**
 * UI audit screenshot capture — LEARN, PRACTICE, lesson player, paywall modal
 * node tests/screenshot-audit.js
 */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE    = 'https://eklipses.vercel.app';
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'audit-shots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });

/** Force-hide all modals/overlays so subsequent interactions aren't blocked */
const closeModals = (page) => page.evaluate(() => {
  ['#practice-focus-modal', '#ek-paywall', '.ek-modal', '.modal-overlay'].forEach(sel => {
    document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
  });
});

async function setupPage(browser, vp = { width: 1280, height: 900 }) {
  const ctx  = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();

  // Mock check-session — allowed by default
  await page.route('**/api/check-session', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ allowed: true, sessionsUsed: 0, sessionsRemaining: 2 }),
  }));

  // First load, set up localStorage, reload
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate((d) => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-daily-v1', JSON.stringify({ date: d, count: 0 }));
    localStorage.removeItem('ek-dev-key');
    localStorage.removeItem('ekDevKey');
  }, today);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  return { ctx, page };
}

async function dismissSplash(page) {
  await page.waitForSelector('#ek-start-btn', { timeout: 20000 });
  await page.locator('#ek-start-btn').click();
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Desktop ────────────────────────────────────────────────────────────────
  const { ctx, page } = await setupPage(browser);

  // 00: Splash
  await shot(page, '00-splash.png');
  await dismissSplash(page);

  // 01-02: LEARN tab
  await page.waitForTimeout(600);
  await shot(page, '01-learn-tab-top.png');
  await page.evaluate(() => window.scrollTo(0, 380));
  await page.waitForTimeout(400);
  await shot(page, '02-learn-tab-scrolled.png');
  await page.evaluate(() => window.scrollTo(0, 0));

  // 03-04: PRACTICE tab (scenario cards + avatar grid)
  await page.locator('#ek-tab-practice').click();
  await page.waitForTimeout(1000);
  await shot(page, '03-practice-tab-top.png');
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(400);
  await shot(page, '04-practice-tab-avatars.png');
  await page.evaluate(() => window.scrollTo(0, 0));

  // 05: Practice focus modal — trigger it by clicking first card
  await page.locator('.nf-card').first().click();
  await page.waitForTimeout(1800);
  await shot(page, '05-practice-focus-modal.png');
  // Force-close so we can proceed
  await closeModals(page);
  await page.waitForTimeout(400);

  // 06: Paywall modal — inject via JS so we don't fight the card-click flow
  // Trigger by raising session count then re-running the rate-limit check pathway
  // Easier: directly show the paywall element if it exists in DOM
  const paywallShown = await page.evaluate(() => {
    const el = document.getElementById('ek-paywall');
    if (el) {
      el.style.display = '';
      el.style.opacity = '1';
      el.classList.remove('hidden');
      return true;
    }
    return false;
  });
  if (paywallShown) {
    await page.waitForTimeout(500);
    await shot(page, '06-paywall-modal.png');
    await closeModals(page);
  } else {
    // Fallback: override mock + set count, click card, use pfm free
    await page.unrouteAll();
    await page.route('**/api/check-session', route => route.fulfill({
      status: 402, contentType: 'application/json',
      body: JSON.stringify({ allowed: false, sessionsUsed: 3, sessionsRemaining: 0 }),
    }));
    const d2 = new Date().toISOString().slice(0, 10);
    await page.evaluate((d) => {
      localStorage.setItem('ek-daily-v1', JSON.stringify({ date: d, count: 3 }));
    }, d2);
    await page.locator('.nf-card').first().click();
    await page.waitForTimeout(2000);
    const pfm = page.locator('#practice-focus-modal button[data-focus="free"]');
    if (await pfm.count() > 0) { await pfm.click(); await page.waitForTimeout(1500); }
    await shot(page, '06-paywall-modal.png');
    await closeModals(page);
  }

  // 07-08: Lesson player
  await page.locator('#ek-tab-learn').click();
  await page.waitForTimeout(800);
  const lessonBtn = page.locator('#ek-start-lesson1');
  if (await lessonBtn.count() > 0) {
    await lessonBtn.click();
    await page.waitForTimeout(3000);
    await shot(page, '07-lesson-player.png');
    await page.evaluate(() => {
      const el = document.querySelector('#ek-lesson-player');
      if (el) el.scrollTop = 260;
    });
    await page.waitForTimeout(400);
    await shot(page, '08-lesson-player-scrolled.png');
  }

  await ctx.close();

  // ── Mobile (390 × 844) ─────────────────────────────────────────────────
  const { ctx: mCtx, page: mPage } = await setupPage(browser, { width: 390, height: 844 });
  await mPage.screenshot({ path: path.join(OUT_DIR, '09-mobile-splash.png') });
  await dismissSplash(mPage);
  await mPage.screenshot({ path: path.join(OUT_DIR, '10-mobile-learn.png') });
  await mPage.locator('#ek-tab-practice').click();
  await mPage.waitForTimeout(900);
  await mPage.screenshot({ path: path.join(OUT_DIR, '11-mobile-practice.png') });
  await mPage.evaluate(() => window.scrollTo(0, 450));
  await mPage.waitForTimeout(400);
  await mPage.screenshot({ path: path.join(OUT_DIR, '12-mobile-avatars.png') });
  await mCtx.close();

  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`\nScreenshots saved to: ${OUT_DIR}`);
  files.forEach(f => console.log(`  ${path.join(OUT_DIR, f)}`));
  process.exit(0);
})().catch(err => { console.error(err.message || err); process.exit(1); });
