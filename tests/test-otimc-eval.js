// tests/test-otimc-eval.js
// Drives a full Sofia beach session with lesson1Complete=true, sending 5 OTIMC messages.
// Captures Ryan's full coach feedback including the lesson1Eval OTIMC scorecard.
// Run: node tests/test-otimc-eval.js

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

// Check package.json for dev script
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const hasDevScript = !!(pkg.scripts && pkg.scripts.dev);
const baseArg = process.argv.find(a => a.startsWith('--base='));
const BASE = baseArg ? baseArg.slice(7) : hasDevScript ? 'http://localhost:3000' : 'https://eklipses.vercel.app';

const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const verFlag = process.argv.find(a => /^--v\d+$/.test(a));
const V2 = verFlag ? `-${verFlag.slice(2)}` : '';

// 5 OTIMC messages — O → T → M → I → C
const OTIMC_MESSAGES = [
  { skill: 'O — Observation opener',
    text:  "You've been out here writing the whole time — is it something you actually care about, or just a deadline pushing you?" },
  { skill: 'T — Tease',
    text:  "That sounds like the polished version. I get the feeling the real one is more interesting." },
  { skill: 'M — Mystery',
    text:  "Depends on the day. Today it's following whatever pulls you somewhere and seeing what happens." },
  { skill: 'I — Imply',
    text:  "You know where this conversation could go. I'm curious whether you want to find out." },
  { skill: 'C — Close',
    text:  "Come get a coffee with me." },
];

