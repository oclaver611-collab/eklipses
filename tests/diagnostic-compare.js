// tests/diagnostic-compare.js
// Diagnostic: captures all audio/video/STT events for Beach vs Airport over 20s each.
// Does NOT fix anything — analysis only.
// Run: node tests/diagnostic-compare.js
// Output: tests/log-beach.txt, tests/log-airport.txt

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LIVE_URL = 'https://eklipses.vercel.app';
const CAPTURE_MS = 20000;
const TESTS_DIR = __dirname;

// ─── INIT SCRIPT: patches webkitSpeechRecognition before player.js loads ──────
const STT_PATCH = () => {
  const _d = (msg) => console.log('[DIAG] ' + msg);

  const OrigSR = window.webkitSpeechRecognition || window.SpeechRecognition;
  if (!OrigSR) { _d('WARN: no SpeechRecognition API found'); return; }

  function PatchedSR() {
    const inst = new OrigSR();
    const proxy = new Proxy(inst, {
      set(target, prop, value) {
        const sttProps = ['onresult','onend','onstart','onerror','onspeechend','onspeechstart','onnomatch'];
        if (sttProps.includes(prop)) {
          const orig = value;
          target[prop] = orig ? function(e) {
            if (prop === 'onresult') {
              const t = e?.results?.[0]?.[0]?.transcript || '';
              const conf = e?.results?.[0]?.[0]?.confidence?.toFixed(2) || '?';
              _d(`STT_ONRESULT transcript="${t}" confidence=${conf} isFinal=${e?.results?.[0]?.isFinal}`);
            } else if (prop === 'onerror') {
              _d(`STT_ONERROR error="${e?.error}" message="${e?.message||''}"`);
            } else {
              _d(`STT_${prop.replace('on','').toUpperCase()}`);
            }
            return orig.call(this, e);
          } : null;
        } else {
          target[prop] = value;
        }
        return true;
      },
      get(target, prop) {
        if (prop === 'start')  return () => { _d('STT_START');  return target.start();  };
        if (prop === 'stop')   return () => { _d('STT_STOP');   return target.stop();   };
        if (prop === 'abort')  return () => { _d('STT_ABORT');  return target.abort();  };
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      }
    });
    return proxy;
  }
  PatchedSR.prototype = OrigSR.prototype;
  window.webkitSpeechRecognition = PatchedSR;
  window.SpeechRecognition = PatchedSR;
  _d('STT_PATCH_INSTALLED');
};

