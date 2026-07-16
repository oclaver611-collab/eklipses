// tests/test-otimc-perfect.js
// TEST A: "Nailed it" session — genuinely strong, well-executed OTIMC lines.
// Captures Ryan's full feedback + screenshot.
// Run: node tests/test-otimc-perfect.js

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const baseArg = process.argv.find(a => a.startsWith('--base='));
const BASE = baseArg ? baseArg.slice(7) : (pkg.scripts && pkg.scripts.dev) ? 'http://localhost:3000' : 'https://eklipses.vercel.app';

const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const verFlag = process.argv.find(a => /^--v[\w-]+$/.test(a));
const V2 = verFlag ? `-${verFlag.slice(2)}` : '';

// Genuinely strong OTIMC lines — specific, confident, well-timed
const OTIMC_MESSAGES = [
  { skill: 'O — Observation opener',
    // Notices something real and specific about what she's doing, not a compliment
    text: "You keep glancing up from that notebook toward the water — like you're writing about something you can't quite see yet. What is it?" },

  { skill: 'T — Tease',
    // Holds frame when she deflects, playful not defensive
    text: "That sounds like the version you've decided is safe to tell strangers. The real answer is better." },

  { skill: 'M — Mystery',
    // Half-answer, doesn't explain himself, creates curiosity
    text: "Depends who's asking. Some people get the short version, some people get more. You're somewhere in between." },

  { skill: 'I — Imply',
    // Lets the subtext do the work — doesn't state it outright
    text: "You've been choosing every word carefully this whole conversation. Makes me wonder what you're actually deciding." },

  { skill: '— Follow-up 1',
    // Natural continuation — holds the subtext, doesn't over-explain
    text: "Whatever it is — I think you already know." },

  { skill: '— Follow-up 2',
    // Shows he was listening; observation about her character, not just the topic
    text: "You write about things disappearing. Most people find that depressing. You seem to find it worth paying attention to." },

  { skill: 'C — Close',
    // Direct, natural, reads the moment — doesn't ask permission
    text: "I'm walking down to that café on the corner when I leave here. Come with me." },
];

