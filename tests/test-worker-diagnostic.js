// tests/test-worker-diagnostic.js — Worker + audio diagnostic for Ryan timeout issue
// Run: node tests/test-worker-diagnostic.js
const { chromium } = require('playwright');

const WORKER  = 'https://eklipses-lesson-audio.oclaver611.workers.dev';
const BASE    = 'https://eklipses.vercel.app';

const FILES = {
  ryan:  ['ryan_seg00.mp3', 'ryan_seg01.mp3'],
  alex:  ['alex_seg00.mp3', 'alex_seg01.mp3'],
  sofia: ['sofia_seg00.mp3'],
};

function sep(label) {
  console.log('\n' + '─'.repeat(60));
  if (label) console.log(' ' + label);
  console.log('─'.repeat(60));
}

function fmt(n) {
  if (n == null) return 'absent';
  return Number(n).toLocaleString() + ' bytes (' + (n / 1024).toFixed(1) + ' KB)';
}

// ── Part 1: Direct HTTP HEAD + GET checks via Node fetch ────────────────────
async function checkFile(file) {
  const url = WORKER + '?file=' + encodeURIComponent(file);

  // HEAD first
  let headRes;
  try { headRes = await fetch(url, { method: 'HEAD' }); }
  catch (e) { return { file, error: 'HEAD failed: ' + e.message }; }

  const ct = headRes.headers.get('content-type');
  const cl = headRes.headers.get('content-length');
  const ar = headRes.headers.get('accept-ranges');
  const co = headRes.headers.get('cache-control');
  const ac = headRes.headers.get('access-control-allow-origin');

  // GET to measure actual body size
  let bodySize = null;
  try {
    const getRes = await fetch(url);
    const buf = await getRes.arrayBuffer();
    bodySize = buf.byteLength;
  } catch (e) { /* ignore */ }

  return {
    file,
    status:        headRes.status,
    contentType:   ct,
    contentLength: cl ? Number(cl) : null,
    bodySize,
    clMatchesBody: cl && bodySize ? Number(cl) === bodySize : null,
    acceptRanges:  ar,
    cacheControl:  co,
    cors:          ac,
  };
}

