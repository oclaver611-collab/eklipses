// ============================================================
// Eklipses — Session Transcript Tool
// Logs every turn (Ryan, Mary, user) with timestamps
// for debugging pacing, cutoffs, and AI response quality.
// ============================================================
//
// Purely additive. Does not modify existing functions.
// Wraps window.speak, window.getDynamicMaryResponse, and
// hooks into the scenario engine via event sniffing.
// ============================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'ek-transcript-v1';

  // In-memory log for current session
  let transcriptLog = [];
  let sessionStartTime = null;
  let currentScenarioId = null;

  // ── Diagnostic state (private to this IIFE) ──────────────
  let _diag_isPlaying = false;
  let _diag_playingText = null;
  let _diag_audioStartMs = 0;

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        transcriptLog = data.log || [];
        sessionStartTime = data.startTime || Date.now();
        currentScenarioId = data.scenarioId || null;
      } else {
        sessionStartTime = Date.now();
      }
    } catch (e) {
      transcriptLog = [];
      sessionStartTime = Date.now();
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        log: transcriptLog,
        startTime: sessionStartTime,
        scenarioId: currentScenarioId
      }));
    } catch (e) {
      // storage full or blocked — silent fail
    }
  }

  function formatTimestamp(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatTimestampMs(ms) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    const milli = ms % 1000;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
  }

  function logEntry(speaker, text, extraMeta = {}) {
    const now = Date.now();
    const entry = {
      speaker: speaker,
      text: text,
      timestamp: now,
      elapsed: sessionStartTime ? now - sessionStartTime : 0,
      scenarioId: currentScenarioId,
      scenarioTitle: (window.SCENARIOS && currentScenarioId && window.SCENARIOS[currentScenarioId])
        ? window.SCENARIOS[currentScenarioId].title
        : 'Unknown',
      mode: window.isPractice ? 'practice' : 'demo',
      ...extraMeta
    };
    transcriptLog.push(entry);
    saveToStorage();
    updateBadge();
  }

  function logDiag(text) {
    logEntry('DIAG', text, { isdiag: true });
  }

  function formatTranscriptForCopy() {
    if (transcriptLog.length === 0) {
      return '(empty transcript — no session recorded yet)';
    }

    const lines = [];
    lines.push('='.repeat(60));
    lines.push('EKLIPSES SESSION TRANSCRIPT');
    lines.push('Recorded: ' + new Date(sessionStartTime).toLocaleString());
    lines.push('Turns: ' + transcriptLog.filter(e => !e.isdiag).length);
    lines.push('='.repeat(60));
    lines.push('');

    let lastScenario = null;
    let lastElapsed = 0;

    transcriptLog.forEach((entry, i) => {
      // Diagnostic entries: indented, ms-precision timestamp
      if (entry.isdiag) {
        lines.push(`  [${formatTimestampMs(entry.elapsed)}] >> ${entry.text}`);
        return;
      }

      // Scenario header whenever it changes
      if (entry.scenarioTitle !== lastScenario) {
        lines.push('');
        lines.push('--- SCENARIO: ' + entry.scenarioTitle + ' (' + entry.mode + ') ---');
        lines.push('');
        lastScenario = entry.scenarioTitle;
      }

      // Time gap from previous non-diag turn
      const prevNonDiag = transcriptLog.slice(0, i).filter(e => !e.isdiag).pop();
      const gap = prevNonDiag ? entry.elapsed - prevNonDiag.elapsed : 0;
      const gapStr = prevNonDiag ? ` [+${(gap / 1000).toFixed(1)}s]` : '';

      const time = formatTimestamp(entry.elapsed);
      const speaker = entry.speaker.padEnd(5);
      let metaStr = '';
      if (entry.meta) metaStr = ' {' + entry.meta + '}';

      lines.push(`[${time}]${gapStr} ${speaker}: ${entry.text}${metaStr}`);
      lastElapsed = entry.elapsed;
    });

    lines.push('');
    lines.push('='.repeat(60));
    lines.push('End of transcript.');
    lines.push('Paste this to Claude for analysis.');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  // ============ UI ============

  function injectStyles() {
    if (document.getElementById('ek-transcript-styles')) return;
    const style = document.createElement('style');
    style.id = 'ek-transcript-styles';
    style.textContent = `
      #ek-transcript-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9998;
        background: #2a2e36;
        color: #fff;
        border: 1px solid #3a3f4b;
        border-radius: 999px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(0,0,0,0.4);
        transition: transform 0.1s ease, background 0.15s ease;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #ek-transcript-btn:hover {
        background: #3a3f4b;
        transform: translateY(-2px);
      }
      #ek-transcript-badge {
        background: #ffb300;
        color: #000;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 800;
        min-width: 20px;
        text-align: center;
      }
      #ek-transcript-panel {
        position: fixed;
        inset: 40px;
        background: #15171c;
        border: 1px solid #2b2e36;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        z-index: 9999;
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }
      #ek-transcript-panel.open { display: flex; }
      #ek-transcript-header {
        padding: 16px 20px;
        border-bottom: 1px solid #2b2e36;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      #ek-transcript-header h2 {
        margin: 0;
        font-size: 18px;
        color: #fff;
        font-weight: 800;
      }
      #ek-transcript-header .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      #ek-transcript-header button {
        background: #2a2e36;
        color: #fff;
        border: 1px solid #3a3f4b;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
      }
      #ek-transcript-header button.primary {
        background: #ffb300;
        color: #000;
        border-color: #ffb300;
      }
      #ek-transcript-header button:hover {
        filter: brightness(1.1);
      }
      #ek-transcript-body {
        flex: 1;
        overflow: auto;
        padding: 16px 20px;
      }
      #ek-transcript-empty {
        text-align: center;
        color: #9aa4b2;
        padding: 40px 20px;
        font-size: 14px;
      }
      .ek-turn {
        display: grid;
        grid-template-columns: 60px 90px 1fr;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid #21232b;
        font-size: 14px;
        line-height: 1.5;
      }
      .ek-turn-diag {
        border-bottom-color: #1a1c22;
        padding: 3px 0;
        opacity: 0.75;
      }
      .ek-turn-time {
        color: #6b7280;
        font-family: ui-monospace, 'SF Mono', Monaco, Consolas, monospace;
        font-size: 11px;
      }
      .ek-turn-speaker {
        font-weight: 800;
        font-size: 12px;
        letter-spacing: 0.3px;
        text-transform: uppercase;
      }
      .ek-turn-speaker.ryan { color: #ffb300; }
      .ek-turn-speaker.mary { color: #ff9ec7; }
      .ek-turn-speaker.user { color: #7aa8ff; }
      .ek-turn-speaker.daniel { color: #7aa8ff; }
      .ek-turn-speaker.user_prompt { color: #94f1b6; }
      .ek-turn-speaker.system { color: #9aa4b2; }
      .ek-turn-speaker.diag { color: #3d4450; font-weight: 600; }
      .ek-turn-text { color: #e3eaf4; }
      .ek-turn-text-diag {
        color: #4a5260;
        font-family: ui-monospace, 'SF Mono', Monaco, Consolas, monospace;
        font-size: 11px;
      }
      .ek-turn-meta {
        color: #ff9a8b;
        font-size: 11px;
        font-style: italic;
        margin-top: 4px;
      }
      .ek-scenario-divider {
        background: #1a1c22;
        color: #a8c5ff;
        padding: 8px 12px;
        margin: 14px 0 6px 0;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.3px;
        text-transform: uppercase;
      }
      .ek-gap {
        color: #6b7280;
        font-size: 11px;
      }
      .ek-gap.slow { color: #ff9a8b; }
      .ek-gap.fast { color: #94f1b6; }

      @media (max-width: 720px) {
        #ek-transcript-panel { inset: 10px; }
        #ek-transcript-btn {
          bottom: 10px;
          right: 10px;
          padding: 8px 12px;
          font-size: 12px;
        }
        .ek-turn {
          grid-template-columns: 1fr;
          gap: 2px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildUI() {
    // Floating button
    const btn = document.createElement('button');
    btn.id = 'ek-transcript-btn';
    btn.innerHTML = '📋 Transcript <span id="ek-transcript-badge">0</span>';
    btn.title = 'View session transcript';
    btn.onclick = openPanel;
    document.body.appendChild(btn);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'ek-transcript-panel';
    panel.innerHTML = `
      <div id="ek-transcript-header">
        <h2>📋 Session Transcript</h2>
        <div class="actions">
          <button id="ek-tr-copy" class="primary">📄 Copy All</button>
          <button id="ek-tr-clear">🗑 Clear</button>
          <button id="ek-tr-close">✕ Close</button>
        </div>
      </div>
      <div id="ek-transcript-body"></div>
    `;
    document.body.appendChild(panel);

    document.getElementById('ek-tr-close').onclick = closePanel;
    document.getElementById('ek-tr-clear').onclick = clearTranscript;
    document.getElementById('ek-tr-copy').onclick = copyTranscript;

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
    });
  }

  function updateBadge() {
    const badge = document.getElementById('ek-transcript-badge');
    // Badge shows only conversation turns, not diagnostic events
    if (badge) badge.textContent = String(transcriptLog.filter(e => !e.isdiag).length);
  }

  function renderTranscript() {
    const body = document.getElementById('ek-transcript-body');
    if (!body) return;

    if (transcriptLog.length === 0) {
      body.innerHTML = `
        <div id="ek-transcript-empty">
          No turns recorded yet.<br>
          Start a scenario and the transcript will appear here.
        </div>
      `;
      return;
    }

    const html = [];
    let lastScenario = null;
    let lastElapsed = 0;

    transcriptLog.forEach((entry, i) => {
      // Diagnostic events: compact monospace row
      if (entry.isdiag) {
        html.push(`
          <div class="ek-turn ek-turn-diag">
            <div class="ek-turn-time" style="font-size:10px">${formatTimestampMs(entry.elapsed)}</div>
            <div class="ek-turn-speaker diag">diag</div>
            <div class="ek-turn-text-diag">${escapeHtml(entry.text)}</div>
          </div>
        `);
        return;
      }

      if (entry.scenarioTitle !== lastScenario) {
        html.push(`<div class="ek-scenario-divider">📖 ${escapeHtml(entry.scenarioTitle)} — ${entry.mode}</div>`);
        lastScenario = entry.scenarioTitle;
      }

      const gap = entry.elapsed - lastElapsed;
      const gapSec = (gap / 1000).toFixed(1);
      let gapClass = '';
      if (gap > 2500) gapClass = 'slow';
      else if (gap < 500) gapClass = 'fast';
      const gapDisplay = i === 0 ? '' : `<span class="ek-gap ${gapClass}">+${gapSec}s</span>`;

      const speakerClass = entry.speaker.toLowerCase().replace(/[^a-z]/g, '');
      const metaHtml = entry.meta ? `<div class="ek-turn-meta">${escapeHtml(entry.meta)}</div>` : '';

      html.push(`
        <div class="ek-turn">
          <div class="ek-turn-time">${formatTimestamp(entry.elapsed)}<br>${gapDisplay}</div>
          <div class="ek-turn-speaker ${speakerClass}">${escapeHtml(entry.speaker)}</div>
          <div>
            <div class="ek-turn-text">${escapeHtml(entry.text)}</div>
            ${metaHtml}
          </div>
        </div>
      `);
      lastElapsed = entry.elapsed;
    });

    body.innerHTML = html.join('');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openPanel() {
    renderTranscript();
    document.getElementById('ek-transcript-panel').classList.add('open');
  }

  function closePanel() {
    document.getElementById('ek-transcript-panel').classList.remove('open');
  }

  function clearTranscript() {
    if (!confirm('Clear the entire transcript? This cannot be undone.')) return;
    transcriptLog = [];
    sessionStartTime = Date.now();
    saveToStorage();
    updateBadge();
    renderTranscript();
  }

  async function copyTranscript() {
    const text = formatTranscriptForCopy();
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('ek-tr-copy');
      const orig = btn.innerHTML;
      btn.innerHTML = '✓ Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 1800);
    } catch (e) {
      // Fallback: show text in a textarea for manual copy
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:50px;left:50px;width:80vw;height:60vh;z-index:10000';
      document.body.appendChild(ta);
      ta.select();
      alert('Automatic copy blocked by browser. Press Ctrl+C to copy, then close the textarea.');
      ta.onblur = () => ta.remove();
    }
  }

  // ============ Hooks into player.js ============

  function installHooks() {

    // ── Hook 0: KokoroSpeech.cancel — detect external mid-play cancellations ──
    // Internal cancel() calls (at the start of every speak()) fire within a few ms
    // of AUDIO_START. External cancellations (stopEverything, rapid scenario switch)
    // fire while audio is actually playing — well past 150ms after AUDIO_START.
    if (window.KokoroSpeech && typeof window.KokoroSpeech.cancel === 'function') {
      const _origKokoroCancel = window.KokoroSpeech.cancel;
      window.KokoroSpeech.cancel = function () {
        if (_diag_isPlaying && (Date.now() - _diag_audioStartMs) > 150) {
          _diag_isPlaying = false; // signals speak() finally → AUDIO_CANCELLED
        }
        return _origKokoroCancel.apply(this, arguments);
      };
    }

    // ── Hook 1: speak() — AUDIO_START / AUDIO_END / AUDIO_CANCELLED / OVERLAP_EVENT ──
    if (typeof window.speak === 'function') {
      const _origSpeak = window.speak;
      window.speak = async function (text, speaker, onAudioReady, prefetchedUrl) {
        // Main conversation log entry (existing)
        logEntry(speaker || 'AI', text);

        // Overlap: if previous audio is still tracked as in-flight
        if (_diag_isPlaying && _diag_playingText) {
          logDiag(`OVERLAP_EVENT: cancelled mid-play — "${_diag_playingText.slice(0, 40)}" interrupted by "${(text || '').slice(0, 40)}"`);
        }

        logDiag(`AUDIO_START: ${(text || '').slice(0, 40)}`);
        _diag_isPlaying = true;
        _diag_playingText = text || '';
        _diag_audioStartMs = Date.now();

        try {
          return await _origSpeak.apply(this, arguments);
        } finally {
          if (_diag_isPlaying) {
            logDiag('AUDIO_END');
            _diag_isPlaying = false;
          } else {
            logDiag('AUDIO_CANCELLED');
          }
          _diag_playingText = null;
        }
      };
    }

    // ── Hook 2: getDynamicMaryResponse — log user + Mary dynamic reply ──
    if (typeof window.getDynamicMaryResponse === 'function') {
      const originalGetMary = window.getDynamicMaryResponse;
      window.getDynamicMaryResponse = async function (userSaid) {
        logEntry('User', userSaid, { meta: 'transcribed from voice' });
        const result = await originalGetMary.apply(this, arguments);
        if (result) {
          logEntry('Mary', result, { meta: 'dynamic response' });
        } else {
          logEntry('System', '(Mary API failed or timed out — fallback used)', { meta: 'error' });
        }
        return result;
      };
    }

    // ── Hook 3: listenForUser — conversation-level user turn logging ──
    if (typeof window.listenForUser === 'function') {
      const originalListen = window.listenForUser;
      window.listenForUser = async function (mySession, timeoutMs) {
        const startedAt = Date.now();
        const result = await originalListen.apply(this, arguments);
        const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
        if (result) {
          const lastLog = transcriptLog.filter(e => !e.isdiag).pop();
          const alreadyLogged = lastLog &&
            lastLog.speaker === 'User' &&
            lastLog.text === result &&
            (Date.now() - lastLog.timestamp) < 1500;
          if (!alreadyLogged) {
            logEntry('User', result, { meta: `heard in ${duration}s` });
          }
        } else {
          logEntry('System', '(No speech detected)', { meta: `${duration}s elapsed` });
        }
        return result;
      };
    }

    // ── Hook 4: SpeechRecognition — raw STT_START / STT_STOP / STT_RESULT ──
    const _SRClass = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (_SRClass) {
      const _OrigSR = _SRClass;
      function PatchedSR() {
        const inst = new _OrigSR();
        const _origStart = inst.start.bind(inst);
        const _origStop  = inst.stop.bind(inst);
        inst.start = function () { logDiag('STT_START'); return _origStart(); };
        inst.stop  = function () { logDiag('STT_STOP');  return _origStop();  };
        return new Proxy(inst, {
          set(target, prop, value) {
            if (prop === 'onresult' && typeof value === 'function') {
              target[prop] = function (e) {
                const last = e.results[e.results.length - 1];
                const heard = (last && last[0] ? last[0].transcript : '') || '';
                if (heard) {
                  logDiag(`STT_RESULT${last && last.isFinal ? '' : '(interim)'}: ${heard.slice(0, 80)}`);
                }
                return value.call(this, e);
              };
            } else {
              target[prop] = value;
            }
            return true;
          }
        });
      }
      PatchedSR.prototype = _OrigSR.prototype;
      if (window.webkitSpeechRecognition) window.webkitSpeechRecognition = PatchedSR;
      if (window.SpeechRecognition)        window.SpeechRecognition        = PatchedSR;
    }

    // ── Hook 5: setMediaForSpeaker — VIDEO_STATE: <speaking|idle> <src> ──
    if (typeof window.setMediaForSpeaker === 'function') {
      const _origSetMedia = window.setMediaForSpeaker;
      window.setMediaForSpeaker = function (speaker) {
        const result = _origSetMedia.apply(this, arguments);
        const el = window.els && window.els.media;
        const src = el
          ? (el.getAttribute('src') || el.src || '').split('/').pop().split('?')[0]
          : '';
        const state = (speaker === 'Mary') ? 'speaking' : 'idle';
        logDiag(`VIDEO_STATE: ${state} ${src || '(orb)'}`);
        return result;
      };
    }

    // ── Hook 6: playScenario — scenario start marker ──
    if (typeof window.playScenario === 'function') {
      const originalPlay = window.playScenario;
      window.playScenario = function (key, practice) {
        currentScenarioId = key;
        saveToStorage();
        const sc = window.SCENARIOS && window.SCENARIOS[key];
        const title = sc ? sc.title : key;
        const mode = practice ? 'PRACTICE' : 'DEMO';
        logEntry('System', `▶ Started: ${title} [${mode} mode]`, { meta: 'scenario start' });
        return originalPlay.apply(this, arguments);
      };
    }
  }

  // ============ Boot ============

  function boot() {
    // Wait for player.js to load and expose its functions globally.
    if (typeof window.speak !== 'function' || typeof window.playScenario !== 'function') {
      setTimeout(boot, 200);
      return;
    }

    loadFromStorage();
    injectStyles();
    buildUI();
    installHooks();
    updateBadge();

    console.log('[Transcript] Tool loaded. Press 📋 button to view session.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
