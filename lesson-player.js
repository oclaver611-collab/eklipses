// ===================================================================
// Eklipses — Lesson Player Module
// Handles LEARN tab, Lesson 1 player, completion, certification
// ===================================================================
(function () {
  'use strict';

  const R2_BASE = 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev';
  const SOFIA_IDLE   = R2_BASE + '/sofia_idle.mp4';
  const SOFIA_SPEAK  = R2_BASE + '/sofia_speaking.mp4';
  const SOFIA_THUMB  = R2_BASE + '/sofia_thumb.jpg';

  const LS_PROGRESS = 'eklipses_lesson1_progress';
  const LS_COMPLETE = 'eklipses_lesson1_complete';
  const LS_CERT     = 'eklipses_lesson1_certification';

  const SEGMENTS = [
    { id:'01', type:'A', title:'Lesson Intro' },
    { id:'02', type:'A', title:'Before The Approach' },
    { id:'03', type:'B', title:'The Approach — Live Exchange',    sofiaLines:["...sure.", "...that's a strange thing to notice."] },
    { id:'04', type:'A', title:'Step 1 — The Observation Opener' },
    { id:'05', type:'B', title:'The Tease — Live Exchange',        sofiaLines:["...maybe.", "Should I?", "...you're very observant."] },
    { id:'06', type:'A', title:'Step 2 — Playful Challenge' },
    { id:'07', type:'B', title:'The Sensitive Topic — Live Exchange', sofiaLines:["Why — are you trying to figure out if I'm worth talking to?", "...I'm just making conversation.", "...that's a very careful answer."] },
    { id:'08', type:'A', title:'Step 3 — Owning Your Mystery' },
    { id:'09', type:'B', title:'The Verbal Spike — Live Exchange', sofiaLines:["What?", "...most people find that strange.", "...that's actually a nice thing to say."] },
    { id:'10', type:'A', title:'Step 4 — The Verbal Spike' },
    { id:'11', type:'B', title:'The Close — Live Exchange',       sofiaLines:["...is that a complaint?", "...yeah. I'd like that.", "...confident."] },
    { id:'12', type:'A', title:'Step 5 — The Natural Close' },
    { id:'13', type:'A', title:'Summary and Send-Off' },
  ];

  const COMPLETION_STEPS = [
    'The observation opener',
    'Playful challenge',
    'Own your mystery',
    'The verbal spike',
    'The natural close',
  ];

  // ── localStorage helpers ───────────────────────────────────────────
  function lsGet(key, def) { try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; } catch { return def; } }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  function getCert() {
    const raw = lsGet(LS_CERT, null);
    if (raw) return raw;
    // Initialize with all known character IDs
    const ids = (window.AVATAR_SETS || []).map(s => s.id);
    const obj = {};
    ids.forEach(id => { obj[id] = { attempts:0, passed:0, certified:false }; });
    return obj;
  }

  function saveCert(obj) { lsSet(LS_CERT, obj); }

  // ── Public API ─────────────────────────────────────────────────────
  window.LessonPlayer = {
    isComplete: () => lsGet(LS_COMPLETE, null) === true,
    getProgress: () => lsGet(LS_PROGRESS, null),
    getCertForCharacter: (charId) => { const c = getCert(); return c[charId] || { attempts:0, passed:0, certified:false }; },
    recordCoachResult: (charId, passed) => {
      const cert = getCert();
      if (!cert[charId]) cert[charId] = { attempts:0, passed:0, certified:false };
      cert[charId].attempts++;
      if (passed) { cert[charId].passed++; cert[charId].certified = true; }
      saveCert(cert);
      refreshLearnTabStatus();
      if (window.refreshCertBadges) window.refreshCertBadges();
    },
    openLesson: openLesson,
    renderLearnTab: renderLearnTab,
  };

  // ── Tab management ─────────────────────────────────────────────────
  function switchTab(tab) {
    const learnTab  = document.getElementById('ek-learn-tab');
    const practiceTab = document.getElementById('ek-practice-wrap');
    const btnLearn  = document.getElementById('ek-tab-learn');
    const btnPrac   = document.getElementById('ek-tab-practice');
    const banner    = document.getElementById('ek-practice-banner');

    if (!learnTab || !practiceTab) return;

    if (tab === 'learn') {
      learnTab.style.display   = '';
      practiceTab.style.display = 'none';
      btnLearn.classList.add('ek-tab-active');
      btnPrac.classList.remove('ek-tab-active');
      if (banner) banner.style.display = 'none';
    } else {
      learnTab.style.display   = 'none';
      practiceTab.style.display = '';
      btnLearn.classList.remove('ek-tab-active');
      btnPrac.classList.add('ek-tab-active');
      // Show warning banner if lesson not complete
      if (banner && !LessonPlayer.isComplete()) {
        const dismissed = sessionStorage.getItem('ek-lesson-banner-dismissed');
        if (!dismissed) banner.style.display = 'flex';
      }
    }
  }

  function initTabs() {
    const btnLearn = document.getElementById('ek-tab-learn');
    const btnPrac  = document.getElementById('ek-tab-practice');
    const banner   = document.getElementById('ek-practice-banner');
    if (!btnLearn || !btnPrac) return;

    btnLearn.onclick = () => switchTab('learn');
    btnPrac.onclick  = () => switchTab('practice');

    const goL1  = document.getElementById('ek-banner-go-lesson');
    const disBtn = document.getElementById('ek-banner-dismiss');
    if (goL1)  goL1.onclick  = () => { switchTab('learn'); };
    if (disBtn) disBtn.onclick = () => { sessionStorage.setItem('ek-lesson-banner-dismissed','1'); if(banner) banner.style.display='none'; };

    // Default to LEARN tab
    switchTab('learn');
  }

  // ── Learn tab rendering ────────────────────────────────────────────
  function getLesson1Status() {
    if (LessonPlayer.isComplete()) return 'completed';
    const prog = LessonPlayer.getProgress();
    if (prog && prog !== '01') return 'in_progress';
    return 'not_started';
  }

  function getCertifiedCount() {
    const cert = getCert();
    return Object.values(cert).filter(v => v.certified).length;
  }

  function renderLearnTab() {
    const container = document.getElementById('ek-learn-tab');
    if (!container) return;
    const status = getLesson1Status();
    const certCount = getCertifiedCount();
    const totalAvatars = (window.AVATAR_SETS || []).filter(s => !s.hidden).length;

    const statusHtml = status === 'completed'
      ? '<span class="ek-lesson-status completed">COMPLETED ✓</span>'
      : status === 'in_progress'
      ? '<span class="ek-lesson-status in-progress">IN PROGRESS</span>'
      : '<span class="ek-lesson-status not-started">NOT STARTED</span>';

    const certHtml = status === 'completed'
      ? `<div class="ek-cert-bar">
           <div class="ek-cert-label">Certified on <b>${certCount}</b> / ${totalAvatars} avatars
             ${certCount >= 3 ? '<span class="ek-cert-badge">CERTIFIED</span>' : ''}
           </div>
           <div class="ek-cert-track">
             <div class="ek-cert-fill" style="width:${Math.min(100, (certCount/totalAvatars)*100)}%"></div>
           </div>
         </div>`
      : '';

    container.innerHTML = `
      <div class="ek-learn-inner">
        <div class="ek-lesson-card">
          <div class="ek-lesson-card-header">
            <span class="ek-lesson-num">LESSON 1</span>
            ${statusHtml}
          </div>
          <div class="ek-lesson-title">The Approach</div>
          <div class="ek-lesson-desc">Learn how to stop a woman you've never met and make her glad you did. 5 core principles. ~10 min.</div>
          ${certHtml}
          <button class="ek-start-btn" id="ek-start-lesson1">
            ${status === 'completed' ? '↺ Review Lesson' : status === 'in_progress' ? '▶ Continue Lesson' : '▶ Start Lesson'}
          </button>
        </div>

        <div class="ek-lesson-card locked">
          <div class="ek-lesson-card-header">
            <span class="ek-lesson-num">🔒 LESSON 2</span>
          </div>
          <div class="ek-lesson-title">Coming Soon</div>
          <div class="ek-lesson-desc">Complete Lesson 1 to unlock</div>
        </div>
      </div>
    `;

    const btn = document.getElementById('ek-start-lesson1');
    if (btn) btn.onclick = () => openLesson(status === 'in_progress' ? LessonPlayer.getProgress() : '01');
  }

  function refreshLearnTabStatus() {
    renderLearnTab();
  }

  // ── Lesson Player overlay ──────────────────────────────────────────
  let _playerEl = null;
  let _currentSegIdx = 0;
  let _playing = false;
  let _currentAudio = null;
  let _aborted = false;

  function buildPlayerHTML() {
    const el = document.createElement('div');
    el.id = 'ek-lesson-player';
    el.innerHTML = `
      <div class="elp-overlay">
        <button class="elp-close" id="elp-close" title="Exit lesson">✕</button>

        <div class="elp-stage">
          <div class="elp-avatar-area" id="elp-avatar-area">
            <!-- Ryan orb or Sofia video goes here -->
          </div>
          <div class="elp-caption" id="elp-caption"></div>
        </div>

        <div class="elp-bottom">
          <div class="elp-seg-title" id="elp-seg-title"></div>
          <div class="elp-progress-bar">
            <div class="elp-progress-fill" id="elp-progress-fill"></div>
          </div>
          <div class="elp-progress-label" id="elp-progress-label">1 / 13</div>
        </div>

        <!-- Completion screen -->
        <div class="elp-complete" id="elp-complete" style="display:none">
          <div class="elp-complete-inner">
            <div class="elp-complete-check">✓</div>
            <div class="elp-complete-title">Lesson 1 Complete</div>
            <div class="elp-complete-sub">"The Approach" — 5 principles mastered.</div>
            <div class="elp-complete-body">Now put it into practice. The avatars are waiting — and they know exactly what you should be doing.</div>
            <div class="elp-complete-steps">
              <div class="elp-step"><span class="elp-step-n">1.</span> The observation opener</div>
              <div class="elp-step"><span class="elp-step-n">2.</span> Playful challenge</div>
              <div class="elp-step"><span class="elp-step-n">3.</span> Own your mystery</div>
              <div class="elp-step"><span class="elp-step-n">4.</span> The verbal spike</div>
              <div class="elp-step"><span class="elp-step-n">5.</span> The natural close</div>
            </div>
            <div class="elp-complete-btns">
              <button class="elp-btn-primary" id="elp-go-practice">Go to Practice</button>
              <button class="elp-btn-ghost" id="elp-review-lesson">Review Lesson</button>
            </div>
          </div>
        </div>

        <!-- Exit confirm dialog -->
        <div class="elp-exit-confirm" id="elp-exit-confirm" style="display:none">
          <div class="elp-exit-box">
            <div class="elp-exit-title">Are you sure?</div>
            <div class="elp-exit-sub">Your progress will be saved. You can resume anytime.</div>
            <div class="elp-exit-btns">
              <button class="elp-btn-primary" id="elp-exit-yes">Exit lesson</button>
              <button class="elp-btn-ghost" id="elp-exit-no">Keep watching</button>
            </div>
          </div>
        </div>
      </div>
    `;
    return el;
  }

  function getPlayerCSS() {
    return `
      #ek-lesson-player { position:fixed; inset:0; z-index:99000; }
      .elp-overlay { position:absolute; inset:0; background:#080a0e; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:16px; }
      .elp-close { position:absolute; top:14px; right:16px; background:rgba(255,255,255,.12); border:none; color:#fff; font-size:20px; width:36px; height:36px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10; }
      .elp-close:hover { background:rgba(255,255,255,.22); }

      .elp-stage { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; max-width:860px; gap:16px; }
      .elp-avatar-area { width:100%; max-width:540px; height:320px; display:flex; align-items:center; justify-content:center; position:relative; }
      .elp-avatar-area video { width:100%; height:100%; object-fit:cover; border-radius:16px; }

      /* Ryan orb inside player */
      .elp-ryan-orb { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
      .elp-orb-wrap { position:relative; width:140px; height:140px; display:flex; align-items:center; justify-content:center; }
      .elp-orb-ring { position:absolute; border-radius:50%; border:1.5px solid #378ADD; opacity:0; transition:opacity .3s; }
      .elp-orb-ring.r1 { width:140px; height:140px; }
      .elp-orb-ring.r2 { width:168px; height:168px; }
      .elp-orb-circle { width:120px; height:120px; border-radius:50%; background:#378ADD; display:flex; align-items:center; justify-content:center; }
      .elp-orb-inner  { width:82px; height:82px; border-radius:50%; background:#185FA5; display:flex; align-items:center; justify-content:center; }
      .elp-orb-lbl { font-size:18px; font-weight:700; color:#B5D4F4; letter-spacing:.1em; }
      .elp-orb-bars { display:flex; align-items:flex-end; gap:4px; height:36px; }
      .elp-orb-bar { width:5px; background:#378ADD; border-radius:3px; min-height:4px; transition:height .1s; }
      .elp-orb-name { font-size:14px; color:#B5D4F4; font-weight:600; letter-spacing:.08em; }

      .elp-caption { font-size:17px; color:#e3eaf4; text-align:center; max-width:640px; min-height:48px; line-height:1.5; padding:0 20px; }

      .elp-bottom { width:100%; max-width:860px; }
      .elp-seg-title { font-size:12px; color:#556; text-transform:uppercase; letter-spacing:.1em; text-align:center; margin-bottom:8px; }
      .elp-progress-bar { background:#1a1e26; border-radius:4px; height:4px; width:100%; }
      .elp-progress-fill { background:#378ADD; height:4px; border-radius:4px; transition:width .4s ease; }
      .elp-progress-label { font-size:12px; color:#556; text-align:center; margin-top:6px; }

      /* Completion screen */
      .elp-complete { position:absolute; inset:0; background:#080a0e; display:flex; align-items:center; justify-content:center; z-index:5; }
      .elp-complete-inner { max-width:480px; width:90%; text-align:center; }
      .elp-complete-check { font-size:56px; color:#4caf50; margin-bottom:12px; }
      .elp-complete-title { font-size:26px; font-weight:700; color:#fff; margin-bottom:8px; }
      .elp-complete-sub { font-size:16px; color:#ffb300; margin-bottom:16px; font-weight:600; }
      .elp-complete-body { font-size:15px; color:#9aa4b2; margin-bottom:24px; line-height:1.6; }
      .elp-complete-steps { text-align:left; margin-bottom:28px; }
      .elp-step { font-size:14px; color:#cfd6e4; padding:6px 0; border-bottom:1px solid #1e2028; display:flex; gap:10px; }
      .elp-step-n { color:#378ADD; font-weight:700; min-width:22px; }
      .elp-complete-btns { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }

      /* Exit confirm */
      .elp-exit-confirm { position:absolute; inset:0; background:rgba(0,0,0,.85); display:flex; align-items:center; justify-content:center; z-index:10; }
      .elp-exit-box { background:#15171c; border:1px solid #2b2e36; border-radius:14px; padding:28px; max-width:360px; width:90%; text-align:center; }
      .elp-exit-title { font-size:18px; font-weight:700; color:#fff; margin-bottom:8px; }
      .elp-exit-sub { font-size:14px; color:#9aa4b2; margin-bottom:22px; }
      .elp-exit-btns { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }

      /* Shared buttons */
      .elp-btn-primary { background:#378ADD; color:#fff; border:none; border-radius:8px; padding:11px 24px; font-size:14px; font-weight:700; cursor:pointer; }
      .elp-btn-primary:hover { background:#4a94e0; }
      .elp-btn-ghost { background:transparent; color:#9aa4b2; border:1px solid #2b2e36; border-radius:8px; padding:11px 24px; font-size:14px; cursor:pointer; }
      .elp-btn-ghost:hover { background:#1e2028; }

      /* Sofia idle/speaking label */
      .elp-speaker-label { position:absolute; bottom:10px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.65); color:#fff; font-size:13px; font-weight:600; padding:4px 14px; border-radius:20px; white-space:nowrap; }
    `;
  }

  function injectCSS() {
    if (document.getElementById('ek-lesson-player-css')) return;
    const style = document.createElement('style');
    style.id = 'ek-lesson-player-css';
    style.textContent = getPlayerCSS();
    document.head.appendChild(style);
  }

  // ── Ryan orb in player ─────────────────────────────────────────────
  let _orbAnim = null;
  let _orbT = 0;

  function buildRyanOrb() {
    const d = document.createElement('div');
    d.className = 'elp-ryan-orb';
    d.innerHTML = `
      <div class="elp-orb-wrap">
        <div class="elp-orb-ring r2" id="elp-ring2"></div>
        <div class="elp-orb-ring r1" id="elp-ring1"></div>
        <div class="elp-orb-circle"><div class="elp-orb-inner"><span class="elp-orb-lbl">R</span></div></div>
      </div>
      <div class="elp-orb-bars" id="elp-bars">
        ${[0,1,2,3,4].map(()=>'<div class="elp-orb-bar" style="height:6px"></div>').join('')}
      </div>
      <div class="elp-orb-name">RYAN</div>
    `;
    return d;
  }

  function orbAnimate(speaking) {
    cancelAnimationFrame(_orbAnim);
    _orbT = 0;
    const r1 = document.getElementById('elp-ring1');
    const r2 = document.getElementById('elp-ring2');
    const bars = document.querySelectorAll('.elp-orb-bar');
    if (!r1) return;

    function tick() {
      _orbT += 0.08;
      const t = _orbT;
      if (speaking) {
        r1.style.opacity = (0.25 + 0.18 * Math.sin(t * 2.1)).toFixed(3);
        r2.style.opacity = (0.12 + 0.10 * Math.sin(t * 1.7 + 1)).toFixed(3);
        bars.forEach((b, i) => {
          b.style.height = (6 + 20 * Math.abs(Math.sin(t * 3 + i * 0.7))).toFixed(1) + 'px';
        });
      } else {
        r1.style.opacity = '0.10';
        r2.style.opacity = '0';
        bars.forEach(b => b.style.height = '4px');
      }
      _orbAnim = requestAnimationFrame(tick);
    }
    tick();
  }

  // ── Sofia video element ────────────────────────────────────────────
  function buildSofiaEl() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;height:100%;';
    const v = document.createElement('video');
    v.id = 'elp-sofia-video';
    v.src = SOFIA_IDLE;
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:16px;';
    const lbl = document.createElement('div');
    lbl.className = 'elp-speaker-label';
    lbl.id = 'elp-sofia-label';
    lbl.textContent = 'Sofia';
    wrap.appendChild(v);
    wrap.appendChild(lbl);
    return wrap;
  }

  function setSofiaState(speaking) {
    const v = document.getElementById('elp-sofia-video');
    if (!v) return;
    v.src = speaking ? SOFIA_SPEAK : SOFIA_IDLE;
    v.play().catch(() => {});
  }

  // ── Show Ryan or Sofia in avatar area ─────────────────────────────
  function showRyan() {
    const area = document.getElementById('elp-avatar-area');
    if (!area) return;
    area.innerHTML = '';
    area.appendChild(buildRyanOrb());
    orbAnimate(true);
  }

  function showSofia(speaking) {
    const area = document.getElementById('elp-avatar-area');
    if (!area) return;
    if (!area.querySelector('#elp-sofia-video')) {
      area.innerHTML = '';
      area.appendChild(buildSofiaEl());
    }
    setSofiaState(speaking);
    cancelAnimationFrame(_orbAnim);
  }

  function showRyanWithSofia() {
    // Ryan orb on left, Sofia idle on right
    const area = document.getElementById('elp-avatar-area');
    if (!area) return;
    area.innerHTML = '';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:40px;width:100%;';

    const orbWrap = document.createElement('div');
    orbWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;width:160px;height:240px;';
    orbWrap.appendChild(buildRyanOrb());

    const sofiaWrap = document.createElement('div');
    sofiaWrap.style.cssText = 'width:220px;height:240px;position:relative;';
    const v = document.createElement('video');
    v.id = 'elp-sofia-video';
    v.src = SOFIA_IDLE;
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:12px;';
    const lbl = document.createElement('div');
    lbl.className = 'elp-speaker-label';
    lbl.id = 'elp-sofia-label';
    lbl.textContent = 'Sofia';
    sofiaWrap.appendChild(v);
    sofiaWrap.appendChild(lbl);

    row.appendChild(orbWrap);
    row.appendChild(sofiaWrap);
    area.appendChild(row);
    orbAnimate(true);
  }

  // ── Caption & progress UI ──────────────────────────────────────────
  function setCaption(text) {
    const el = document.getElementById('elp-caption');
    if (el) el.textContent = text || '';
  }

  function updateProgress(idx) {
    const fill  = document.getElementById('elp-progress-fill');
    const label = document.getElementById('elp-progress-label');
    const title = document.getElementById('elp-seg-title');
    const seg   = SEGMENTS[idx];
    if (!fill || !label || !seg) return;
    fill.style.width = ((idx + 1) / SEGMENTS.length * 100).toFixed(1) + '%';
    label.textContent = (idx + 1) + ' / ' + SEGMENTS.length;
    if (title) title.textContent = seg.title;
  }

  // ── Audio helpers ──────────────────────────────────────────────────
  function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

  function playR2Audio(segId) {
    return new Promise((resolve) => {
      const url = `${R2_BASE}/lessons/lesson1/audio/lesson1_seg${segId}.mp3`;
      const audio = new Audio(url);
      _currentAudio = audio;
      audio.onended = () => { _currentAudio = null; resolve(); };
      audio.onerror = () => { _currentAudio = null; resolve(); };
      audio.play().catch(() => { _currentAudio = null; resolve(); });
    });
  }

  async function playSofiaTTS(text) {
    return new Promise(async (resolve) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, characterId: 'sofia' }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) { resolve(); return; }
        const buf = await res.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuf = await audioCtx.decodeAudioData(buf);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(audioCtx.destination);
        source.onended = () => { audioCtx.close(); resolve(); };
        source.start(0);
      } catch (e) {
        resolve();
      }
    });
  }

  // ── Segment sequencer ──────────────────────────────────────────────
  async function runSegment(idx) {
    if (_aborted) return;
    const seg = SEGMENTS[idx];
    updateProgress(idx);
    lsSet(LS_PROGRESS, seg.id);

    if (seg.type === 'A') {
      // Ryan coaching segment — orb + Sofia idle background
      showRyanWithSofia();
      setCaption(seg.title);
      orbAnimate(true);
      await playR2Audio(seg.id);
      if (_aborted) return;
      orbAnimate(false);
      await pause(1000);
    } else {
      // Type B — Live exchange: Ryan MP3 first, then Sofia TTS responses
      showRyanWithSofia();
      setCaption('');
      orbAnimate(true);
      await playR2Audio(seg.id);
      if (_aborted) return;
      orbAnimate(false);

      // Now play Sofia's scripted TTS responses
      for (const line of (seg.sofiaLines || [])) {
        if (_aborted) return;
        showSofia(true);
        setCaption(line);
        await playSofiaTTS(line);
        if (_aborted) return;
        setSofiaState(false);
        setCaption('');
        await pause(500);
      }

      // Switch back to Ryan+Sofia view
      if (!_aborted) {
        showRyanWithSofia();
        orbAnimate(false);
        await pause(1000);
      }
    }

    if (!_aborted) {
      _currentSegIdx = idx + 1;
      if (_currentSegIdx >= SEGMENTS.length) {
        onLessonComplete();
      } else {
        await runSegment(_currentSegIdx);
      }
    }
  }

  function onLessonComplete() {
    lsSet(LS_COMPLETE, true);
    lsSet(LS_PROGRESS, null);
    const completeEl = document.getElementById('elp-complete');
    if (completeEl) completeEl.style.display = '';
    refreshLearnTabStatus();
    cancelAnimationFrame(_orbAnim);
  }

  // ── Open / close lesson ────────────────────────────────────────────
  function openLesson(startSegId) {
    injectCSS();
    _aborted = false;
    cancelAnimationFrame(_orbAnim);
    if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }

    // Remove any existing player
    const existing = document.getElementById('ek-lesson-player');
    if (existing) existing.remove();

    _playerEl = buildPlayerHTML();
    document.body.appendChild(_playerEl);

    // Wire up controls
    document.getElementById('elp-close').onclick = () => {
      const confirm = document.getElementById('elp-exit-confirm');
      if (confirm) confirm.style.display = '';
    };
    document.getElementById('elp-exit-yes').onclick = () => closeLesson();
    document.getElementById('elp-exit-no').onclick = () => {
      const confirm = document.getElementById('elp-exit-confirm');
      if (confirm) confirm.style.display = 'none';
    };
    document.getElementById('elp-go-practice').onclick = () => {
      closeLesson();
      switchTab('practice');
    };
    document.getElementById('elp-review-lesson').onclick = () => {
      const completeEl = document.getElementById('elp-complete');
      if (completeEl) completeEl.style.display = 'none';
      _aborted = false;
      _currentSegIdx = 0;
      runSegment(0);
    };

    // Start from specified segment
    const startIdx = SEGMENTS.findIndex(s => s.id === (startSegId || '01'));
    _currentSegIdx = Math.max(0, startIdx);
    runSegment(_currentSegIdx);
  }

  function closeLesson() {
    _aborted = true;
    cancelAnimationFrame(_orbAnim);
    if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }
    if (_playerEl) { _playerEl.remove(); _playerEl = null; }
    refreshLearnTabStatus();
  }

  // ── Certification badge refresh (called by player.js after coach eval) ─
  window.refreshCertBadges = function () {
    // Trigger re-render of any badge elements already in the DOM
    document.querySelectorAll('[data-cert-char]').forEach(el => {
      const charId = el.getAttribute('data-cert-char');
      const cert = LessonPlayer.getCertForCharacter(charId);
      if (cert.certified) {
        el.textContent = '✓ Certified';
        el.className = 'ek-cert-chip certified';
        el.style.display = '';
      } else if (cert.attempts > 0) {
        el.textContent = 'Practiced';
        el.className = 'ek-cert-chip practiced';
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  };

  // ── Init on DOMContentLoaded ───────────────────────────────────────
  function init() {
    injectCSS();
    renderLearnTab();
    initTabs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