// Wait for Sofia's response after dispatching a test:speech event.
// Uses _testBusy flag (local dev server) when available; falls back to DOM polling (production).
async function waitForSofiaResponse(page, timeoutMs = 60000) {
  const hasTestBusy = await page.evaluate(() => typeof window._testBusy !== 'undefined');
  if (hasTestBusy) {
    // Local player.js: async test:speech handler sets _testBusy true → false
    await page.waitForFunction(() => window._testBusy === true,  null, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => window._testBusy === false, null, { timeout: timeoutMs });
    return page.locator('#lineText').textContent().catch(() => '');
  }
  // Production fallback: wait for #lineText to change then stabilize for 5s
  // NOTE: pass null as arg so { timeout } is treated as options, not arg
  await page.evaluate(() => {
    window._sfLastText = document.getElementById('lineText')?.textContent || '';
    window._sfStableStart = Date.now();
  });
  await page.waitForFunction(() => {
    const text = document.getElementById('lineText')?.textContent || '';
    return text !== window._sfLastText || text === '...';
  }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => {
    const text = document.getElementById('lineText')?.textContent || '';
    if (text !== window._sfLastText) { window._sfLastText = text; window._sfStableStart = Date.now(); return false; }
    return text.length > 15 && text !== '...' && !text.includes('Analyzing') && Date.now() - window._sfStableStart > 5000;
  }, null, { timeout: timeoutMs });
  return page.locator('#lineText').textContent().catch(() => '');
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  OTIMC EVAL — Sofia beach, lesson1Complete=true');
  console.log(`  Target: ${BASE}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  let capturedCoachResponse = null;
  const consoleLogs = [];
  const chatLog = [];

  const headless = process.argv.includes('--headless');
  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 30,
    args: ['--use-fake-audio-for-tests', '--use-fake-ui-for-media-stream'],
  });
  const context = await browser.newContext();

  // Inject localStorage BEFORE any page JS runs
  await context.addInitScript(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-dev-key', 'ek_dev_2026');
    localStorage.setItem('eklipses_lesson1_complete', 'true');
  });

  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    // Print coach/session logs only — suppress noisy TTS/prefetch
    if (
      text.includes('[coach]') || text.includes('[FC]') ||
      text.includes('lesson1') || text.includes('score=') ||
      text.includes('DailyLimit') || text.includes('error')
    ) {
      process.stdout.write('  PAGE: ' + text + '\n');
    }
  });

  // Capture /api/coach JSON response
  page.on('response', async resp => {
    if (
      resp.url().includes('/api/coach') &&
      !resp.url().includes('suggest') &&
      !resp.url().includes('check')
    ) {
      try {
        const body = await resp.json();
        capturedCoachResponse = body;
        console.log('\n[TEST] /api/coach response captured — score:', body.score);
        console.log('[TEST] lesson1Eval:', body.lesson1Eval ? 'PRESENT ✓' : 'MISSING ✗');
        console.log('[TEST] lesson1Check:', body.lesson1Check ? 'PRESENT ✓' : 'MISSING ✗');
      } catch (e) {
        console.log('[TEST] /api/coach parse failed:', e.message);
      }
    }
  });

  // ── 1. Navigate ───────────────────────────────────────────────────────────
  console.log('[TEST] Loading page...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // ── 2. Splash ─────────────────────────────────────────────────────────────
  console.log('[TEST] Waiting for start button...');
  await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
  await page.locator('#ek-start-btn').click();
  console.log('[TEST] Start clicked — waiting for KokoroSpeech to load (up to 90s)...');
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 90000 });
  console.log('[TEST] App ready');
  await page.waitForTimeout(2000);

  // ── 3. Start beach scenario directly via JS ───────────────────────────────
  // The Practice tab may be behind a paywall overlay — bypass via direct call.
  // playScenario calls DailyLimit.canPlay() which returns true for dev bypass.
  console.log('[TEST] Starting beach scenario via playScenario()...');
  await page.evaluate(() => {
    // Dismiss any blocking overlays that might intercept clicks
    ['ek-paywall-overlay', 'ek-style-selector', 'ek-coach-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    playScenario('beach', true);
  });

  // ── 4. Style selector ─────────────────────────────────────────────────────
  console.log('[TEST] Waiting for style selector...');
  await page.waitForSelector('#ek-style-selector', { timeout: 10000 });
  await page.locator('[data-style="curious"]').click();
  console.log('[TEST] Style "Curious" selected');

  // ── 5. Wait for intro to finish ───────────────────────────────────────────
  // Ryan speaks 8 intro lines then freeConvLoop sets speakerName to "Sofia"
  console.log('[TEST] Waiting for Ryan intro to finish (up to 90s)...');
  await page.waitForFunction(
    () => document.getElementById('speakerName')?.textContent === 'Sofia',
    null, { timeout: 90000 }
  );
  console.log('[TEST] Intro complete — Sofia is active\n');
  await page.waitForTimeout(2000); // let freeConvLoop settle into listenForUser

  // ── 6. Send 5 OTIMC messages ──────────────────────────────────────────────
  for (let i = 0; i < OTIMC_MESSAGES.length; i++) {
    const { skill, text } = OTIMC_MESSAGES[i];
    console.log(`[TEST] Message ${i + 1}/5 — ${skill}`);
    console.log(`         "${text}"`);

    // Dispatch test:speech (production player.js already has this handler)
    await page.evaluate((msg) => {
      window.dispatchEvent(new CustomEvent('test:speech', { detail: { text: msg } }));
    }, text);

    // Wait for Sofia's full response to settle
    console.log('[TEST] Waiting for Sofia\'s response...');
    const sofiaSaid = await waitForSofiaResponse(page, 60000);
    console.log(`[TEST] Sofia: "${sofiaSaid.slice(0, 100).replace(/\n/g, ' ')}"`);
    chatLog.push({ skill, him: text, sofia: sofiaSaid });
    console.log();
    await page.waitForTimeout(1000);
  }

  // ── 7. End session → trigger coach ───────────────────────────────────────
  console.log('[TEST] All 5 messages sent — triggering coach feedback...');
  const hasEndSession = await page.evaluate(() => typeof window._testBusy !== 'undefined');
  if (hasEndSession) {
    // Local player.js: test:end-session handler calls stopEverything() then runCoachFeedback(session)
    // using the closure-captured session value — no hardcoded number needed
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('test:end-session')));
  } else {
    // Production fallback: session=1 after playScenario, +1 after our stopEverything = 2
    await page.evaluate(() => stopEverything());
    await page.waitForTimeout(500);
    await page.evaluate(() => runCoachFeedback(2));
  }

  // ── 8. Wait for feedback card ─────────────────────────────────────────────
  // waitForSelector checks visibility — but #ek-score-display may be in a
  // container that stopEverything() re-hid. Use waitForFunction instead,
  // which only checks DOM presence + value, not computed visibility.
  console.log('[TEST] Waiting for Ryan feedback card (up to 5 min)...');
  await page.waitForFunction(() => {
    const el = document.getElementById('ek-score-display');
    return el && el.textContent && parseInt(el.textContent) > 0;
  }, null, { timeout: 300000 });
  console.log('[TEST] Feedback card rendered!');
  await page.waitForTimeout(4000); // let score counter finish animating

  // ── 9. Screenshot ─────────────────────────────────────────────────────────
  const screenshotPath = path.join(OUT_DIR, `otimc-eval-result${V2}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`[TEST] Screenshot → tests/output/otimc-eval-result${V2}.png`);

  // ── 10. Build output ──────────────────────────────────────────────────────
  let output = '';
  const line = (s = '') => { output += s + '\n'; };

  line('═'.repeat(70));
  line('OTIMC EVAL RESULT');
  line(`Date:             ${new Date().toISOString()}`);
  line(`URL:              ${BASE}`);
  line(`lesson1Complete:  true`);
  line(`scenario:         beach`);
  line(`character:        Sofia`);
  line('═'.repeat(70));
  line();
  line('CONVERSATION TRANSCRIPT (One Tequila Makes Ideas Click):');
  if (chatLog.length) {
    chatLog.forEach((entry, i) => {
      line(`  ${i + 1}. ${entry.skill}`);
      line(`     HIM:   "${entry.him}"`);
      line(`     SOFIA: "${entry.sofia.replace(/\n/g, ' ')}"`);
    });
  } else {
    OTIMC_MESSAGES.forEach((m, i) => {
      line(`  ${i + 1}. ${m.skill}`);
      line(`     HIM: "${m.text}"`);
    });
  }
  line();

  if (capturedCoachResponse) {
    const f = capturedCoachResponse;

    line('─'.repeat(70));
    line('LESSON 1 EVAL  (lesson1Eval — spoken OTIMC scorecard)');
    line('─'.repeat(70));
    line(f.lesson1Eval || '[MISSING — lesson1Eval not returned by API]');
    line();

    line('─'.repeat(70));
    line('LESSON 1 CHECK  (lesson1Check — certification tracking)');
    line('─'.repeat(70));
    if (f.lesson1Check) {
      const lc = f.lesson1Check;
      line(`Score: ${lc.score}/5   Passed: ${lc.passed}`);
      if (lc.skills) {
        line(`  O (observation): ${lc.skills.observation}`);
        line(`  T (tease):       ${lc.skills.tease}`);
        line(`  M (mystery):     ${lc.skills.mystery}`);
        line(`  I (imply):       ${lc.skills.imply}`);
        line(`  C (close):       ${lc.skills.close}`);
      }
      line(`Summary: ${lc.summary}`);
    } else {
      line('[MISSING — lesson1Check not returned by API]');
    }
    line();

    line('─'.repeat(70));
    line(`STANDARD COACH FEEDBACK  (score: ${f.score}/10)`);
    line('─'.repeat(70));
    line(`spokenSummary: ${f.spokenSummary || '[none]'}`);
    line();
    line('PART 1 — opener:');
    line(f.part1 || '[none]');
    line();
    line('PART 2 — middle:');
    line(f.part2 || '[none]');
    line();
    line('PART 3 — correction:');
    line(f.part3 || '[none]');
    line();
    line('PART 4 — closer:');
    line(f.part4 || '[none]');
    line();
    line('tryNextTime:');
    line(f.tryNextTime || '[none]');
    line();
    line(`openerBreakdown:    ${f.openerBreakdown || '[none]'}`);
    line(`bestMoment:         ${f.bestMoment || '[none]'}`);
    line(`missedOpportunity:  ${f.missedOpportunity || '[none]'}`);
    line(`wouldSheDateHim:    ${f.wouldSheDateHim || '[none]'}`);
  } else {
    line('[API response was not captured — showing raw page text:]');
    const rawText = await page.locator('#lineText').textContent().catch(() => '');
    line(rawText);
  }

  line();
  line('─'.repeat(70));
  line('PAGE LOGS (coach + session events):');
  line('─'.repeat(70));
  consoleLogs
    .filter(l =>
      l.includes('[coach]') || l.includes('[FC]') ||
      l.includes('lesson1') || l.includes('score=')
    )
    .slice(-40)
    .forEach(l => line(l));

  // ── 11. Write file ────────────────────────────────────────────────────────
  const outPath = path.join(OUT_DIR, `otimc-eval-result${V2}.txt`);
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`[TEST] Written → tests/output/otimc-eval-result${V2}.txt\n`);

  // Print full output to console
  console.log('\n' + '═'.repeat(70));
  console.log(output);
  console.log('═'.repeat(70));

  await browser.close();
  console.log('[TEST] Done.');
}

run().catch(err => {
  console.error('\n[TEST] CRASHED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
