// ===================================================================
// Eklipses — Lesson Player Module  (v3 — multi-lesson)
// Handles LEARN tab, Lesson 1 + Lesson 2 players, completion
// ===================================================================
(function () {
  'use strict';

  const WORKER_BASE = 'https://eklipses-lesson-audio.oclaver611.workers.dev';
  const R2_BASE     = 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev';
  const SOFIA_IDLE  = R2_BASE + '/sofia_idle.mp4';
  const SOFIA_SPEAK = R2_BASE + '/sofia_speaking.mp4';

  // ── Lesson 1 segment list (navigation order) ──────────────────────
  const SEGMENTS1 = [
    { id:'00',  title:'Welcome' },
    { id:'01',  title:'The Lesson' },
    { id:'02',  title:'Before The Approach' },
    { id:'02b', title:'What Alex Sees' },
    { id:'03',  title:'Watch — The Approach' },
    { id:'04',  title:'Step 1 — The Observation Opener' },
    { id:'05',  title:'Watch — The Tease' },
    { id:'06',  title:'Step 2 — Playful Challenge' },
    { id:'07',  title:'Watch — The Mystery' },
    { id:'08',  title:'Step 3 — Own Your Mystery' },
    { id:'09',  title:'Watch — The Verbal Spike' },
    { id:'10',  title:'Step 4 — The Verbal Spike' },
    { id:'10b', title:'Before The Close' },
    { id:'11',  title:'Watch — The Close' },
    { id:'12',  title:'Step 5 — The Natural Close' },
    { id:'13',  title:'Your Five Steps' },
  ];

  // ── Lesson 2 segment list ─────────────────────────────────────────
  const SEGMENTS2 = [
    { id:'00', title:'Welcome' },
    { id:'01', title:'What FRAME Is' },
    { id:'02', title:'Before the Test' },
    { id:'03', title:'Watch — The Test' },
    { id:'04', title:'F — Feel Nothing' },
    { id:'05', title:'Watch — The Reframe' },
    { id:'06', title:'R — Reframe' },
    { id:'07', title:'Watch — The Humor' },
    { id:'08', title:'A — Add Humor' },
    { id:'09', title:'Watch — The Qualification' },
    { id:'10', title:'M — Make Her Qualify' },
    { id:'11', title:'Watch — The Exit' },
    { id:'12', title:'E — Exit' },
    { id:'13', title:'Your Five Steps' },
  ];

  // ── Lesson config ─────────────────────────────────────────────────
  const LESSONS = {
    lesson1: {
      id:           'lesson1',
      workerPrefix: '',               // backwards compat: no prefix → lesson1/audio_v2
      lsProgress:   'eklipses_lesson1_progress',
      lsComplete:   'eklipses_lesson1_complete',
      lsCert:       'eklipses_lesson1_certification',
      segments:     SEGMENTS1,
      title:        'The Approach',
      completionSub: '"The Approach" — 5 principles mastered.',
      completionBody: 'Now put it into practice. The avatars are waiting — and they know exactly what you should be doing.',
      steps: [
        'The observation opener',
        'Playful challenge',
        'Own your mystery',
        'The verbal spike',
        'The natural close',
      ],
      mnemonicPhrase: 'One Tequila Makes Ideas Click',
      mnemonicMap: [
        { word:'One',     meaning:'Observe something specific' },
        { word:'Tequila', meaning:'Tease playfully' },
        { word:'Makes',   meaning:"Mystery — don't give it all away" },
        { word:'Ideas',   meaning:'Imply your interest' },
        { word:'Click',   meaning:'Close naturally' },
      ],
    },
    lesson2: {
      id:           'lesson2',
      workerPrefix: 'lesson2/',       // file=lesson2/ryan_seg00.mp3 → R2: lessons/lesson2/audio/
      lsProgress:   'eklipses_lesson2_progress',
      lsComplete:   'eklipses_lesson2_complete',
      lsCert:       null,
      segments:     SEGMENTS2,
      title:        'Holding Your Ground',
      completionSub: '"Holding Your Ground" — FRAME mastered.',
      completionBody: 'You know how to hold your ground when things get uncomfortable. Every test asks the same question — who are you under pressure?',
      steps: [
        'F — Feel Nothing: stay still when she tests you',
        'R — Reframe: flip her framing without arguing',
        'A — Add Humor: deflect with ease, not defense',
        'M — Make Her Qualify: stay curious, push deeper',
        'E — Exit: decision-makers leave first',
      ],
      mnemonicPhrase: 'FRAME',
      mnemonicMap: [
        { word:'F', meaning:'Feel Nothing — stay still under pressure' },
        { word:'R', meaning:'Reframe — offer a different way to see it' },
        { word:'A', meaning:"Add Humor — don't defend, just deflect" },
        { word:'M', meaning:'Make Her Qualify — stay curious, push deeper' },
        { word:'E', meaning:'Exit — decision-makers leave first' },
      ],
    },
  };

  // Backwards-compat alias so existing callers work
  const LS_PROGRESS = 'eklipses_lesson1_progress';
  const LS_COMPLETE = 'eklipses_lesson1_complete';
  const LS_CERT     = 'eklipses_lesson1_certification';
  const SEGMENTS    = SEGMENTS1; // used by public API callers

  // ── localStorage helpers ──────────────────────────────────────────
  function lsGet(key, def) { try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; } catch { return def; } }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  // ── Cert (lesson 1 only) ──────────────────────────────────────────
  function getCert() {
    const raw = lsGet(LS_CERT, null);
    if (raw) return raw;
    const ids = (window.AVATAR_SETS || []).map(s => s.id);
    const obj = {};
    ids.forEach(id => { obj[id] = { attempts:0, passed:0, certified:false }; });
    return obj;
  }
  function saveCert(obj) { lsSet(LS_CERT, obj); }

  // ── Per-lesson helpers ────────────────────────────────────────────
  let _currentLessonId = 'lesson1';
  function currentLesson()    { return LESSONS[_currentLessonId] || LESSONS.lesson1; }
  function currentSegments()  { return currentLesson().segments; }

  // ── Public API ────────────────────────────────────────────────────
  window.LessonPlayer = {
    isComplete:           () => lsGet(LS_COMPLETE, null) === true,
    isLesson2Complete:    () => lsGet('eklipses_lesson2_complete', null) === true,
    getProgress:          () => lsGet(LS_PROGRESS, null),
    getCertForCharacter:  (charId) => { const c = getCert(); return c[charId] || { attempts:0, passed:0, certified:false }; },
    recordCoachResult:    (charId, passed) => {
      const cert = getCert();
      if (!cert[charId]) cert[charId] = { attempts:0, passed:0, certified:false };
      cert[charId].attempts++;
      if (passed) { cert[charId].passed++; cert[charId].certified = true; }
      saveCert(cert);
      refreshLearnTabStatus();
      if (window.refreshCertBadges) window.refreshCertBadges();
    },
    openLesson:      openLesson,
    renderLearnTab:  renderLearnTab,
  };

  // ── Tab management ────────────────────────────────────────────────
  function switchTab(tab) {
    const learnTab    = document.getElementById('ek-learn-tab');
    const practiceTab = document.getElementById('ek-practice-wrap');
    const btnLearn    = document.getElementById('ek-tab-learn');
    const btnPrac     = document.getElementById('ek-tab-practice');
    const banner      = document.getElementById('ek-practice-banner');
    if (!learnTab || !practiceTab) return;
    if (tab === 'learn') {
      learnTab.style.display    = '';
      practiceTab.style.display = 'none';
      btnLearn.classList.add('ek-tab-active');
      btnPrac.classList.remove('ek-tab-active');
      if (banner) banner.style.display = 'none';
    } else {
      learnTab.style.display    = 'none';
      practiceTab.style.display = '';
      btnLearn.classList.remove('ek-tab-active');
      btnPrac.classList.add('ek-tab-active');
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
    if (goL1)   goL1.onclick  = () => switchTab('learn');
    if (disBtn) disBtn.onclick = () => { sessionStorage.setItem('ek-lesson-banner-dismissed','1'); if (banner) banner.style.display='none'; };
    switchTab('learn');
  }

  // ── Learn tab rendering ───────────────────────────────────────────
  function getLesson1Status() {
    if (LessonPlayer.isComplete()) return 'completed';
    const prog = LessonPlayer.getProgress();
    if (prog && prog !== '01') return 'in_progress';
    return 'not_started';
  }
  function getLesson2Status() {
    if (lsGet('eklipses_lesson2_complete', null) === true) return 'completed';
    const prog = lsGet('eklipses_lesson2_progress', null);
    if (prog && prog !== '00') return 'in_progress';
    return 'not_started';
  }
  function getCertifiedCount() {
    return Object.values(getCert()).filter(v => v.certified).length;
  }
  function statusChip(status) {
    if (status === 'completed')   return '<span class="ek-lesson-status completed">COMPLETED ✓</span>';
    if (status === 'in_progress') return '<span class="ek-lesson-status in-progress">IN PROGRESS</span>';
    return '<span class="ek-lesson-status not-started">NOT STARTED</span>';
  }

  function renderLearnTab() {
    const container = document.getElementById('ek-learn-tab');
    if (!container) return;

    const l1Status     = getLesson1Status();
    const l2Status     = getLesson2Status();
    const l1Complete   = l1Status === 'completed';
    const certCount    = getCertifiedCount();
    const totalAvatars = (window.AVATAR_SETS || []).filter(s => !s.hidden).length;

    const certHtml = l1Complete
      ? `<div class="ek-cert-bar">
           <div class="ek-cert-label">Certified on <b>${certCount}</b> / ${totalAvatars} avatars
             ${certCount >= 3 ? '<span class="ek-cert-badge">CERTIFIED</span>' : ''}
           </div>
           <div class="ek-cert-track">
             <div class="ek-cert-fill" style="width:${Math.min(100, (certCount/totalAvatars)*100)}%"></div>
           </div>
         </div>`
      : '';

    const l1BtnLabel = l1Status === 'completed' ? '↺ Review Lesson' : l1Status === 'in_progress' ? '▶ Continue Lesson' : '▶ Start Lesson';
    const l2BtnLabel = l2Status === 'completed' ? '↺ Review Lesson' : l2Status === 'in_progress' ? '▶ Continue Lesson' : '▶ Start Lesson';

    const l2LockedHtml = `
      <div class="ek-lesson-card locked">
        <div class="ek-lesson-card-header">
          <span class="ek-lesson-num">🔒 LESSON 2</span>
        </div>
        <div class="ek-lesson-title">Holding Your Ground</div>
        <div class="ek-lesson-desc">Complete Lesson 1 to unlock. Learn to handle tests, pushback, and challenges without flinching. 5 core principles. ~10 min.</div>
      </div>`;

    const l2UnlockedHtml = `
      <div class="ek-lesson-card">
        <div class="ek-lesson-card-header">
          <span class="ek-lesson-num">LESSON 2</span>
          ${statusChip(l2Status)}
        </div>
        <div class="ek-lesson-title">Holding Your Ground</div>
        <div class="ek-lesson-desc">Learn to handle tests, pushback, and challenges without flinching. 5 core principles. ~10 min.</div>
        <div class="ek-lesson-mnemonic-tag">FRAME — Feel nothing · Reframe · Add humor · Make her qualify · Exit</div>
        <button class="ek-start-btn" id="ek-start-lesson2">${l2BtnLabel}</button>
      </div>`;

    container.innerHTML = `
      <div class="ek-learn-inner">
        <div class="ek-lesson-card">
          <div class="ek-lesson-card-header">
            <span class="ek-lesson-num">LESSON 1</span>
            ${statusChip(l1Status)}
          </div>
          <div class="ek-lesson-title">The Approach</div>
          <div class="ek-lesson-desc">Learn how to stop a woman you've never met and make her glad you did. 5 core principles. ~10 min.</div>
          ${certHtml}
          <button class="ek-start-btn" id="ek-start-lesson1">${l1BtnLabel}</button>
        </div>
        ${l1Complete ? l2UnlockedHtml : l2LockedHtml}
      </div>
    `;

    const btn1 = document.getElementById('ek-start-lesson1');
    if (btn1) btn1.onclick = () => openLesson('lesson1', '00');

    const btn2 = document.getElementById('ek-start-lesson2');
    if (btn2) btn2.onclick = () => openLesson('lesson2', '00');
  }

  function refreshLearnTabStatus() { renderLearnTab(); }

  // ── Player state ──────────────────────────────────────────────────
  let _playerEl      = null;
  let _currentSegIdx = 0;
  let _aborted       = false;
  let _manifests     = {};      // keyed by lesson id
  let _playGen       = 0;
  let _currentAudio  = null;
  let _paused        = false;
  let _resumeResolve = null;
  let _orbAnim       = null;
  let _orbT          = 0;

  // ── Manifest (per-lesson cached) ──────────────────────────────────
  async function loadManifest() {
    const lesson = currentLesson();
    if (_manifests[lesson.id]) return _manifests[lesson.id];
    const prefix     = lesson.workerPrefix;
    const manifestUrl = WORKER_BASE + '?file=' + encodeURIComponent(prefix + 'manifest.json') + '&t=' + Date.now();
    console.log('[lesson] fetching manifest from:', manifestUrl);
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error('manifest HTTP ' + res.status);
    const manifest = await res.json();
    const fileList = (manifest.segments || []).flatMap(s => (s.sequence || s.files || []).map(f => f.file));
    console.log('[lesson] manifest loaded — version:', manifest.version, '| segments:', (manifest.segments || []).length, '| files:', fileList.length);
    console.log('[lesson] all files in manifest:', fileList);
    _manifests[lesson.id] = manifest;
    return manifest;
  }

  // ── Pause / resume ────────────────────────────────────────────────
  function whenResumed() {
    if (!_paused) return Promise.resolve();
    return new Promise(res => { _resumeResolve = res; });
  }

  function togglePause() {
    _paused = !_paused;
    if (_paused) {
      if (_currentAudio) _currentAudio.pause();
    } else {
      if (_currentAudio) _currentAudio.play().catch(() => {});
      if (_resumeResolve) { const fn = _resumeResolve; _resumeResolve = null; fn(); }
    }
    updatePauseBtn();
  }

  function updatePauseBtn() {
    const btn = document.getElementById('elp-pause-btn');
    if (btn) { btn.textContent = _paused ? '▶' : '⏸'; btn.title = _paused ? 'Resume' : 'Pause'; }
  }

  // ── Sequential audio player ───────────────────────────────────────
  function playOneAudio(url, voice) {
    const filename    = decodeURIComponent(url.split('file=').pop());
    const capturedGen = _playGen;
    console.log('[AUDIO] attempting:', filename, 'gen:', _playGen, 'captured:', capturedGen);
    return new Promise(res => {
      const a = new Audio(url);
      _currentAudio = a;
      let resolved     = false;
      let playStartedAt = null;

      function done() {
        if (resolved) return;
        resolved = true;
        clearTimeout(loadTimeout);
        try { a.pause(); a.src = ''; } catch {}
        if (_currentAudio === a) _currentAudio = null;
        res();
      }

      let loadTimeout = setTimeout(() => {
        if (capturedGen === _playGen) {
          console.warn('[lesson] TIMEOUT 15s — audio never started:', filename);
          done();
        }
      }, 15000);

      if (voice === 'sofia') {
        a.addEventListener('play',  () => setSofiaState(true));
        a.addEventListener('pause', () => setSofiaState(false));
        a.addEventListener('ended', () => setSofiaState(false));
        a.addEventListener('error', () => setSofiaState(false));
      }

      a.addEventListener('play', () => {
        playStartedAt = Date.now();
        console.log('[lesson] START', filename);
        clearTimeout(loadTimeout);
        loadTimeout = setTimeout(() => {
          if (capturedGen === _playGen) {
            console.warn('[lesson] TIMEOUT 120s — started but never ended:', filename);
            done();
          }
        }, 120000);
      });

      a.onended = () => {
        const playedMs = playStartedAt ? Date.now() - playStartedAt : 0;
        console.log('[lesson] END', filename, '(' + playedMs + 'ms)');
        if (playedMs < 500) {
          console.warn('[lesson] END < 500ms — guarding:', filename, 'only ' + playedMs + 'ms played');
          setTimeout(done, 500 - playedMs);
        } else {
          done();
        }
      };

      a.onerror = (e) => { console.warn('[lesson] audio error:', filename, e); };
      a.play().catch(e => { console.warn('[lesson] play() rejected:', filename, e.message); });
    });
  }

  async function gapMs(ms, gen) {
    if (_aborted || gen !== _playGen) return;
    await whenResumed();
    if (_aborted || gen !== _playGen) return;
    await new Promise(res => setTimeout(res, ms));
  }

  async function playSequence(files, gen) {
    const lesson = currentLesson();
    console.log('[SEQUENCE START] segment:', currentSegments()[_currentSegIdx]?.id, 'gen:', gen, '_playGen:', _playGen);
    for (let i = 0; i < files.length; i++) {
      if (_aborted || gen !== _playGen) return;
      await whenResumed();
      if (_aborted || gen !== _playGen) return;

      const f   = files[i];
      const url = WORKER_BASE + '?file=' + encodeURIComponent(lesson.workerPrefix + f.file);
      console.log('[lesson] playing', f.voice, '→', url);

      onFileStart(f.voice);
      await playOneAudio(url, f.voice);
      if (_aborted || gen !== _playGen) return;
      onFileEnd(f.voice);

      if (i < files.length - 1) await gapMs(700, gen);
    }
  }

  // ── Audio-event driven visual states ─────────────────────────────
  function onFileStart(voice) {
    if (voice === 'ryan') {
      orbAnimate(true);
      setOrbSpeaker('ryan');
      setSofiaState(false);
    } else if (voice === 'alex') {
      orbAnimate(false);
      setOrbSpeaker('alex');
      setSofiaState(false);
    } else if (voice === 'sofia') {
      orbAnimate(false);
      setOrbSpeaker('ryan');
    }
  }
  function onFileEnd() {}

  // ── Segment runner ────────────────────────────────────────────────
  async function runSegment(idx) {
    if (_aborted) return;
    const segs = currentSegments();
    const lesson = currentLesson();
    const seg = segs[idx];
    if (!seg) return;
    _currentSegIdx = idx;
    updateProgress(idx);
    lsSet(lesson.lsProgress, seg.id);

    showRyanWithSofia();

    const gen     = _playGen;
    const manifest = _manifests[lesson.id];

    let files = [];
    if (manifest) {
      const segData = manifest.segments.find(s => s.segmentId === seg.id);
      if (segData) files = segData.sequence || segData.files || [];
    }

    if (files.length === 0) {
      await new Promise(res => setTimeout(res, 1500));
    } else {
      await playSequence(files, gen);
    }

    if (_aborted || gen !== _playGen) return;

    orbAnimate(false);
    setSofiaState(false);
    setOrbSpeaker('ryan');
    await new Promise(res => setTimeout(res, 800));

    if (_aborted || gen !== _playGen) return;

    if (idx + 1 >= segs.length) {
      onLessonComplete();
    } else {
      runSegment(idx + 1);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────
  function navigate(delta) {
    const segs   = currentSegments();
    const newIdx = Math.max(0, Math.min(segs.length - 1, _currentSegIdx + delta));
    console.log('[NAVIGATE] to index:', newIdx, 'killing gen:', _playGen);
    if (_currentAudio) { _currentAudio.pause(); _currentAudio.src = ''; _currentAudio = null; }
    _playGen++;
    if (_resumeResolve) { const fn = _resumeResolve; _resumeResolve = null; fn(); }
    _paused = false;
    updatePauseBtn();
    runSegment(newIdx);
  }

  // ── Player HTML ───────────────────────────────────────────────────
  function buildPlayerHTML() {
    const el = document.createElement('div');
    el.id = 'ek-lesson-player';
    el.innerHTML = `
      <div class="elp-overlay">
        <button class="elp-close" id="elp-close" title="Exit lesson">✕</button>

        <div class="elp-stage">
          <div class="elp-avatar-area" id="elp-avatar-area"></div>
          <div class="elp-caption" id="elp-caption"></div>
        </div>

        <div class="elp-bottom">
          <div class="elp-seg-title" id="elp-seg-title"></div>

          <div class="elp-controls">
            <button class="elp-ctrl-btn" id="elp-back-btn" title="Previous segment">⏮</button>
            <button class="elp-ctrl-btn elp-ctrl-pause" id="elp-pause-btn" title="Pause">⏸</button>
            <button class="elp-ctrl-btn" id="elp-fwd-btn" title="Next segment">⏭</button>
          </div>

          <div class="elp-progress-bar">
            <div class="elp-progress-fill" id="elp-progress-fill"></div>
          </div>
          <div class="elp-progress-label" id="elp-progress-label">1 / 15</div>
        </div>

        <!-- Completion screen — filled dynamically by onLessonComplete() -->
        <div class="elp-complete" id="elp-complete" style="display:none">
          <div class="elp-complete-inner" id="elp-complete-inner"></div>
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

  // ── Completion screen content ─────────────────────────────────────
  function buildCompletionHTML(lesson) {
    const stepsHtml = lesson.steps.map((s, i) => `
      <div class="elp-step"><span class="elp-step-n">${i + 1}.</span> ${s}</div>`).join('');

    const mnemonicRowsHtml = lesson.mnemonicMap.map(r => `
      <div class="elp-mnemonic-row">
        <span class="elp-mnemonic-word">${r.word}</span>
        <span class="elp-mnemonic-arrow">→</span>
        <span class="elp-mnemonic-meaning">${r.meaning}</span>
      </div>`).join('');

    const lessonNum = lesson.id === 'lesson1' ? '1' : '2';

    return `
      <div class="elp-complete-check">✓</div>
      <div class="elp-complete-title">Lesson ${lessonNum} Complete</div>
      <div class="elp-complete-sub">${lesson.completionSub}</div>
      <div class="elp-complete-body">${lesson.completionBody}</div>
      <div class="elp-complete-steps">${stepsHtml}</div>
      <div class="elp-mnemonic">
        <div class="elp-mnemonic-label">HOW TO REMEMBER THEM:</div>
        <div class="elp-mnemonic-phrase">${lesson.mnemonicPhrase}</div>
        <div class="elp-mnemonic-map">${mnemonicRowsHtml}</div>
      </div>
      <div class="elp-complete-btns">
        <button class="elp-btn-primary" id="elp-go-practice">Go to Practice</button>
        <button class="elp-btn-ghost" id="elp-review-lesson">Review Lesson</button>
      </div>`;
  }

  function getPlayerCSS() {
    return `
      #ek-lesson-player { position:fixed; inset:0; z-index:99000; }
      .elp-overlay { position:absolute; inset:0; background:#080a0e; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:16px; }
      .elp-close { position:absolute; top:14px; right:16px; background:rgba(255,255,255,.12); border:none; color:#fff; font-size:20px; width:36px; height:36px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10; }
      .elp-close:hover { background:rgba(255,255,255,.22); }

      .elp-stage { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; max-width:860px; gap:16px; }
      .elp-avatar-area { width:100%; max-width:540px; height:300px; display:flex; align-items:center; justify-content:center; position:relative; }
      .elp-avatar-area video { width:100%; height:100%; object-fit:cover; border-radius:16px; }

      /* Ryan orb */
      .elp-ryan-orb { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; }
      .elp-orb-wrap { position:relative; width:140px; height:140px; display:flex; align-items:center; justify-content:center; }
      .elp-orb-ring { position:absolute; border-radius:50%; border:1.5px solid #378ADD; opacity:0; transition:opacity .3s; }
      .elp-orb-ring.r1 { width:140px; height:140px; }
      .elp-orb-ring.r2 { width:168px; height:168px; }
      .elp-orb-circle { width:120px; height:120px; border-radius:50%; background:#378ADD; display:flex; align-items:center; justify-content:center; }
      .elp-orb-inner  { width:82px; height:82px; border-radius:50%; background:#185FA5; display:flex; align-items:center; justify-content:center; }
      .elp-orb-lbl { font-size:18px; font-weight:700; color:#B5D4F4; letter-spacing:.1em; }
      .elp-orb-bars { display:flex; align-items:flex-end; gap:4px; height:32px; }
      .elp-orb-bar { width:5px; background:#378ADD; border-radius:3px; min-height:4px; transition:height .1s; }
      .elp-orb-name { font-size:13px; font-weight:700; color:#B5D4F4; letter-spacing:.12em; transition:color .2s; }
      .elp-orb-name.alex { color:#f0b429; }

      .elp-caption { font-size:17px; color:#e3eaf4; text-align:center; max-width:640px; min-height:48px; line-height:1.5; padding:0 20px; }

      .elp-bottom { width:100%; max-width:860px; }
      .elp-seg-title { font-size:12px; color:#556; text-transform:uppercase; letter-spacing:.1em; text-align:center; margin-bottom:10px; }

      /* Playback controls */
      .elp-controls { display:flex; align-items:center; justify-content:center; gap:14px; margin-bottom:14px; }
      .elp-ctrl-btn { background:rgba(255,255,255,.08); border:none; color:#cfd6e4; width:38px; height:38px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; }
      .elp-ctrl-btn:hover { background:rgba(255,255,255,.16); }
      .elp-ctrl-pause { width:46px; height:46px; font-size:18px; background:rgba(55,138,221,.18); color:#7eb8f4; }
      .elp-ctrl-pause:hover { background:rgba(55,138,221,.3); }

      .elp-progress-bar { background:#1a1e26; border-radius:4px; height:4px; width:100%; }
      .elp-progress-fill { background:#378ADD; height:4px; border-radius:4px; transition:width .4s ease; }
      .elp-progress-label { font-size:12px; color:#556; text-align:center; margin-top:6px; }

      /* Sofia label */
      .elp-speaker-label { position:absolute; bottom:10px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.65); color:#fff; font-size:13px; font-weight:600; padding:4px 14px; border-radius:20px; white-space:nowrap; }

      /* Completion screen */
      .elp-complete { position:absolute; inset:0; background:#080a0e; display:flex; align-items:center; justify-content:center; z-index:5; overflow-y:auto; }
      .elp-complete-inner { max-width:500px; width:90%; text-align:center; padding:24px 0; }
      .elp-complete-check { font-size:56px; color:#4caf50; margin-bottom:12px; }
      .elp-complete-title { font-size:26px; font-weight:700; color:#fff; margin-bottom:8px; }
      .elp-complete-sub { font-size:16px; color:#ffb300; margin-bottom:16px; font-weight:600; }
      .elp-complete-body { font-size:15px; color:#9aa4b2; margin-bottom:24px; line-height:1.6; }
      .elp-complete-steps { text-align:left; margin-bottom:24px; }
      .elp-step { font-size:14px; color:#cfd6e4; padding:6px 0; border-bottom:1px solid #1e2028; display:flex; gap:10px; }
      .elp-step-n { color:#378ADD; font-weight:700; min-width:22px; }

      /* Mnemonic cheat sheet */
      .elp-mnemonic { background:#0e1420; border:1px solid #1e2e48; border-radius:12px; padding:20px 24px; margin-bottom:28px; text-align:left; }
      .elp-mnemonic-label { font-size:11px; color:#556; text-transform:uppercase; letter-spacing:.12em; margin-bottom:10px; }
      .elp-mnemonic-phrase { font-size:22px; font-weight:800; color:#fff; margin-bottom:16px; letter-spacing:.01em; text-align:center; }
      .elp-mnemonic-map { display:flex; flex-direction:column; gap:8px; }
      .elp-mnemonic-row { display:flex; align-items:baseline; gap:8px; }
      .elp-mnemonic-word { font-size:14px; font-weight:700; color:#378ADD; min-width:68px; }
      .elp-mnemonic-arrow { font-size:13px; color:#3a4455; }
      .elp-mnemonic-meaning { font-size:14px; color:#cfd6e4; }

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

      /* Lesson 2 mnemonic tag on card */
      .ek-lesson-mnemonic-tag { font-size:12px; color:#556; margin-bottom:14px; line-height:1.5; }
    `;
  }

  function injectCSS() {
    if (document.getElementById('ek-lesson-player-css')) return;
    const style = document.createElement('style');
    style.id = 'ek-lesson-player-css';
    style.textContent = getPlayerCSS();
    document.head.appendChild(style);
  }

  // ── Ryan orb ──────────────────────────────────────────────────────
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
        ${[0,1,2,3,4].map(() => '<div class="elp-orb-bar" style="height:6px"></div>').join('')}
      </div>
      <div class="elp-orb-name" id="elp-orb-name">RYAN</div>
    `;
    return d;
  }

  function orbAnimate(speaking) {
    cancelAnimationFrame(_orbAnim);
    _orbT = 0;
    const r1   = document.getElementById('elp-ring1');
    const r2   = document.getElementById('elp-ring2');
    const bars = document.querySelectorAll('.elp-orb-bar');
    if (!r1) return;
    function tick() {
      _orbT += 0.08;
      const t = _orbT;
      if (speaking) {
        r1.style.opacity = (0.25 + 0.18 * Math.sin(t * 2.1)).toFixed(3);
        r2.style.opacity = (0.12 + 0.10 * Math.sin(t * 1.7 + 1)).toFixed(3);
        bars.forEach((b, i) => { b.style.height = (6 + 20 * Math.abs(Math.sin(t * 3 + i * 0.7))).toFixed(1) + 'px'; });
      } else {
        r1.style.opacity = '0.08';
        r2.style.opacity = '0';
        bars.forEach(b => { b.style.height = '4px'; });
      }
      _orbAnim = requestAnimationFrame(tick);
    }
    tick();
  }

  function setOrbSpeaker(voice) {
    const el = document.getElementById('elp-orb-name');
    if (!el) return;
    if (voice === 'alex') { el.textContent = 'ALEX'; el.classList.add('alex'); }
    else                  { el.textContent = 'RYAN'; el.classList.remove('alex'); }
  }

  // ── Sofia video ───────────────────────────────────────────────────
  function setSofiaState(speaking) {
    const v = document.getElementById('elp-sofia-video');
    if (!v) return;
    const newSrc = speaking ? SOFIA_SPEAK : SOFIA_IDLE;
    if (v.src !== newSrc) { v.src = newSrc; }
    v.play().catch(() => {});
  }

  function showRyanWithSofia() {
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
    lbl.textContent = 'Sofia';
    sofiaWrap.appendChild(v);
    sofiaWrap.appendChild(lbl);

    row.appendChild(orbWrap);
    row.appendChild(sofiaWrap);
    area.appendChild(row);

    orbAnimate(false);
  }

  // ── Progress & caption ────────────────────────────────────────────
  function setCaption(text) {
    const el = document.getElementById('elp-caption');
    if (el) el.textContent = text || '';
  }

  function updateProgress(idx) {
    const segs  = currentSegments();
    const fill  = document.getElementById('elp-progress-fill');
    const label = document.getElementById('elp-progress-label');
    const title = document.getElementById('elp-seg-title');
    const seg   = segs[idx];
    if (!fill || !label || !seg) return;
    fill.style.width  = ((idx + 1) / segs.length * 100).toFixed(1) + '%';
    label.textContent = (idx + 1) + ' / ' + segs.length;
    if (title) title.textContent = seg.title;
    setCaption('');
  }

  // ── Completion ────────────────────────────────────────────────────
  function onLessonComplete() {
    const lesson = currentLesson();
    lsSet(lesson.lsComplete, true);
    lsSet(lesson.lsProgress, null);
    cancelAnimationFrame(_orbAnim);

    const inner = document.getElementById('elp-complete-inner');
    if (inner) inner.innerHTML = buildCompletionHTML(lesson);

    const el = document.getElementById('elp-complete');
    if (el) el.style.display = '';

    // Wire completion buttons now that they're in the DOM
    const goPractice = document.getElementById('elp-go-practice');
    if (goPractice) goPractice.onclick = () => { closeLesson(); switchTab('practice'); };

    const reviewBtn = document.getElementById('elp-review-lesson');
    if (reviewBtn) reviewBtn.onclick = () => {
      document.getElementById('elp-complete').style.display = 'none';
      _aborted = false;
      _paused  = false;
      _playGen++;
      runSegment(0);
    };

    refreshLearnTabStatus();
  }

  // ── Open / close ──────────────────────────────────────────────────
  async function openLesson(lessonIdOrSegId, startSegId) {
    // Backwards compat: openLesson('00') → lesson 1, segment 00
    if (!lessonIdOrSegId || !String(lessonIdOrSegId).startsWith('lesson')) {
      _currentLessonId = 'lesson1';
      startSegId = lessonIdOrSegId || '00';
    } else {
      _currentLessonId = lessonIdOrSegId;
      startSegId = startSegId || '00';
    }

    injectCSS();
    _aborted  = false;
    _paused   = false;
    _playGen++;
    cancelAnimationFrame(_orbAnim);
    if (_currentAudio) { _currentAudio.pause(); _currentAudio.src = ''; _currentAudio = null; }
    if (_resumeResolve) { _resumeResolve(); _resumeResolve = null; }

    const existing = document.getElementById('ek-lesson-player');
    if (existing) existing.remove();

    _playerEl = buildPlayerHTML();
    document.body.appendChild(_playerEl);

    // Wire controls
    document.getElementById('elp-close').onclick    = () => { document.getElementById('elp-exit-confirm').style.display = ''; };
    document.getElementById('elp-exit-yes').onclick  = closeLesson;
    document.getElementById('elp-exit-no').onclick   = () => { document.getElementById('elp-exit-confirm').style.display = 'none'; };
    document.getElementById('elp-pause-btn').onclick = togglePause;
    document.getElementById('elp-back-btn').onclick  = () => navigate(-1);
    document.getElementById('elp-fwd-btn').onclick   = () => navigate(1);

    // Load manifest
    try {
      await loadManifest();
    } catch (e) {
      console.error('[lesson] manifest load failed:', e);
      setCaption('Audio unavailable — check connection.');
    }

    const segs     = currentSegments();
    const startIdx = segs.findIndex(s => s.id === (startSegId || '00'));
    runSegment(Math.max(0, startIdx));
  }

  function closeLesson() {
    _aborted = true;
    _playGen++;
    cancelAnimationFrame(_orbAnim);
    if (_currentAudio) { _currentAudio.pause(); _currentAudio.src = ''; _currentAudio = null; }
    if (_resumeResolve) { _resumeResolve(); _resumeResolve = null; }
    if (_playerEl) { _playerEl.remove(); _playerEl = null; }
    refreshLearnTabStatus();
  }

  // ── Certification badge refresh ───────────────────────────────────
  window.refreshCertBadges = function () {
    document.querySelectorAll('[data-cert-char]').forEach(el => {
      const charId = el.getAttribute('data-cert-char');
      const cert   = LessonPlayer.getCertForCharacter(charId);
      if (cert.certified) {
        el.textContent = '✓ Certified';
        el.className   = 'ek-cert-chip certified';
        el.style.display = '';
      } else if (cert.attempts > 0) {
        el.textContent = 'Practiced';
        el.className   = 'ek-cert-chip practiced';
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  };

  // ── Init ──────────────────────────────────────────────────────────
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
