// Temporary runner — airport scenario only, reuses diagnostic-compare logic inline
// node tests/run-airport-only.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LIVE_URL = 'https://eklipses.vercel.app';
const CAPTURE_MS = 20000;

const STT_PATCH = () => {
  const _d = (msg) => console.log('[DIAG] ' + msg);
  const OrigSR = window.webkitSpeechRecognition || window.SpeechRecognition;
  if (!OrigSR) { _d('WARN: no SpeechRecognition API'); return; }
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
              _d(`STT_ONRESULT transcript="${t}" isFinal=${e?.results?.[0]?.isFinal}`);
            } else if (prop === 'onerror') {
              _d(`STT_ONERROR error="${e?.error}"`);
            } else { _d(`STT_${prop.replace('on','').toUpperCase()}`); }
            return orig.call(this, e);
          } : null;
        } else { target[prop] = value; }
        return true;
      },
      get(target, prop) {
        if (prop === 'start')  return () => { _d('STT_START');  return target.start();  };
        if (prop === 'stop')   return () => { _d('STT_STOP');   return target.stop();   };
        if (prop === 'abort')  return () => { _d('STT_ABORT');  return target.abort();  };
        const v = target[prop]; return typeof v === 'function' ? v.bind(target) : v;
      }
    });
    return proxy;
  }
  PatchedSR.prototype = OrigSR.prototype;
  window.webkitSpeechRecognition = PatchedSR;
  window.SpeechRecognition = PatchedSR;
  _d('STT_PATCH_INSTALLED');
};

const RUNTIME_PATCH = () => {
  const _d = (msg) => console.log('[DIAG] ' + msg);
  if (typeof window.speak === 'function') {
    const orig = window.speak;
    window.speak = async function(text, speaker, onAudioReady, prefetchedUrl) {
      _d(`SPEAK_START speaker=${speaker} text="${(text||'').slice(0,60)}"`);
      const t0 = Date.now();
      try { const r = await orig.apply(this, arguments); _d(`SPEAK_END speaker=${speaker} ms=${Date.now()-t0}`); return r; }
      catch(e) { _d(`SPEAK_ERROR speaker=${speaker} err="${e.message}"`); throw e; }
    };
    _d('PATCHED_speak');
  } else { _d('WARN_speak_not_found'); }

  if (typeof window.setMediaForSpeaker === 'function') {
    const orig = window.setMediaForSpeaker;
    window.setMediaForSpeaker = function(speaker) {
      const cur = window.els?.media;
      const curSrc = cur?.src ? cur.src.split('/').pop() : '';
      _d(`SET_MEDIA speaker=${speaker} prev=${cur?.tagName||'?'}#${cur?.id||'?'} src=${curSrc}`);
      const result = orig.apply(this, arguments);
      const nxt = window.els?.media;
      _d(`SET_MEDIA_DONE speaker=${speaker} new=${nxt?.tagName||'?'} src=${nxt?.src?.split('/').pop()||''}`);
      return result;
    };
    _d('PATCHED_setMediaForSpeaker');
  } else { _d('WARN_setMediaForSpeaker_not_found'); }

  const mutObs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.type === 'attributes') {
        const el = m.target;
        const src = (el.src || el.currentSrc || '').split('/').pop() || '';
        if (m.attributeName === 'src') _d(`ATTR_SRC tag=${el.tagName}#${el.id||'?'} src=${src}`);
        else if (m.attributeName === 'class') _d(`ATTR_CLASS tag=${el.tagName}#${el.id||'?'} class="${el.className}"`);
      } else if (m.type === 'childList') {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (['VIDEO','IMG','AUDIO'].includes(n.tagName)) {
            _d(`DOM_ADD tag=${n.tagName} id=${n.id||'?'} class="${n.className}" src=${(n.src||'').split('/').pop()}`);
            mutObs.observe(n, { attributes: true, attributeFilter: ['src','class','currentSrc'] });
          }
        });
        m.removedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (['VIDEO','IMG','AUDIO'].includes(n.tagName))
            _d(`DOM_REMOVE tag=${n.tagName} id=${n.id||'?'} class="${n.className}" src=${(n.src||'').split('/').pop()}`);
        });
      }
    });
  });
  mutObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src','class','currentSrc'] });
  const mediaEl = document.getElementById('media');
  if (mediaEl) _d(`INITIAL_MEDIA tag=${mediaEl.tagName} src=${(mediaEl.src||'').split('/').pop()}`);
  const bg = document.querySelector('.scene-bg');
  if (bg) _d(`INITIAL_SCENE_BG tag=${bg.tagName} src=${(bg.src||bg.currentSrc||'').split('/').pop()}`);
  _d('RUNTIME_PATCHES_COMPLETE');
};

(async () => {
  const t0 = Date.now();
  const lines = [];
  const record = (msg) => lines.push(`[${((Date.now()-t0)/1000).toFixed(3)}] ${msg}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript(STT_PATCH);
  page.on('console', msg => record(`CONSOLE.${msg.type()} ${msg.text()}`));
  page.on('pageerror', err => record(`PAGE_ERROR ${err.message}`));
  page.on('requestfailed', req => record(`REQ_FAILED ${req.url().split('/').pop()} ${req.failure()?.errorText||''}`));

  record('NAVIGATE_START');
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  record('DOMCONTENTLOADED');
  await page.evaluate(() => { localStorage.setItem('ek-onboarding-v1','1'); localStorage.setItem('ek-paid','1'); });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  record('RELOAD_NETWORKIDLE');

  await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
  record('SPLASH_VISIBLE');
  await page.click('#ek-start-btn');
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 20000 });
  record('SPLASH_DISMISSED');

  await page.waitForTimeout(500);
  await page.evaluate(RUNTIME_PATCH);
  record('RUNTIME_PATCHES_INSTALLED');

  const snap = await page.evaluate(() => ({
    mediaTag: document.getElementById('media')?.tagName,
    sceneBgTag: document.querySelector('.scene-bg')?.tagName,
    sceneBgSrc: (document.querySelector('.scene-bg')?.src||document.querySelector('.scene-bg')?.currentSrc||'').split('/').pop(),
    characterId: window.currentCharacterId,
    session: window.session,
  }));
  record(`PRE_TRIGGER_SNAPSHOT ${JSON.stringify(snap)}`);

  record('TRIGGER_PLAY_SCENARIO key=airport');
  await page.evaluate(() => window.playScenario('airport', false));
  record('PLAY_SCENARIO_CALLED');

  await page.waitForTimeout(CAPTURE_MS);

  const finalSnap = await page.evaluate(() => ({
    mediaTag: (document.getElementById('media')||document.getElementById('ryan-orb'))?.tagName,
    characterId: window.currentCharacterId,
    stepIndex: window.stepIndex,
    session: window.session,
  }));
  record(`FINAL_SNAPSHOT ${JSON.stringify(finalSnap)}`);
  record('CAPTURE_COMPLETE');

  const logPath = path.join(__dirname, 'log-airport.txt');
  fs.writeFileSync(logPath, lines.join('\n') + '\n', 'utf8');
  console.log(`[airport] ${lines.length} lines → log-airport.txt`);

  await browser.close();
})();