async function waitForSofiaResponse(page, timeoutMs = 60000) {
  const hasTestBusy = await page.evaluate(() => typeof window._testBusy !== 'undefined');
  if (hasTestBusy) {
    await page.waitForFunction(() => window._testBusy === true,  null, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => window._testBusy === false, null, { timeout: timeoutMs });
    return page.locator('#lineText').textContent().catch(() => '');
  }
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
  console.log('  TEST A — "Nailed it" OTIMC session');
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

  await context.addInitScript(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-dev-key', 'ek_dev_2026');
    localStorage.setItem('eklipses_lesson1_complete', 'true');
    window._testMode = true; // suppress freeConvLoop SR while test:speech drives streamCharacterAndSpeak
  });

  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (text.includes('[coach]') || text.includes('[FC]') || text.includes('lesson1') || text.includes('score=')) {
      process.stdout.write('  PAGE: ' + text + '\n');
    }
  });

  page.on('response', async resp => {
    if (resp.url().includes('/api/coach') && !resp.url().includes('suggest') && !resp.url().includes('check')) {
      try {
        const body = await resp.json();
        capturedCoachResponse = body;
        console.log('\n[TEST-A] /api/coach captured — score:', body.score);
        console.log('[TEST-A] lesson1Eval:', body.lesson1Eval ? 'PRESENT ✓' : 'MISSING ✗');
        console.log('[TEST-A] lesson1Check:', body.lesson1Check ? 'PRESENT ✓' : 'MISSING ✗');
      } catch (e) {
        console.log('[TEST-A] coach parse failed:', e.message);
      }
    }
  });

  console.log('[TEST-A] Loading page...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('[TEST-A] Waiting for start button...');
  await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
  await page.locator('#ek-start-btn').click();
  console.log('[TEST-A] Waiting for KokoroSpeech (up to 90s)...');
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 90000 });
  console.log('[TEST-A] App ready');
  await page.waitForTimeout(2000);

  console.log('[TEST-A] Starting beach scenario via playScenario()...');
  await page.evaluate(() => {
    ['ek-paywall-overlay', 'ek-style-selector', 'ek-coach-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    playScenario('beach', true);
  });

  console.log('[TEST-A] Waiting for style selector...');
  await page.waitForSelector('#ek-style-selector', { timeout: 10000 });
  await page.locator('[data-style="curious"]').click();
  console.log('[TEST-A] Style "Curious" selected');

  console.log('[TEST-A] Waiting for Ryan intro to finish (up to 90s)...');
  await page.waitForFunction(
    () => document.getElementById('speakerName')?.textContent === 'Sofia',
    null, { timeout: 90000 }
  );
  console.log('[TEST-A] Intro complete — Sofia is active\n');
  await page.waitForTimeout(2000);

  for (let i = 0; i < OTIMC_MESSAGES.length; i++) {
    const { skill, text } = OTIMC_MESSAGES[i];
    console.log(`[TEST-A] Message ${i + 1}/5 — ${skill}`);
    console.log(`         "${text}"`);

    await page.evaluate((msg) => {
      window.dispatchEvent(new CustomEvent('test:speech', { detail: { text: msg } }));
    }, text);

    console.log('[TEST-A] Waiting for Sofia response...');
    const sofiaSaid = await waitForSofiaResponse(page, 60000);
    console.log(`[TEST-A] Sofia: "${sofiaSaid.slice(0, 100).replace(/\n/g, ' ')}"`);
    chatLog.push({ skill, him: text, sofia: sofiaSaid });
    console.log();
    await page.waitForTimeout(1000);
  }

  console.log('[TEST-A] All 5 messages sent — triggering coach feedback...');
  const hasEndSession = await page.evaluate(() => typeof window._testBusy !== 'undefined');
  if (hasEndSession) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('test:end-session')));
  } else {
    await page.evaluate(() => stopEverything());
    await page.waitForTimeout(500);
    await page.evaluate(() => runCoachFeedback(2));
  }

  console.log('[TEST-A] Waiting for feedback card...');
  await page.waitForFunction(() => {
    const el = document.getElementById('ek-score-display');
    return el && el.textContent && parseInt(el.textContent) > 0;
  }, null, { timeout: 300000 });
  console.log('[TEST-A] Feedback card rendered!');
  await page.waitForTimeout(4000);

  await page.screenshot({ path: path.join(OUT_DIR, `otimc-perfect-result${V2}.png`), fullPage: false });
  console.log('[TEST-A] Screenshot saved');

  let output = '';
  const line = (s = '') => { output += s + '\n'; };

  line('═'.repeat(70));
  line('OTIMC PERFECT SESSION RESULT  (TEST A — "Nailed It")');
  line(`Date:    ${new Date().toISOString()}`);
  line(`URL:     ${BASE}`);
  line('═'.repeat(70));
  line();
  line('CONVERSATION TRANSCRIPT:');
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
    line('LESSON 1 EVAL (spoken scorecard)');
    line('─'.repeat(70));
    line(f.lesson1Eval || '[MISSING]');
    line();

    line('─'.repeat(70));
    line('LESSON 1 CHECK (certification)');
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
    } else { line('[MISSING]'); }
    line();

    line('─'.repeat(70));
    line(`STANDARD COACH FEEDBACK  (score: ${f.score}/10)`);
    line('─'.repeat(70));
    line(`spokenSummary: ${f.spokenSummary || '[none]'}`);
    line();
    line('PART 1:'); line(f.part1 || '[none]'); line();
    line('PART 2:'); line(f.part2 || '[none]'); line();
    line('PART 3:'); line(f.part3 || '[none]'); line();
    line('PART 4:'); line(f.part4 || '[none]'); line();
    line('tryNextTime:'); line(f.tryNextTime || '[none]'); line();
    line(`openerBreakdown:    ${f.openerBreakdown || '[none]'}`);
    line(`bestMoment:         ${f.bestMoment || '[none]'}`);
    line(`missedOpportunity:  ${f.missedOpportunity || '[none]'}`);
    line(`wouldSheDateHim:    ${f.wouldSheDateHim || '[none]'}`);
  } else {
    line('[API response not captured]');
  }

  const outPath = path.join(OUT_DIR, `otimc-perfect-result${V2}.txt`);
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`[TEST-A] Written → tests/output/otimc-perfect-result${V2}.txt\n`);
  console.log('\n' + '═'.repeat(70));
  console.log(output);
  console.log('═'.repeat(70));

  await browser.close();
  console.log('[TEST-A] Done.');
}

run().catch(err => {
  console.error('\n[TEST-A] CRASHED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