// ─── POST-LOAD PATCHES: speak(), setMediaForSpeaker(), DOM observer ───────────
const RUNTIME_PATCH = () => {
  const _d = (msg) => console.log('[DIAG] ' + msg);

  // speak()
  if (typeof window.speak === 'function') {
    const orig = window.speak;
    window.speak = async function(text, speaker, onAudioReady, prefetchedUrl) {
      const preview = (text || '').slice(0, 60).replace(/\n/g, ' ');
      _d(`SPEAK_START speaker=${speaker} text="${preview}"`);
      const t0 = Date.now();
      try {
        const r = await orig.apply(this, arguments);
        _d(`SPEAK_END speaker=${speaker} ms=${Date.now()-t0}`);
        return r;
      } catch (e) {
        _d(`SPEAK_ERROR speaker=${speaker} err="${e.message}"`);
        throw e;
      }
    };
    _d('PATCHED_speak');
  } else {
    _d('WARN_speak_not_on_window');
  }

  // setMediaForSpeaker()
  if (typeof window.setMediaForSpeaker === 'function') {
    const orig = window.setMediaForSpeaker;
    window.setMediaForSpeaker = function(speaker) {
      const cur = window.els && window.els.media;
      const curTag = cur ? cur.tagName : '?';
      const curId  = cur ? (cur.id || cur.className.split(' ')[0] || '?') : '?';
      const curSrc = cur && cur.src ? cur.src.split('/').pop() : '';
      _d(`SET_MEDIA speaker=${speaker} prev_el=${curTag}#${curId} prev_src=${curSrc}`);
      const result = orig.apply(this, arguments);
      const nxt = window.els && window.els.media;
      const nxtTag = nxt ? nxt.tagName : '?';
      const nxtSrc = nxt && nxt.src ? nxt.src.split('/').pop() : '';
      _d(`SET_MEDIA_DONE speaker=${speaker} new_el=${nxtTag} new_src=${nxtSrc}`);
      return result;
    };
    _d('PATCHED_setMediaForSpeaker');
  } else {
    _d('WARN_setMediaForSpeaker_not_on_window');
  }

  // speakElevenLabs / speakRyan (if exposed)
  if (typeof window.speakElevenLabs === 'function') {
    const orig = window.speakElevenLabs;
    window.speakElevenLabs = async function(text, onStart) {
      _d(`ELEVEN_LABS_START text="${(text||'').slice(0,40)}"`);
      const r = await orig.apply(this, arguments);
      _d('ELEVEN_LABS_END');
      return r;
    };
    _d('PATCHED_speakElevenLabs');
  }

  // KokoroSpeech (Ryan)
  if (window.KokoroSpeech && typeof window.KokoroSpeech.speak === 'function') {
    const orig = window.KokoroSpeech.speak;
    window.KokoroSpeech.speak = async function(text, opts) {
      _d(`KOKORO_START text="${(text||'').slice(0,40)}"`);
      const r = await orig.apply(this, arguments);
      _d('KOKORO_END');
      return r;
    };
    _d('PATCHED_KokoroSpeech');
  }

  // DOM MutationObserver: watch all video/img/class changes
  const mutObs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.type === 'attributes') {
        const el = m.target;
        const tag = el.tagName;
        const id = el.id || (el.className ? el.className.split(' ')[0] : '?');
        const src = (el.src || el.currentSrc || '').split('/').pop() || '';
        if (m.attributeName === 'src') {
          _d(`ATTR_SRC tag=${tag}#${id} src=${src}`);
        } else if (m.attributeName === 'class') {
          _d(`ATTR_CLASS tag=${tag}#${id} class="${el.className}"`);
        }
      } else if (m.type === 'childList') {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'VIDEO' || n.tagName === 'IMG' || n.tagName === 'AUDIO') {
            const src = (n.src || '').split('/').pop() || '';
            _d(`DOM_ADD tag=${n.tagName} id=${n.id||'?'} class="${n.className}" src=${src}`);
            // Watch this new element too
            mutObs.observe(n, { attributes: true, attributeFilter: ['src', 'class', 'currentSrc'] });
          }
        });
        m.removedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'VIDEO' || n.tagName === 'IMG' || n.tagName === 'AUDIO') {
            const src = (n.src || '').split('/').pop() || '';
            _d(`DOM_REMOVE tag=${n.tagName} id=${n.id||'?'} class="${n.className}" src=${src}`);
          }
        });
      }
    });
  });

  mutObs.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'class', 'currentSrc'],
  });

  // Also observe the specific #media element if it exists
  const mediaEl = document.getElementById('media');
  if (mediaEl) {
    _d(`INITIAL_MEDIA tag=${mediaEl.tagName} id=${mediaEl.id} src=${(mediaEl.src||'').split('/').pop()}`);
  }

  // Observe els.sceneBg if it exists
  const sceneBg = document.querySelector('.scene-bg');
  if (sceneBg) {
    _d(`INITIAL_SCENE_BG tag=${sceneBg.tagName} src=${(sceneBg.src||sceneBg.currentSrc||'').split('/').pop()}`);
  }

  _d('RUNTIME_PATCHES_COMPLETE');
};