// ── Part 2: Browser-level checks ─────────────────────────────────────────────
async function runBrowserChecks(browser) {
  const context = await browser.newContext();
  const page    = await context.newPage();

  // Capture all responses from the worker
  const workerResponses = {};
  page.on('response', res => {
    const u = res.url();
    if (u.includes('oclaver611.workers.dev')) {
      const params = new URL(u).searchParams.get('file');
      if (params) workerResponses[params] = {
        status:        res.status(),
        contentType:   res.headers()['content-type'],
        contentLength: res.headers()['content-length'],
      };
    }
  });

  // Load app, skip onboarding, open lesson
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-dev-key', 'ek_dev_2026');
    localStorage.removeItem('eklipses_lesson1_complete');
    localStorage.removeItem('eklipses_lesson1_progress');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('#ek-start-btn').click();
  await page.locator('#ek-start-overlay').waitFor({ state: 'detached', timeout: 30000 });
  await page.locator('#ek-start-lesson1').click();
  await page.locator('#ek-lesson-player').waitFor({ state: 'visible', timeout: 10000 });

  // Wait for manifest + first audio request
  await page.waitForTimeout(5000);

  // ── Browser audio element test: canplay event ──────────────────────────────
  const audioTests = await page.evaluate(async (workerUrl) => {
    const results = [];

    async function testAudio(file) {
      return new Promise(resolve => {
        const a = new Audio();
        const timeout = setTimeout(() => resolve({ file, event: 'TIMEOUT_5s' }), 5000);

        a.addEventListener('canplay', () => {
          clearTimeout(timeout);
          resolve({ file, event: 'canplay', duration: a.duration, readyState: a.readyState });
        });
        a.addEventListener('error', (e) => {
          clearTimeout(timeout);
          resolve({ file, event: 'error', code: a.error?.code, message: a.error?.message });
        });
        a.addEventListener('stalled', () => {
          // Don't resolve — just note it, canplay may still come
        });

        a.src = workerUrl + '?file=' + encodeURIComponent(file);
        a.load();
      });
    }

    for (const f of ['ryan_seg00.mp3', 'ryan_seg01.mp3', 'alex_seg00.mp3', 'sofia_seg00.mp3']) {
      results.push(await testAudio(f));
    }
    return results;
  }, WORKER);

  await context.close();
  return { workerResponses, audioTests };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('Worker Diagnostic — ' + new Date().toISOString());

  // Part 1: Node-level HTTP checks
  sep('PART 1 — Direct HTTP checks (Node fetch)');
  const allFiles = [...FILES.ryan, ...FILES.alex, ...FILES.sofia];
  const httpResults = await Promise.all(allFiles.map(checkFile));

  for (const r of httpResults) {
    const voice = r.file.startsWith('ryan') ? 'RYAN' : r.file.startsWith('alex') ? 'ALEX' : 'SOFIA';
    console.log(`\n[${voice}] ${r.file}`);
    if (r.error) { console.log('  ERROR:', r.error); continue; }
    console.log('  HTTP status    :', r.status);
    console.log('  Content-Type   :', r.contentType);
    console.log('  Content-Length :', fmt(r.contentLength));
    console.log('  Body size      :', fmt(r.bodySize));
    console.log('  CL == body     :', r.clMatchesBody);
    console.log('  Accept-Ranges  :', r.acceptRanges);
    console.log('  CORS           :', r.cors);
  }

  // Size comparison summary
  sep('PART 1 — File size comparison');
  const byVoice = { ryan: [], alex: [], sofia: [] };
  for (const r of httpResults) {
    const v = r.file.startsWith('ryan') ? 'ryan' : r.file.startsWith('alex') ? 'alex' : 'sofia';
    if (r.bodySize) byVoice[v].push(r.bodySize);
  }
  for (const [voice, sizes] of Object.entries(byVoice)) {
    if (!sizes.length) continue;
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    console.log(`  ${voice.padEnd(6)}: ${sizes.map(s => (s/1024).toFixed(1)+'KB').join(', ')}  (avg ${(avg/1024).toFixed(1)} KB)`);
  }

  // Part 2: Browser checks
  sep('PART 2 — Browser-level checks (Playwright)');
  const browser = await chromium.launch({ headless: true });
  let browserResult;
  try { browserResult = await runBrowserChecks(browser); }
  finally { await browser.close(); }

  sep('PART 2a — Worker responses captured by browser');
  const intercepted = browserResult.workerResponses;
  if (!Object.keys(intercepted).length) {
    console.log('  No worker requests intercepted (manifest may still use old route)');
  } else {
    for (const [file, r] of Object.entries(intercepted)) {
      const voice = file.startsWith('ryan') ? 'RYAN' : file.startsWith('alex') ? 'ALEX' : 'SOFIA';
      console.log(`\n  [${voice}] ${file}`);
      console.log('    status        :', r.status);
      console.log('    Content-Type  :', r.contentType);
      console.log('    Content-Length:', r.contentLength || 'absent');
    }
  }

  sep('PART 2b — Audio element canplay event');
  for (const r of browserResult.audioTests) {
    const voice = r.file.startsWith('ryan') ? 'RYAN' : r.file.startsWith('alex') ? 'ALEX' : 'SOFIA';
    const ok = r.event === 'canplay';
    const icon = ok ? '✓' : '✗';
    let detail = `event=${r.event}`;
    if (r.event === 'canplay') detail += ` duration=${r.duration?.toFixed(2)}s readyState=${r.readyState}`;
    if (r.event === 'error')   detail += ` code=${r.code}`;
    console.log(`  ${icon} [${voice}] ${r.file} — ${detail}`);
  }

  sep('DONE');
}

run().catch(err => {
  console.error('Diagnostic crashed:', err.message);
  process.exit(1);
});
