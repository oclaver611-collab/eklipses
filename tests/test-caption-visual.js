// tests/test-caption-visual.js
// Visual regression test: bold-yellow captions + mnemonic pill
//
// Simulates a rapid-fire drill rep (multiple caption changes in quick succession)
// while the mnemonic pill is visible, then:
//   (a) screenshots both elements visible together
//   (b) screenshots mid-transition between two captions
//   (c) screenshots end of rapid-fire sequence
//   (d) reports bounding-box overlap between #ek-caption and #mnemonic-pill
//
// Run: node tests/test-caption-visual.js
// Screenshots saved to: test-results/caption-visual/

'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT   = path.resolve(__dirname, '..');
// Use production — local server can't render the stageFrame layout without
// all assets (images, CSS grid, etc.) that the production bundle provides.
const BASE           = 'https://eklipses.vercel.app';
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'test-results', 'caption-visual');

// ─── helpers ─────────────────────────────────────────────────────────────────
function rects(a, b) {
  // Returns overlap pixels (0 = no overlap, >0 = overlap area in px²)
  const xOverlap = Math.max(0, Math.min(a.right,  b.right)  - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top,  b.top));
  return { xOverlap, yOverlap, area: xOverlap * yOverlap };
}

async function getBounds(page) {
  return page.evaluate(() => {
    const caption = document.getElementById('ek-caption');
    const pill    = document.getElementById('mnemonic-pill');
    const pillCollapsed = document.getElementById('mnemonic-pill-collapsed');

    const captionRect = caption?.getBoundingClientRect();
    const pillRect    = pill?.getBoundingClientRect();
    const pillVisible = pill ? getComputedStyle(pill).display !== 'none' : false;
    const captionVisible = caption
      ? (parseFloat(getComputedStyle(caption).opacity) > 0 && caption.textContent.trim() !== '')
      : false;

    return {
      caption: captionRect ? {
        top: captionRect.top, left: captionRect.left,
        bottom: captionRect.bottom, right: captionRect.right,
        width: captionRect.width, height: captionRect.height,
        opacity: parseFloat(getComputedStyle(caption).opacity),
        text: caption.textContent.trim(),
        visible: captionVisible,
      } : null,
      pill: pillRect ? {
        top: pillRect.top, left: pillRect.left,
        bottom: pillRect.bottom, right: pillRect.right,
        width: pillRect.width, height: pillRect.height,
        display: getComputedStyle(pill).display,
        visible: pillVisible,
      } : null,
    };
  });
}