// ─── CORE: run one scenario for CAPTURE_MS and write log ─────────────────────
async function runScenario(browser, scenarioKey, logPath) {
  const page = await browser.newPage();
  const t0 = Date.now();
  const lines = [];

  function record(msg) {
    const ts = ((Date.now() - t0) / 1000).toFixed(3);
    lines.push(`[${ts}] ${msg}`);
  }

  // Install STT patch before ANY page script runs
  await page.addInitScript(STT_PATCH);

  // Capture all browser console output with timestamps
  page.on('console', msg => {
    record(`CONSOLE.${msg.type()} ${msg.text()}`);
  });
  page.on('pageerror', err => {
    record(`PAGE_ERROR ${err.message}`);
  });
  page.on('requestfailed', req => {
    record(`REQ_FAILED ${req.url().split('/').pop()} ${req.failure()?.errorText || ''}`);
  });

  // Load with onboarding already skipped
  record(`NAVIGATE_START url=${LIVE_URL}`);
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  record(`DOMCONTENTLOADED`);
  await page.evaluate(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    // Also skip any paywall gate for test purposes
    localStorage.setItem('ek-paid', '1');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  record(`RELOAD_NETWORKIDLE`);

  // Dismiss splash
  await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
  record(`SPLASH_VISIBLE`);
  await page.click('#ek-start-btn');
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 20000 });
  record(`SPLASH_DISMISSED`);

  // Brief settle — let Ryan intro audio start
  await page.waitForTimeout(500);

  // Install runtime patches (speak, setMediaForSpeaker, DOM observer)
  await page.evaluate(RUNTIME_PATCH);
  record(`RUNTIME_PATCHES_INSTALLED`);

  // Snapshot current DOM state before triggering scenario
  const snapshot = await page.evaluate(() => {
    const media = document.getElementById('media');
    const sceneBg = document.querySelector('.scene-bg');
    return {
      mediaTag: media?.tagName,
      mediaId: media?.id,
      mediaSrc: (media?.src || '').split('/').pop(),
      sceneBgTag: sceneBg?.tagName,
      sceneBgSrc: (sceneBg?.src || sceneBg?.currentSrc || '').split('/').pop(),
      scenarioKey: window.currentScenarioKey,
      characterId: window.currentCharacterId,
      session: window.session,
    };
  });
  record(`PRE_TRIGGER_SNAPSHOT ${JSON.stringify(snapshot)}`);

  // Trigger the scenario
  record(`TRIGGER_PLAY_SCENARIO key=${scenarioKey}`);
  await page.evaluate(key => window.playScenario(key, false), scenarioKey);
  record(`PLAY_SCENARIO_CALLED`);

  // Capture for 20 seconds
  await page.waitForTimeout(CAPTURE_MS);

  // Final DOM snapshot
  const finalSnap = await page.evaluate(() => {
    const media = document.getElementById('media') || document.querySelector('#ryan-orb') || document.querySelector('[id^="ryan"]');
    const sceneBg = document.querySelector('.scene-bg');
    return {
      mediaTag: media?.tagName,
      mediaId: media?.id,
      mediaSrc: (media?.src || '').split('/').pop(),
      sceneBgTag: sceneBg?.tagName,
      sceneBgSrc: (sceneBg?.src || sceneBg?.currentSrc || '').split('/').pop(),
      scenarioKey: window.currentScenarioKey,
      characterId: window.currentCharacterId,
      session: window.session,
      stepIndex: window.stepIndex,
    };
  });
  record(`FINAL_SNAPSHOT ${JSON.stringify(finalSnap)}`);
  record(`CAPTURE_COMPLETE`);

  fs.writeFileSync(logPath, lines.join('\n') + '\n', 'utf8');
  console.log(`  [${scenarioKey.padEnd(8)}] ${lines.length} lines → ${path.basename(logPath)}`);

  await page.close();
  return lines;
}

// ─── DIFF ANALYSIS ────────────────────────────────────────────────────────────
function extractDiagEvents(lines) {
  return lines
    .filter(l => l.includes('[DIAG]'))
    .map(l => {
      const ts  = parseFloat(l.match(/^\[(\d+\.\d+)\]/)?.[1] ?? '0');
      const raw = l.match(/\[DIAG\]\s*(.+)/)?.[1] ?? '';
      const type = raw.split(/[\s=]/)[0];
      return { ts, type, raw };
    });
}

function findGaps(events, minGapSec = 3) {
  const gaps = [];
  let prev = { ts: 0, raw: 'START' };
  for (const e of events) {
    if (e.ts - prev.ts > minGapSec) {
      gaps.push({ fromTs: prev.ts, toTs: e.ts, gap: +(e.ts - prev.ts).toFixed(1), after: prev.raw, before: e.raw });
    }
    prev = e;
  }
  return gaps;
}

