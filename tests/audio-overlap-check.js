// tests/audio-overlap-check.js
// Detects simultaneous Audio playback during the Airport intro sequence.
// Run BEFORE and AFTER the overlap fix to confirm it works.
// Usage: node tests/audio-overlap-check.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LIVE_URL = 'https://eklipses.vercel.app';
const CAPTURE_MS = 15000;

// Injected before any page script — patches Audio constructor and .play()
const AUDIO_PATCH = () => {
  const _log = (msg) => console.log('[AUDIO-DIAG] ' + msg);
  const OrigAudio = window.Audio;
  let _counter = 0;
  let _playing = 0;
  let _maxSimultaneous = 0;

  window.Audio = function(src) {
    const inst = new OrigAudio(src);
    const id = 'a' + (++_counter);
    let _isPlaying = false;
    _log(`NEW id=${id} src=${(src || '').split('/').pop().slice(0, 40)}`);

    const _markStop = (reason) => {
      if (_isPlaying) {
        _isPlaying = false;
        _playing = Math.max(0, _playing - 1);
        _log(`STOP(${reason}) id=${id} simultaneous_after=${_playing}`);
      }
    };

    const origPlay = inst.play.bind(inst);
    inst.play = function() {
      if (!_isPlaying) {
        _isPlaying = true;
        _playing++;
        if (_playing > _maxSimultaneous) {
          _maxSimultaneous = _playing;
          if (_maxSimultaneous > 1) {
            _log(`!!! OVERLAP DETECTED simultaneous=${_maxSimultaneous} id=${id}`);
          }
        }
      }
      _log(`PLAY id=${id} simultaneous=${_playing} max=${_maxSimultaneous}`);
      return origPlay();
    };

    const origPause = inst.pause.bind(inst);
    inst.pause = function() {
      _markStop('pause');
      return origPause();
    };

    inst.addEventListener('ended', () => _markStop('ended'));
    inst.addEventListener('error', () => _markStop('error'));

    // Watch src being set to '' — used by KokoroSpeech.cancel() to stop audio
    const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    Object.defineProperty(inst, 'src', {
      set: function(val) {
        if (val === '') _markStop('src=""');
        desc.set.call(this, val);
      },
      get: function() { return desc.get.call(this); },
      configurable: true,
    });

    return inst;
  };
  window.Audio.prototype = OrigAudio.prototype;
  _log('AUDIO_PATCH_INSTALLED');

  // Report max at end of capture
  window._audioMaxSimultaneous = () => _maxSimultaneous;
};

(async () => {
  const t0 = Date.now();
  const lines = [];
  const record = (msg) => {
    const entry = `[${((Date.now() - t0) / 1000).toFixed(3)}] ${msg}`;
    lines.push(entry);
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript(AUDIO_PATCH);
  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('[AUDIO-DIAG]') || text.startsWith('[TTS]') || text.startsWith('[prefetch]')) {
      record(`CONSOLE ${text}`);
    }
  });
  page.on('pageerror', err => record(`PAGE_ERROR ${err.message}`));

  record('NAVIGATE_START');
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  record('DOM_LOADED');

  await page.evaluate(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-paid', '1');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  record('RELOAD_COMPLETE');

  await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
  await page.click('#ek-start-btn');
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 20000 });
  record('SPLASH_DISMISSED');

  // Trigger airport scenario immediately
  record('TRIGGER airport');
  await page.evaluate(() => window.playScenario('airport', false));
  record('PLAY_SCENARIO_CALLED');

  await page.waitForTimeout(CAPTURE_MS);

  const maxSim = await page.evaluate(() =>
    typeof window._audioMaxSimultaneous === 'function' ? window._audioMaxSimultaneous() : -1
  );
  record(`FINAL max_simultaneous=${maxSim}`);
  record(maxSim > 1 ? '!!! RESULT: OVERLAP CONFIRMED' : 'RESULT: OK — no overlap detected');

  const logPath = path.join(__dirname, 'audio-overlap.txt');
  fs.writeFileSync(logPath, lines.join('\n') + '\n', 'utf8');

  console.log(`\n=== AUDIO OVERLAP CHECK ===`);
  console.log(`Max simultaneous audio elements: ${maxSim}`);
  console.log(maxSim > 1 ? '!!! OVERLAP DETECTED — fix needed' : 'OK — no overlap in this run');
  console.log(`Full log: tests/audio-overlap.txt (${lines.length} lines)`);
  console.log(`\nOVERLAP events:`);
  lines.filter(l => l.includes('OVERLAP') || l.includes('PLAY') || l.includes('STOP') || l.includes('NEW')).forEach(l => console.log(' ', l));

  await browser.close();
  process.exit(maxSim > 1 ? 1 : 0);
})();