// ─── main ────────────────────────────────────────────────────────────────────
async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const overlapResults = [];

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    // Skip onboarding + set dev-bypass key so the paywall doesn't block
    await page.addInitScript(() => {
      localStorage.setItem('ek-onboarding-v1', '1');
      localStorage.setItem('eklipses_lesson1_complete', 'true');
      localStorage.setItem('eklipses_practice_focus', 'lesson1');
      localStorage.setItem('ek-dev-key', 'ek_dev_2026');
      localStorage.removeItem('eklipses_mnemonic_off');
      localStorage.removeItem('eklipses_mnemonic_expanded');
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    // Stub KokoroSpeech BEFORE clicking start — the onclick handler calls
    // KokoroSpeech.preload() immediately; if we stub after the click we miss it.
    await page.waitForSelector('#ek-start-btn', { timeout: 8000 });
    await page.evaluate(() => {
      if (window.KokoroSpeech) {
        window.KokoroSpeech.preload  = async () => {};
        window.KokoroSpeech.speak    = async () => {};
        window.KokoroSpeech.prefetch = async () => null;
        window.KokoroSpeech.cancel   = () => {};
      }
    });

    // Dismiss splash — preload now resolves immediately so overlay removes
    await page.click('#ek-start-btn');
    await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 8000 });

    // Let the boot sequence settle (setMediaForSpeaker, renderShelf, etc.)
    await page.waitForTimeout(500);

    // The scenario player lives in the PRACTICE tab (#ek-practice-wrap, display:none
    // by default). Switch to it so stageFrame renders with real dimensions.
    await page.click('#ek-tab-practice');
    await page.waitForFunction(
      () => document.getElementById('ek-practice-wrap')?.style.display !== 'none',
      { timeout: 5000 }
    );

    // setMediaForSpeaker('Ryan') replaces #media with the Ryan orb which gets
    // position:absolute when has-bg is applied. Force has-bg (height:520px via CSS)
    // so the caption is positioned as it would be during a real background scenario.
    await page.evaluate(() => {
      const frame = document.getElementById('stageFrame');
      if (frame) {
        frame.classList.add('has-bg');
        const bg = document.getElementById('sceneBg');
        if (bg) { bg.style.background = '#1a1c22'; bg.classList.remove('hidden'); }
      }
    });

    const frameInfo = await page.evaluate(() => {
      const f = document.getElementById('stageFrame');
      if (!f) return { missing: true };
      const r = f.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) };
    });
    console.log(`stageFrame: w=${frameInfo.w} h=${frameInfo.h}  (top=${frameInfo.top} left=${frameInfo.left})`);

    // Force mnemonic pill visible and caption module ready
    await page.evaluate(() => {
      // Show the mnemonic pill (normally shown when practice mode starts)
      showMnemonicPill('lesson1');
    });

    // ── RAPID-FIRE DRILL SIMULATION ───────────────────────────────────────────
    // Simulate several Mary lines arriving in quick succession (as they would
    // during a coaching drill rep — character responds, caption updates).

    const lines = [
      'Hi there. I don\'t think I\'ve seen you here before.',
      'You look like you\'re waiting for someone.',
      'That\'s a bold opener — I like it.',
      'Tell me more. What made you come over?',
      'Honestly? That actually made me smile.',
    ];

    // ── Screenshot (a): caption + mnemonic pill both visible together ─────────
    await page.evaluate((text) => Caption.show(text), lines[0]);
    await page.waitForTimeout(120); // let opacity transition settle

    const bounds_a = await getBounds(page);
    const shot_a = path.join(SCREENSHOT_DIR, 'a-both-visible.png');
    await page.screenshot({ path: shot_a, fullPage: false });
    const overlap_a = bounds_a.caption && bounds_a.pill
      ? rects(bounds_a.caption, bounds_a.pill)
      : { area: -1, note: 'element missing' };
    overlapResults.push({ shot: 'a-both-visible', ...overlap_a, captionVisible: bounds_a.caption?.visible, pillVisible: bounds_a.pill?.visible });
    console.log(`[a] caption visible=${bounds_a.caption?.visible} opacity=${bounds_a.caption?.opacity}  pill visible=${bounds_a.pill?.visible}`);
    console.log(`    caption: top=${Math.round(bounds_a.caption?.top)} bottom=${Math.round(bounds_a.caption?.bottom)} left=${Math.round(bounds_a.caption?.left)}`);
    console.log(`    pill:    top=${Math.round(bounds_a.pill?.top)}    bottom=${Math.round(bounds_a.pill?.bottom)} left=${Math.round(bounds_a.pill?.left)}`);
    console.log(`    overlap area: ${overlap_a.area}px²  (xOverlap=${overlap_a.xOverlap}px, yOverlap=${overlap_a.yOverlap}px)`);

    // ── Rapid-fire: push lines 1→4 in quick succession ───────────────────────
    await page.evaluate((text) => Caption.show(text), lines[1]);
    await page.waitForTimeout(40);
    await page.evaluate((text) => Caption.show(text), lines[2]);
    await page.waitForTimeout(30);

    // ── Screenshot (b): mid-transition — new caption just set, transition in progress
    await page.evaluate((text) => Caption.show(text), lines[3]);
    await page.waitForTimeout(60); // within 200ms transition window

    const bounds_b = await getBounds(page);
    const shot_b = path.join(SCREENSHOT_DIR, 'b-mid-transition.png');
    await page.screenshot({ path: shot_b, fullPage: false });
    const overlap_b = bounds_b.caption && bounds_b.pill
      ? rects(bounds_b.caption, bounds_b.pill)
      : { area: -1, note: 'element missing' };
    overlapResults.push({ shot: 'b-mid-transition', ...overlap_b, captionVisible: bounds_b.caption?.visible, pillVisible: bounds_b.pill?.visible });
    console.log(`\n[b] caption="${bounds_b.caption?.text?.slice(0,40)}..." opacity=${bounds_b.caption?.opacity}`);
    console.log(`    overlap area: ${overlap_b.area}px²`);

    // Final line in the drill rep
    await page.evaluate((text) => Caption.show(text), lines[4]);
    await page.waitForTimeout(200);

    // ── Screenshot (c): end of rapid-fire sequence, then hide ────────────────
    await page.evaluate(() => Caption.hide());
    await page.waitForTimeout(280); // past the 250ms text-clear timer

    const bounds_c = await getBounds(page);
    const shot_c = path.join(SCREENSHOT_DIR, 'c-end-of-sequence.png');
    await page.screenshot({ path: shot_c, fullPage: false });
    const overlap_c = bounds_c.caption && bounds_c.pill
      ? rects(bounds_c.caption, bounds_c.pill)
      : { area: -1, note: 'element missing' };
    overlapResults.push({ shot: 'c-end-of-sequence', ...overlap_c, captionVisible: bounds_c.caption?.visible, pillVisible: bounds_c.pill?.visible });
    console.log(`\n[c] caption visible=${bounds_c.caption?.visible} opacity=${bounds_c.caption?.opacity}  (should be hidden)`);
    console.log(`    overlap area: ${overlap_c.area}px² (should be 0 — caption hidden)`);

    // ── MOBILE VIEWPORT: repeat overlap check at 390×844 ─────────────────────
    // The pill is fixed at bottom:80px left:16px; on narrow screens the
    // caption (bottom of stageFrame) may be closer to the pill.
    console.log('\n── Mobile viewport check (390×844) ─────────────────────');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate((text) => Caption.show(text), lines[0]);
    await page.waitForTimeout(150);

    const bounds_m = await getBounds(page);
    const shot_m = path.join(SCREENSHOT_DIR, 'd-mobile-both-visible.png');
    await page.screenshot({ path: shot_m, fullPage: false });
    const overlap_m = bounds_m.caption && bounds_m.pill
      ? rects(bounds_m.caption, bounds_m.pill)
      : { area: -1, note: 'element missing' };
    overlapResults.push({ shot: 'd-mobile-both-visible', ...overlap_m, captionVisible: bounds_m.caption?.visible, pillVisible: bounds_m.pill?.visible });
    console.log(`[m] caption: top=${Math.round(bounds_m.caption?.top)} bottom=${Math.round(bounds_m.caption?.bottom)}`);
    console.log(`    pill:    top=${Math.round(bounds_m.pill?.top)}    bottom=${Math.round(bounds_m.pill?.bottom)}`);
    console.log(`    overlap area: ${overlap_m.area}px²`);

    await page.close();

  } finally {
    await browser.close();
  }

  // ── Final report ─────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  OVERLAP REPORT');
  console.log('══════════════════════════════════════════════════════════');
  let anyOverlap = false;
  for (const r of overlapResults) {
    const flag = r.area > 0 ? '⚠ OVERLAP' : '✓ clear';
    console.log(`  ${flag}  ${r.shot}  — area=${r.area}px²`);
    if (r.area > 0) anyOverlap = true;
  }
  console.log('\nScreenshots:');
  console.log(`  ${path.join('test-results', 'caption-visual', 'a-both-visible.png')}`);
  console.log(`  ${path.join('test-results', 'caption-visual', 'b-mid-transition.png')}`);
  console.log(`  ${path.join('test-results', 'caption-visual', 'c-end-of-sequence.png')}`);
  console.log(`  ${path.join('test-results', 'caption-visual', 'd-mobile-both-visible.png')}`);
  console.log('══════════════════════════════════════════════════════════\n');

  process.exit(anyOverlap ? 1 : 0);
}

run().catch(err => { console.error('Runner error:', err); process.exit(1); });
