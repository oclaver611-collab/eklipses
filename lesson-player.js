// ===================================================================
// Eklipses — Lesson Player Module  (v2 — audio_v2 manifest system)
// Handles LEARN tab, Lesson 1 player, completion, certification
// ===================================================================
(function () {
  'use strict';

  const WORKER_BASE  = 'https://eklipses-lesson-audio.oclaver611.workers.dev';
  const R2_BASE      = 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev';
  const SOFIA_IDLE   = R2_BASE + '/sofia_idle.mp4';
  const SOFIA_SPEAK  = R2_BASE + '/sofia_speaking.mp4';

  const LS_PROGRESS  = 'eklipses_lesson1_progress';
  const LS_COMPLETE  = 'eklipses_lesson1_complete';
  const LS_CERT      = 'eklipses_lesson1_certification';

  const SEGMENTS = [
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
    { id:'10b', title:'Watch — The Close' },
    { id:'11',  title:'Watch — The Close' },
    { id:'12',  title:'Step 5 — The Natural Close' },
    { id:'13',  title:'Your Five Steps' },
  ];

  // ── localStorage helpers ───────────────────────────────────────────
  function lsGet(key, def) { try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; } catch { return def; } }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  function getCert() {
    const raw = lsGet(LS_CERT, null);
    if (raw) return raw;
    const ids = (window.AVATAR_SETS || []).map(s => s.id);
    const obj = {};
    ids.forEach(id => { obj[id] = { attempts:0, passed:0, certified:false }; });
    return obj;
  }
  function saveCert(obj) { lsSet(LS_CERT, obj); }

  // ── Public API ─────────────────────────────────────────────────────
  window.LessonPlayer = {
    isComplete:          () => lsGet(LS_COMPLETE, null) === true,
    getProgress:         () => lsGet(LS_PROGRESS, null),
    getCertForCharacter: (charId) => { const c = getCert(); return c[charId] || { attempts:0, passed:0, certified:false }; },
    recordCoachResult:   (charId, passed) => {
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

  // ── Tab management ─────────────────────────────────────────────────
  function switchTab(tab) {
    const learnTab   = document.getElementById('ek-learn-tab');
    const practiceTab = document.getElementById('ek-practice-wrap');
    const btnLearn   = document.getElementById('ek-tab-learn');
    const btnPrac    = document.getElementById('ek-tab-practice');
    const banner     = document.getElementById('ek-practice-banner');
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
    if (goL1)  goL1.onclick  = () => switchTab('learn');
    if (disBtn) disBtn.onclick = () => { sessionStorage.setItem('ek-lesson-banner-dismissed','1'); if (banner) banner.style.display='none'; };
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
    return Object.values(getCert()).filter(v => v.certified).length;
  }

  function renderLearnTab() {
    const container = document.getElementById('ek-learn-tab');
    if (!container) return;
    const status     = getLesson1Status();
    const certCount  = getCertifiedCount();
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
    if (btn) btn.onclick = () => openLesson('00');
  }

  function refreshLearnTabStatus() { renderLearnTab(); }

  // ── Player state ───────────────────────────────────────────────────
  let _playerEl    = null;
  let _currentSegIdx = 0;
  let _aborted     = false;
  let _manifest    = null;
  let _playGen     = 0;       // incremented on navigate/open to invalidate in-flight playback
  let _currentAudio = null;
  let _paused      = false;
  let _resumeResolve = null;  // set when waiting for resume
  let _orbAnim     = null;
  let _orbT        = 0;

  // ── Manifest ───────────────────────────────────────────────────────
  async function loadManifest() {
    if (_manifest) return _manifest;
    const manifestUrl = WORKER_BASE + '?file=manifest.json&t=' + Date.now();
    console.log('[lesson] fetching manifest from:', manifestUrl);
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error('manifest HTTP ' + res.status);
    _manifest = await res.json();
    const fileList = (_manifest.segments || []).flatMap(s => (s.sequence || s.files || []).map(f => f.file));
    console.log('[lesson] manifest loaded — version:', _manifest.version, '| segments:', (_manifest.segments || []).length, '| files:', fileList.length);
    console.log('[lesson] all files in manifest:', fileList);
    return _manifest;
  }

  // ── Pause / resume engine ──────────────────────────────────────────
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

  // ── Sequential audio player ────────────────────────────────────────
  function playOneAudio(url, voice) {
    const filename = decodeURIComponent(url.split('file=').pop());
    // Hoist capturedGen before the Promise so the diagnostic log can reference it
    const capturedGen = _playGen;
    console.log('[AUDIO] attempting:', filename, 'gen:', _playGen, 'captured:', capturedGen);
    return new Promise(res => {
      const a = new Audio(url);
      _currentAudio = a;
      let resolved = false;
      let playStartedAt = null;

      function done() {
        if (resolved) return;
        resolved = true;
        clearTimeout(loadTimeout);
        // Stop and release the audio element — without this, a stale element whose
        // fetch eventually completes will start playing on top of the new segment.
        try { a.pause(); a.src = ''; } catch {}
        if (_currentAudio === a) _currentAudio = null;
        res();
      }

      // Two-phase timeout: short window to catch "never starts", then extended
      // once playing begins to handle long files (Ryan segs can be 40-60s).
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

      // START log fires on the 'play' event — exactly when audio begins.
      // Also extends the timeout: once playing, give 120s for ended to fire.
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

      // Only resolve on 'ended' — the sole signal that playback actually completed.
      // Do NOT resolve on onerror / play().catch(): resolving there is what causes
      // overlap when the localhost proxy is slow — play() rejects due to buffering
      // stall, the sequence advances, then the audio loads and plays on top.
      a.onended = () => {
        const playedMs = playStartedAt ? Date.now() - playStartedAt : 0;
        console.log('[lesson] END', filename, '(' + playedMs + 'ms)');
        if (playedMs < 500) {
          // Guard: 'ended' fired suspiciously fast — duration may be 0 or NaN.
          // Wait out the remainder so a corrupt/empty file can't cascade the lesson.
          console.warn('[lesson] END < 500ms — guarding:', filename, 'only ' + playedMs + 'ms played');
          setTimeout(done, 500 - playedMs);
        } else {
          done();
        }
      };

      // Log errors but do NOT resolve — the 10s timeout is the error exit path.
      a.onerror = (e) => { console.warn('[lesson] audio error:', filename, e); };
      a.play().catch(e => { console.warn('[lesson] play() rejected:', filename, e.message); });
    });
  }

  async function gapMs(ms, gen) {
    if (_aborted || gen !== _playGen) return;
    // Don't start the gap if already paused — wait for resume first
    await whenResumed();
    if (_aborted || gen !== _playGen) return;
    await new Promise(res => setTimeout(res, ms));
  }

  async function playSequence(files, gen) {
    console.log('[SEQUENCE START] segment:', SEGMENTS[_currentSegIdx]?.id, 'gen:', gen, '_playGen:', _playGen);
    for (let i = 0; i < files.length; i++) {
      if (_aborted || gen !== _playGen) return;
      await whenResumed();
      if (_aborted || gen !== _playGen) return;

      const f = files[i];
      const url = WORKER_BASE + '?file=' + encodeURIComponent(f.file);
      console.log('[lesson] playing', f.voice, '→', url);

      onFileStart(f.voice);
      await playOneAudio(url, f.voice);
      if (_aborted || gen !== _playGen) return;
      onFileEnd(f.voice);

      if (i < files.length - 1) await gapMs(700, gen);
    }
  }

  // ── Audio-event driven visual states ──────────────────────────────
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
      // Sofia speaking state is driven by play/pause/ended/error events on the Audio element
    }
  }

  function onFileEnd(voice) {
    // Sofia state driven by audio events — nothing needed here
  }

  // ── Segment runner ─────────────────────────────────────────────────
  async function runSegment(idx) {
    if (_aborted) return;
    const seg = SEGMENTS[idx];
    if (!seg) return;
    _currentSegIdx = idx;
    updateProgress(idx);
    lsSet(LS_PROGRESS, seg.id);

    // Build base display (Ryan orb + Sofia idle) on each segment start
    showRyanWithSofia();

    const gen = _playGen;

    // Get file list from manifest
    let files = [];
    if (_manifest) {
      const segData = _manifest.segments.find(s => s.segmentId === seg.id);
      if (segData) files = segData.sequence || segData.files || [];
    }

    if (files.length === 0) {
      // No audio for this segment — auto-advance after a beat
      await new Promise(res => setTimeout(res, 1500));
    } else {
      await playSequence(files, gen);
    }

    if (_aborted || gen !== _playGen) return;

    // Reset visual state, brief inter-segment pause
    orbAnimate(false);
    setSofiaState(false);
    setOrbSpeaker('ryan');
    await new Promise(res => setTimeout(res, 800));

    if (_aborted || gen !== _playGen) return;

    if (idx + 1 >= SEGMENTS.length) {
      onLessonComplete();
    } else {
      runSegment(idx + 1);
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────
  function navigate(delta) {
    const newIdx = Math.max(0, Math.min(SEGMENTS.length - 1, _currentSegIdx + delta));
    console.log('[NAVIGATE] to index:', newIdx, 'killing gen:', _playGen);
    if (_currentAudio) { _currentAudio.pause(); _currentAudio.src = ''; _currentAudio = null; }
    _playGen++;
    if (_resumeResolve) { const fn = _resumeResolve; _resumeResolve = null; fn(); }
    _paused = false;
    updatePauseBtn();
    runSegment(newIdx);
  }

  // ── Player HTML ────────────────────────────────────────────────────
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
            <div class="elp-mnemonic">
              <div class="elp-mnemonic-label">HOW TO REMEMBER THEM:</div>
              <div class="elp-mnemonic-phrase">One Tequila Makes Ideas Click</div>
              <div class="elp-mnemonic-map">
                <div class="elp-mnemonic-row"><span class="elp-mnemonic-word">One</span><span class="elp-mnemonic-arrow">→</span><span class="elp-mnemonic-meaning">Observe something specific</span></div>
                <div class="elp-mnemonic-row"><span class="elp-mnemonic-word">Tequila</span><span class="elp-mnemonic-arrow">→</span><span class="elp-mnemonic-meaning">Tease playfully</span></div>
                <div class="elp-mnemonic-row"><span class="elp-mnemonic-word">Makes</span><span class="elp-mnemonic-arrow">→</span><span class="elp-mnemonic-meaning">Mystery — don't give it all away</span></div>
                <div class="elp-mnemonic-row"><span class="elp-mnemonic-word">Ideas</span><span class="elp-mnemonic-arrow">→</span><span class="elp-mnemonic-meaning">Imply your interest</span></div>
                <div class="elp-mnemonic-row"><span class="elp-mnemonic-word">Click</span><span class="elp-mnemonic-arrow">→</span><span class="elp-mnemonic-meaning">Close naturally</span></div>
              </div>
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
    `;
  }

  function injectCSS() {
    if (document.getElementById('ek-lesson-player-css')) return;
    const style = document.createElement('style');
    style.id = 'ek-lesson-player-css';
    style.textContent = getPlayerCSS();
    document.head.appendChild(style);
  }

  // ── Ryan orb ───────────────────────────────────────────────────────
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
    if (voice === 'alex') {
      el.textContent = 'ALEX';
      el.classList.add('alex');
    } else {
      el.textContent = 'RYAN';
      el.classList.remove('alex');
    }
  }

  // ── Sofia video ────────────────────────────────────────────────────
  function setSofiaState(speaking) {
    const v = document.getElementById('elp-sofia-video');
    if (!v) return;
    const newSrc = speaking ? SOFIA_SPEAK : SOFIA_IDLE;
    if (v.src !== newSrc) { v.src = newSrc; }
    v.play().catch(() => {});
  }

  // ── Stage layout — always Ryan orb + Sofia side by side ───────────
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

  // ── Progress & caption ─────────────────────────────────────────────
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
    fill.style.width  = ((idx + 1) / SEGMENTS.length * 100).toFixed(1) + '%';
    label.textContent = (idx + 1) + ' / ' + SEGMENTS.length;
    if (title) title.textContent = seg.title;
    setCaption('');
  }

  // ── Completion ─────────────────────────────────────────────────────
  function onLessonComplete() {
    lsSet(LS_COMPLETE, true);
    lsSet(LS_PROGRESS, null);
    cancelAnimationFrame(_orbAnim);
    const el = document.getElementById('elp-complete');
    if (el) el.style.display = '';
    refreshLearnTabStatus();
  }

  // ── Open / close ───────────────────────────────────────────────────
  async function openLesson(startSegId) {
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
    document.getElementById('elp-close').onclick = () => {
      document.getElementById('elp-exit-confirm').style.display = '';
    };
    document.getElementById('elp-exit-yes').onclick  = closeLesson;
    document.getElementById('elp-exit-no').onclick   = () => { document.getElementById('elp-exit-confirm').style.display = 'none'; };
    document.getElementById('elp-pause-btn').onclick = togglePause;
    document.getElementById('elp-back-btn').onclick  = () => navigate(-1);
    document.getElementById('elp-fwd-btn').onclick   = () => navigate(1);
    document.getElementById('elp-go-practice').onclick = () => { closeLesson(); switchTab('practice'); };
    document.getElementById('elp-review-lesson').onclick = () => {
      document.getElementById('elp-complete').style.display = 'none';
      _aborted = false;
      _paused  = false;
      _playGen++;
      runSegment(0);
    };

    // Load manifest (cached after first call)
    try {
      await loadManifest();
    } catch (e) {
      console.error('[lesson] manifest load failed:', e);
      setCaption('Audio unavailable — check connection.');
    }

    const startIdx = SEGMENTS.findIndex(s => s.id === (startSegId || '00'));
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

  // ── Certification badge refresh ────────────────────────────────────
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

  // ── Init ───────────────────────────────────────────────────────────
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
