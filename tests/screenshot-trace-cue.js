const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, 'trace-cue-placement.png');
const LIVE_URL = 'https://eklipses.vercel.app';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-dev-key', 'ek_dev_2026');
    localStorage.setItem('eklipses_practice_focus', 'lesson5');
    localStorage.setItem('eklipses_lesson5_complete', 'true');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
  await page.click('#ek-start-btn');
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 20000 });
  await page.waitForTimeout(800);

  // Switch to Practice tab
  await page.click('#ek-tab-practice');
  await page.waitForTimeout(800);

  // Start the beach scenario in practice mode — clicking the first nf-card
  const firstCard = await page.locator('.nf-card[data-key]').first();
  const scenarioKey = await firstCard.getAttribute('data-key');
  console.log('[SCREENSHOT] Starting scenario:', scenarioKey);

  // Use the internal API to set up Sofia without triggering full TTS pipeline
  await page.evaluate(({ k }) => {
    try {
      currentScenarioKey = k;
      currentCharacterId = 'sofia';
      const set = AVATAR_SETS ? AVATAR_SETS.find(s => s.id === 'sofia') : null;
      if (set && typeof applyAvatarSet === 'function') applyAvatarSet(set);
      // Switch media to show Sofia's image directly
      if (typeof setMediaForSpeaker === 'function') setMediaForSpeaker('Mary');
    } catch(e) { console.log('setup err:', e.message); }
  }, { k: scenarioKey || 'beach' });
  await page.waitForTimeout(800);

  // Inject the new TraceCue at bottom:80px with opaque card styling
  await page.evaluate(() => {
    const frame = document.getElementById('stageFrame');
    if (!frame) { console.error('stageFrame not found'); return; }
    frame.style.position = 'relative';

    const old = document.getElementById('ek-trace-cue');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'ek-trace-cue';
    el.style.cssText = [
      'position:absolute', 'bottom:80px', 'left:50%',
      'transform:translateX(-50%) translateY(0)',
      'z-index:11', 'max-width:calc(100% - 48px)',
      'text-align:center', 'pointer-events:none', 'opacity:1',
    ].join(';');
    el.innerHTML = '<span style="' + [
      'display:inline-block', 'padding:10px 28px',
      'background:rgba(0,0,0,0.95)',
      'border:1px solid rgba(210,180,120,0.35)',
      'border-radius:8px',
      'box-shadow:0 0 20px rgba(210,180,120,0.12),0 4px 16px rgba(0,0,0,0.80)',
      'font-size:13.5px', 'font-style:italic', 'font-weight:300',
      'color:#d4b882', 'letter-spacing:0.035em', 'line-height:1.55',
    ].join(';') + '">She holds your gaze a beat past where it should have ended.</span>';
    frame.appendChild(el);
    console.log('[SCREENSHOT] TraceCue injected at bottom:80px');
  });

  await page.waitForTimeout(500);

  // Crop to just the stage area for a cleaner shot
  const stageEl = page.locator('.stage').first();
  const box = await stageEl.boundingBox();
  if (box) {
    await page.screenshot({ path: OUT, clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 } });
  } else {
    await page.screenshot({ path: OUT, fullPage: false });
  }
  console.log('[SCREENSHOT] Saved to', OUT);
  await browser.close();
})();