function printDiff(beachLines, airportLines) {
  const beachEvts   = extractDiagEvents(beachLines);
  const airportEvts = extractDiagEvents(airportLines);

  const beachTypes   = new Set(beachEvts.map(e => e.type));
  const airportTypes = new Set(airportEvts.map(e => e.type));

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('DIFF ANALYSIS — Beach vs Airport');
  console.log('════════════════════════════════════════════════════════════');

  console.log('\n[+] Event types in AIRPORT but NOT in Beach:');
  const inAirportOnly = [...airportTypes].filter(t => !beachTypes.has(t));
  inAirportOnly.length ? inAirportOnly.forEach(t => console.log(`    ${t}`)) : console.log('    (none)');

  console.log('\n[-] Event types in BEACH but NOT in Airport:');
  const inBeachOnly = [...beachTypes].filter(t => !airportTypes.has(t));
  inBeachOnly.length ? inBeachOnly.forEach(t => console.log(`    ${t}`)) : console.log('    (none)');

  console.log('\n[COUNT] Event type frequency comparison:');
  const allTypes = new Set([...beachTypes, ...airportTypes]);
  [...allTypes].sort().forEach(t => {
    const b = beachEvts.filter(e => e.type === t).length;
    const a = airportEvts.filter(e => e.type === t).length;
    if (b !== a) console.log(`    ${t.padEnd(30)} Beach=${b}  Airport=${a}  diff=${a-b>`0`?'+':''}${a-b}`);
  });

  console.log('\n[GAPS >3s] BEACH:');
  const beachGaps = findGaps(beachEvts);
  beachGaps.length
    ? beachGaps.forEach(g => console.log(`    ${g.fromTs.toFixed(3)}→${g.toTs.toFixed(3)}s  (${g.gap}s)  after: ${g.after}  before: ${g.before}`))
    : console.log('    none');

  console.log('\n[GAPS >3s] AIRPORT:');
  const airportGaps = findGaps(airportEvts);
  airportGaps.length
    ? airportGaps.forEach(g => console.log(`    ${g.fromTs.toFixed(3)}→${g.toTs.toFixed(3)}s  (${g.gap}s)  after: ${g.after}  before: ${g.before}`))
    : console.log('    none');

  // Video/audio pairing
  console.log('\n[VIDEO/AUDIO PAIRING]');
  for (const [label, evts] of [['Beach', beachEvts], ['Airport', airportEvts]]) {
    const videoEvts = evts.filter(e => ['ATTR_SRC','DOM_ADD','DOM_REMOVE','SET_MEDIA','SET_MEDIA_DONE'].includes(e.type));
    const audioEvts = evts.filter(e => ['SPEAK_START','SPEAK_END','SPEAK_ERROR','ELEVEN_LABS_START','ELEVEN_LABS_END','KOKORO_START','KOKORO_END'].includes(e.type));
    console.log(`  ${label}: ${videoEvts.length} video events, ${audioEvts.length} audio events`);

    // Report video events with no audio event within 500ms
    const unpairedVideo = videoEvts.filter(v => {
      return !audioEvts.some(a => Math.abs(a.ts - v.ts) < 0.5);
    });
    if (unpairedVideo.length) {
      console.log(`    Unpaired video events (no audio within 500ms):`);
      unpairedVideo.forEach(v => console.log(`      @${v.ts.toFixed(3)}s ${v.raw}`));
    }
  }

  console.log('\n[STT EVENTS TIMELINE]');
  for (const [label, evts] of [['Beach', beachEvts], ['Airport', airportEvts]]) {
    const sttEvts = evts.filter(e => e.type.startsWith('STT_'));
    console.log(`  ${label} STT events (${sttEvts.length}):`);
    sttEvts.forEach(e => console.log(`    @${e.ts.toFixed(3)}s  ${e.raw}`));
  }

  console.log('\n[SPEAK TIMELINE]');
  for (const [label, evts] of [['Beach', beachEvts], ['Airport', airportEvts]]) {
    const speakEvts = evts.filter(e => e.type.startsWith('SPEAK_') || e.type.startsWith('ELEVEN_') || e.type.startsWith('KOKORO_'));
    console.log(`  ${label} speak events (${speakEvts.length}):`);
    speakEvts.forEach(e => console.log(`    @${e.ts.toFixed(3)}s  ${e.raw}`));
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('Full logs: tests/log-beach.txt  tests/log-airport.txt');
  console.log('════════════════════════════════════════════════════════════\n');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n▶  Launching Chromium (headless)...');
  const browser = await chromium.launch({ headless: true });

  console.log('▶  BEACH scenario (20s)...');
  const beachLines = await runScenario(browser, 'beach', path.join(TESTS_DIR, 'log-beach.txt'));

  console.log('▶  AIRPORT scenario (20s)...');
  const airportLines = await runScenario(browser, 'airport', path.join(TESTS_DIR, 'log-airport.txt'));

  await browser.close();

  printDiff(beachLines, airportLines);
})();
