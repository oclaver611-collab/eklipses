/* ===== Global state ===== */
// voices / voiceReady removed — Kokoro JS handles TTS now

let currentScenarioKey = null;
let currentScript = null;
let isPractice = false;

let stepIndex = 0;
let rec = null;
let listenTimer = null;
let session = 0; // increases on each reset to cancel stale work

const els = {
  select: document.getElementById('scenarioSelect'),
  enterPractice: document.getElementById('enterPractice'),
  micBtn: document.getElementById('micBtn'),
  chooseBtn: document.getElementById('chooseAvatarBtn'),
  media: document.getElementById('media'),
  name: document.getElementById('speakerName'),
  text: document.getElementById('lineText'),
  shelf: document.getElementById('shelfList'),
  showMore: document.getElementById('showMore'),
  listenPill: document.getElementById('listenPill'),
  pickerBackdrop: document.getElementById('avatarPicker'),
  pickerGrid: document.getElementById('pickerGrid'),
  likeBtn: document.getElementById('likeBtn'),
  likeCount: document.getElementById('likeCount'),
  viewCount: document.getElementById('viewCount'),
};

/* ============================================================
   Metrics (likes & views) — persisted locally (no server)
   ============================================================ */
const Metrics = (() => {
  const STORAGE_KEY = 'ek-metrics-v1';
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { scenarios:{} }; }
    catch { return { scenarios:{} }; }
  };
  const save = (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  const seedsFor = (id) => {
    const sc = (window.SCENARIOS && window.SCENARIOS[id]) || {};
    const seedLikes = Number.isFinite(sc.seedLikes) ? sc.seedLikes : 0;
    const seedViews = Number.isFinite(sc.seedViews) ? sc.seedViews : 0;
    return { seedLikes, seedViews };
  };
  const ensure = (s,id) => {
    if (!s.scenarios[id]) {
      const { seedLikes, seedViews } = seedsFor(id);
      s.scenarios[id] = { views: seedViews, likes: seedLikes, youLiked:false, lastViewAt:0 };
    }
  };
  const get = (id) => { const s = load(); ensure(s,id); return s.scenarios[id]; };
  const bumpView = (id) => {
    if (!id) return;
    const s = load(); ensure(s,id);
    const m = s.scenarios[id];
    const now = Date.now();
    if (now - (m.lastViewAt || 0) > 30_000) { // throttle: +1 view per 30s
      m.views++; m.lastViewAt = now; save(s);
    }
  };
  const toggleLike = (id) => {
    if (!id) return;
    const s = load(); ensure(s,id);
    const m = s.scenarios[id];
    if (m.youLiked) { m.likes = Math.max(0, m.likes - 1); m.youLiked = false; }
    else { m.likes++; m.youLiked = true; }
    save(s);
    return m;
  };
  const refreshUI = (id) => {
    if (!id) return;
    const m = get(id);
    if (els.viewCount) els.viewCount.textContent = m.views;
    if (els.likeCount) els.likeCount.textContent = m.likes;
    if (els.likeBtn) els.likeBtn.classList.toggle('btn-primary', !!m.youLiked);
  };
  const bindLikeButton = () => {
    if (!els.likeBtn) return;
    els.likeBtn.onclick = () => {
      if (!currentScenarioKey) return;
      toggleLike(currentScenarioKey);
      refreshUI(currentScenarioKey);
    };
  };
  return { bumpView, refreshUI, bindLikeButton, get };
})();

/* ============================================================
   1) Define all avatar choices here.
   ============================================================ */
const AVATAR_SETS = [
  { id: "bella", label: "Bella", thumb: "bella_thumb.jpg", maryVideo: "bella1.mp4",     danielVideo: "bella9.mp4" },
  { id: "nora",  label: "Nora",  thumb: "nora_thumb.jpg",  maryVideo: "nora_mary.mp4",  danielVideo: "nora_daniel.mp4" },
  { id: "ivy",   label: "Ivy",   thumb: "ivy_thumb.jpg",   maryVideo: "ivy_mary.mp4",   danielVideo: "ivy_daniel.mp4" },
  { id: "julia", label: "Julia", thumb: "julia_thumb.jpg", maryVideo: "julia_mary.mp4", danielVideo: "julia_daniel.mp4" }
];


/* ============================================================
   2) Runtime AVATARS derived from selected set
   ============================================================ */
let SELECTED_AVATAR_SET = null;

const AVATARS = {
  Daniel:     { type: "video", src: "bella9.mp4" },
  Mary:       { type: "video", src: "bella1.mp4" },
  Ryan:       { type: "video", src: "Ryan.mp4" },
  User_Prompt:{ type: "video", src: "bella9.mp4" }
};

function applyAvatarSet(set) {
  SELECTED_AVATAR_SET = set;
  if (set?.maryVideo)   AVATARS.Mary.src   = set.maryVideo;
  if (set?.danielVideo) AVATARS.Daniel.src = set.danielVideo;
}

/* ===== Utility ===== */
// Track AudioContexts so we can suspend them on stop
const __audioContexts = [];
if (typeof AudioContext !== 'undefined') {
  const OriginalAudioContext = AudioContext;
  window.AudioContext = function (...args) {
    const ctx = new OriginalAudioContext(...args);
    __audioContexts.push(ctx);
    return ctx;
  };
  window.AudioContext.prototype = OriginalAudioContext.prototype;
}

function stopEverything() {
  session++;

  // STEP 1 — Instantly silence all audio by muting it. Even if playback
  // continues for a few ms in the background, the USER hears silence now.
  try {
    document.querySelectorAll('audio').forEach(a => {
      try {
        a.muted = true;
        a.volume = 0;
        a.pause();
        a.currentTime = 0;
        a.src = '';
        // Remove from DOM entirely so it can't resume
        if (a.parentNode) a.parentNode.removeChild(a);
      } catch (e) {}
    });
  } catch (e) {}

  // STEP 2 — Cancel Kokoro's internal speech queue
  try { if (typeof KokoroSpeech !== 'undefined') KokoroSpeech.cancel(); } catch (e) {}

  // STEP 3 — Suspend all tracked AudioContexts (stops Web Audio playback)
  try {
    __audioContexts.forEach(ctx => {
      try {
        if (ctx.state === 'running') ctx.suspend();
      } catch (e) {}
    });
  } catch (e) {}

  // STEP 4 — Stop any in-flight speech recognition
  if (rec) {
    try { rec.onresult = null; rec.onerror = null; rec.onend = null; rec.stop(); } catch {}
    rec = null;
  }
  if (listenTimer) { clearTimeout(listenTimer); listenTimer = null; }
}

/* ===== Voices — Kokoro JS ===== */
// Maps app speaker names → Kokoro voice IDs
function getKokoroVoice(speaker) {
  if (speaker === 'Mary')                                    return 'af_nicole';  // female, American
  if (speaker === 'Ryan')                                    return 'am_adam';    // male, American
  if (speaker === 'Daniel' || speaker === 'User' ||
      speaker === 'User_Prompt')                             return 'am_michael'; // male, American
  return 'am_michael';
}

/* ===== Media display ===== */
// ============================================================
// Media display — replaceWith() approach, one element at a time
// ============================================================
let _lastSpeaker = null;

function initMediaElements() {
  // No-op: we no longer pre-create elements. setMediaForSpeaker handles everything.
}

function setMediaForSpeaker(speaker) {
  const asset = AVATARS[speaker] || AVATARS.Ryan;
  const current = els.media;
  if (!current) return;

  // If same speaker and same src, nothing to do
  if (_lastSpeaker === speaker) {
    // For video, make sure it's playing
    if (asset.type === 'video' && current.tagName === 'VIDEO') {
      try { current.play().catch(() => {}); } catch (e) {}
    }
    return;
  }
  _lastSpeaker = speaker;

  if (asset.type === 'img') {
    // Ryan — swap to an <img> element
    if (current.tagName !== 'IMG') {
      // Currently showing a video — replace with img
      if (current.tagName === 'VIDEO') {
        try { current.pause(); current.src = ''; } catch (e) {}
      }
      const img = document.createElement('img');
      img.id = 'media';
      img.className = current.className;
      img.alt = 'Ryan';
      img.src = asset.src;
      img.style.cssText = current.style.cssText || 'width:100%;height:440px;object-fit:cover;';
      current.replaceWith(img);
      els.media = img;
    } else {
      // Already an img — just update src
      current.src = asset.src;
    }
  } else {
    // Mary / Daniel / User_Prompt — swap to a <video> element
    if (current.tagName !== 'VIDEO') {
      // Currently showing an img — replace with video
      const vid = document.createElement('video');
      vid.id = 'media';
      vid.className = current.className;
      vid.autoplay = true;
      vid.loop = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.style.cssText = current.style.cssText || 'width:100%;height:440px;object-fit:cover;';
      vid.src = asset.src;
      current.replaceWith(vid);
      els.media = vid;
      vid.load();
      try { vid.play().catch(() => {}); } catch (e) {}
    } else {
      // Already a video — update src if needed
      if ((current.getAttribute('src') || '') !== asset.src) {
        current.src = asset.src;
        current.load();
      }
      try { current.play().catch(() => {}); } catch (e) {}
    }
  }
}

function renderLine(line) {
  setMediaForSpeaker(line.speaker);
  els.name.textContent = (line.speaker === 'User_Prompt') ? 'Your Turn' : line.speaker;
  if (line.speaker === 'User_Prompt') {
    els.text.innerHTML =
      `<div class="practice-prompt"><strong>READ THIS OUT LOUD:</strong><br><br>
       "${line.text.replace('Say: ', '').replace(/'/g,'')}"</div>
       <div class="user-response-area">🎤 Click Mic or speak when ready…</div>`;
  } else {
    els.text.textContent = line.text;
  }
}

/* ===== Speech synthesis — Kokoro JS ===== */
async function speak(text, speaker) {
  const mySession = session;

  try {
    __audioContexts.forEach(ctx => {
      try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
    });
  } catch (e) {}

  // Set media but pause video immediately — sync it to audio start below
  setMediaForSpeaker(speaker);
  const mediaEl = els.media;
  if (mediaEl && mediaEl.tagName === 'VIDEO') {
    try { mediaEl.pause(); mediaEl.currentTime = 0; } catch (e) {}
  }

  if (mySession !== session) return;

  const voice = getKokoroVoice(speaker);

  try {
    await Promise.race([
      (async () => {
        // Poll for AudioContext becoming active (signals audio is playing)
        // then start the video to sync lips with audio
        let videoStarted = false;
        const syncVideo = () => {
          if (!videoStarted && mySession === session) {
            videoStarted = true;
            const el = els.media;
            if (el && el.tagName === 'VIDEO') {
              try { el.play().catch(() => {}); } catch (e) {}
            }
          }
        };
        const pollId = setInterval(() => {
          if (mySession !== session) { clearInterval(pollId); return; }
          if (__audioContexts.some(c => c.state === 'running')) {
            clearInterval(pollId);
            syncVideo();
          }
        }, 30);
        // Fallback: start video after 500ms regardless
        setTimeout(() => { clearInterval(pollId); syncVideo(); }, 500);

        await KokoroSpeech.speak(text, voice);
        clearInterval(pollId);
        // Audio done — pause video so lips stop moving during silence
        const doneEl = els.media;
        if (doneEl && doneEl.tagName === 'VIDEO') {
          try { doneEl.pause(); doneEl.currentTime = 0; } catch(e) {}
        }
      })(),
      new Promise((_, reject) => {
        const checker = setInterval(() => {
          if (mySession !== session) {
            clearInterval(checker);
            reject(new Error('session_changed'));
          }
        }, 50);
        setTimeout(() => clearInterval(checker), 120000);
      })
    ]);
  } catch (e) {}

  if (mySession !== session) return;
}

/* ===== Dynamic Mary (Claude API) ===== */
let conversationHistory = []; // tracks {role, content} for Claude context

function resetConversation() {
  conversationHistory = [];
}

async function getDynamicMaryResponse(userSaid) {
  const sc = SCENARIOS[currentScenarioKey] || {};

  // Show thinking indicator immediately so user knows they were heard
  els.name.textContent = 'Mary';
  els.text.textContent = '💭 …';

  // 8 second timeout on Groq call — if it hangs, fallback immediately
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('/api/mary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: userSaid,
        scenarioTitle: sc.title || '',
        scenarioSetting: sc.setting || '',
        scenarioKey: currentScenarioKey,
        history: conversationHistory,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    const maryText = data.response;
    conversationHistory.push({ role: 'user',      content: userSaid });
    conversationHistory.push({ role: 'assistant', content: maryText });
    if (conversationHistory.length > 12) conversationHistory = conversationHistory.slice(-12);
    return maryText;
  } catch (err) {
    clearTimeout(timeout);
    console.error('[Mary] API error:', err.name === 'AbortError' ? 'Timeout after 8s' : err);
    return null;
  }
}

/* ===== Recognition ===== */
function createRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
  return r;
}
function showListening(on=true){ els.listenPill.style.display = on ? 'block' : 'none'; }

/* ===== Scenario engine ===== */
async function playScenario(key, practice=false) {
  stopEverything();
  resetConversation();

  // Give the kill sequence a brief moment to settle before new audio starts.
  // This prevents the very tail end of previous audio from overlapping with
  // the start of this scenario's first line.
  await new Promise(r => setTimeout(r, 200));

  const mySession = session;

  currentScenarioKey = key;

  // update view count + UI for this scenario
  Metrics.bumpView(key);
  Metrics.refreshUI(key);

  const sc = SCENARIOS[key];
  if (!sc) return;

  isPractice = practice;
  currentScript = practice ? sc.practice : sc.demo;
  stepIndex = 0;

  if (els.select.value !== key) els.select.value = key;
  await playLoop(mySession);
}

async function playLoop(mySession) {
  while (stepIndex < currentScript.length) {
    if (mySession !== session) return;
    const line = currentScript[stepIndex];
    renderLine(line);

    if (line.speaker === 'User_Prompt') {
      const said = await listenForUser(mySession, 60000); // 60s absolute cap; function auto-restarts on browser timeouts
      if (mySession !== session) return;

      if (said) {
        // Practice mode: get dynamic Mary response via Claude API
        if (isPractice) {
          const dynamicReply = await getDynamicMaryResponse(said);
          if (mySession !== session) return;
          if (dynamicReply) {
            // Skip next scripted Mary line — replace with dynamic response
            if (stepIndex + 1 < currentScript.length &&
                currentScript[stepIndex + 1].speaker === 'Mary') {
              stepIndex++;
            }
            await speak(dynamicReply, 'Mary');
            // FIX: Skip any Ryan coaching lines that follow — they were scripted
            // for context before Mary's reply, now out of date because Mary
            // took the conversation dynamically. Advance until next User_Prompt
            // (if one exists in the remaining script).
            let lookAhead = stepIndex + 1;
            let foundNextUserPrompt = false;
            while (lookAhead < currentScript.length) {
              if (currentScript[lookAhead].speaker === 'User_Prompt') {
                foundNextUserPrompt = true;
                break;
              }
              if (currentScript[lookAhead].speaker !== 'Ryan') break;
              lookAhead++;
            }
            if (foundNextUserPrompt) {
              // Skip all Ryan lines between here and next User_Prompt
              stepIndex = lookAhead - 1; // -1 because outer loop will stepIndex++
            }
            // Else: no more user turns — let Ryan's final wrap-up play normally
          } else {
            // Groq timed out or failed — use a natural filler so conversation continues
            await speak(randomChoice([
              "Sorry, say that again?",
              "Hmm, I didn't quite catch that.",
              "What was that?"
            ]), 'Mary');
          }
        } else {
          if (similarity(said, line.text) >= 0.4) {
            await speak(randomChoice(["Nice!","Good job!","Great!"]), 'Ryan');
          } else {
            await speak("No worries — here's the line for reference.", 'Ryan');
            await speak(line.text.replace('Say: ','').replace(/'/g,''), 'Daniel');
          }
        }
      } else {
        // Nothing heard — show prompt again and wait once more
        els.text.innerHTML =
          `<div class="practice-prompt"><strong>READ THIS OUT LOUD:</strong><br><br>
           "${line.text.replace('Say: ', '').replace(/'/g,'')}"</div>
           <div class="user-response-area">🎤 Didn't catch that — try again…</div>`;
        const retry = await listenForUser(mySession, 60000);
        if (mySession !== session) return;
        if (retry && isPractice) {
          const dynamicReply = await getDynamicMaryResponse(retry);
          if (mySession !== session) return;
          if (dynamicReply) {
            if (stepIndex + 1 < currentScript.length &&
                currentScript[stepIndex + 1].speaker === 'Mary') {
              stepIndex++;
            }
            await speak(dynamicReply, 'Mary');
            // FIX: Same Ryan-skip logic on retry path
            let lookAhead = stepIndex + 1;
            let foundNextUserPrompt = false;
            while (lookAhead < currentScript.length) {
              if (currentScript[lookAhead].speaker === 'User_Prompt') {
                foundNextUserPrompt = true;
                break;
              }
              if (currentScript[lookAhead].speaker !== 'Ryan') break;
              lookAhead++;
            }
            if (foundNextUserPrompt) {
              stepIndex = lookAhead - 1;
            }
          }
        } else if (!retry) {
          // Still nothing — skip and continue
          await speak("No worries, let's keep going.", 'Ryan');
        }
      }
      stepIndex++;
      continue;
    }

    await speak(line.text, line.speaker);
    if (mySession !== session) return;
    // Shorter pause between AI turns for more natural conversation flow (was 650ms)
    await pause(200);
    stepIndex++;
  }

  if (!isPractice) renderAskToPractice(mySession);
  else await freeConversation(mySession);
}

/* ===== Free Conversation Mode ===== */
async function freeConversation(mySession) {
  if (mySession !== session) return;

  const FREE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  const NUDGE_AT_MS     =  8 * 60 * 1000; // nudge at 8 min
  const startTime = Date.now();
  let nudgeSent = false;

  // Ryan intro
  await speak("Great work on the script! Now let's have a real conversation — no script, no prompts. Just talk to me naturally for the next ten minutes. I'll give you feedback at the end.", 'Ryan');
  if (mySession !== session) return;

  els.name.textContent = 'Ryan';
  els.text.textContent = 'Free conversation started. Just speak naturally…';

  // Show a countdown timer in the UI
  const timerEl = document.createElement('div');
  timerEl.id = 'free-timer';
  timerEl.style.cssText = 'position:fixed;top:70px;right:20px;background:#1a1c22;border:1px solid #2b2e36;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;color:#ffb300;z-index:999';
  document.body.appendChild(timerEl);
  const timerInterval = setInterval(() => {
    if (mySession !== session) { clearInterval(timerInterval); timerEl.remove(); return; }
    const remaining = Math.max(0, FREE_DURATION_MS - (Date.now() - startTime));
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `⏱ ${mins}:${secs.toString().padStart(2,'0')} left`;
  }, 1000);

  while (mySession === session) {
    const elapsed = Date.now() - startTime;

    // Time's up
    if (elapsed >= FREE_DURATION_MS) {
      await speak("That's a wrap! Great conversation. Let me put together your feedback now.", 'Ryan');
      break;
    }

    // 8-minute nudge
    if (!nudgeSent && elapsed >= NUDGE_AT_MS) {
      nudgeSent = true;
      await speak("You're doing great — keep the conversation going, two more minutes.", 'Ryan');
      if (mySession !== session) return;
    }

    // Listen for user (30s max per turn, then loop back)
    const remainingMs = FREE_DURATION_MS - (Date.now() - startTime);
    const listenMs = Math.min(30000, remainingMs);
    if (listenMs < 2000) break; // not enough time left

    const said = await listenForUser(mySession, listenMs);
    if (mySession !== session) return;
    if (!said) {
      // No speech — wait a moment before trying again so we don't spin
      await pause(1000);
      continue;
    }

    // Get Mary's dynamic response
    const reply = await getDynamicMaryResponse(said);
    if (mySession !== session) return;

    if (reply) {
      await speak(reply, 'Mary');
    } else {
      await speak(randomChoice(["Sorry, say that again?", "Hmm, I didn't quite catch that.", "What was that?"]), 'Mary');
    }
    if (mySession !== session) return;
    await pause(200);
  }

  clearInterval(timerInterval);
  const te = document.getElementById('free-timer');
  if (te) te.remove();

  if (mySession !== session) return;
  await runCoachFeedback(mySession);
}

/* ===== Coach Feedback ===== */
async function runCoachFeedback(mySession) {
  if (mySession !== session) return;

  els.name.textContent = "Ryan";
  els.text.textContent = "Analyzing your session…";
  setMediaForSpeaker('Ryan');

  const sc = SCENARIOS[currentScenarioKey] || {};

  try {
    const response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation: conversationHistory,
        scenarioTitle: sc.title || 'Dating scenario',
      }),
    });

    if (!response.ok) throw new Error('Coach API failed');
    const feedback = await response.json();
    if (mySession !== session) return;

    await speak(feedback.spokenSummary, 'Ryan');
    if (mySession !== session) return;

    showFeedbackCard(feedback);

  } catch (err) {
    console.error('[Coach] error:', err);
    await speak("Good session! Keep practicing — pick another scenario.", 'Ryan');
  }
}

function showFeedbackCard(f) {
  const scoreColor = f.score >= 7 ? '#40c770' : f.score >= 5 ? '#ffb300' : '#ff6b6b';
  els.text.innerHTML = `
    <div style="background:#1a1c22;border:1px solid #2b2e36;border-radius:16px;padding:20px;margin:10px 0;text-align:left;max-width:860px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="font-size:42px;font-weight:900;color:${scoreColor}">${f.score}<span style="font-size:20px;color:#666">/10</span></div>
        <div style="font-size:16px;color:#cfd6e4;line-height:1.5">${f.spokenSummary}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div style="background:#162016;border:1px solid #1e3a1e;border-radius:10px;padding:12px">
          <div style="color:#40c770;font-size:12px;font-weight:700;margin-bottom:8px">✓ WHAT WORKED</div>
          ${(f.strengths||[]).map(s=>`<div style="color:#c8e6c9;font-size:13px;margin-bottom:4px">• ${s}</div>`).join('')}
        </div>
        <div style="background:#1e1616;border:1px solid #3a1e1e;border-radius:10px;padding:12px">
          <div style="color:#ff6b6b;font-size:12px;font-weight:700;margin-bottom:8px">↑ IMPROVE THIS</div>
          ${(f.improvements||[]).map(i=>`<div style="color:#ffcdd2;font-size:13px;margin-bottom:4px">• ${i}</div>`).join('')}
        </div>
      </div>
      <div style="background:#1a1730;border:1px solid #2e2a50;border-radius:10px;padding:12px">
        <div style="color:#a78bfa;font-size:12px;font-weight:700;margin-bottom:6px">💬 TRY THIS LINE NEXT TIME</div>
        <div style="color:#e0d9ff;font-size:14px;font-style:italic">"${f.tryThisLine}"</div>
      </div>
      <div style="margin-top:14px;text-align:center">
        <button onclick="playScenario('${currentScenarioKey}', true)"
          style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:10px 28px;font-size:14px;font-weight:800;cursor:pointer;margin-right:8px">
          🔄 Try Again
        </button>
        <button onclick="playScenario(Object.keys(SCENARIOS).find(k=>k!=='${currentScenarioKey}'), false)"
          style="background:#2a2e36;color:#fff;border:1px solid #3a3f4b;border-radius:999px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">
          Next Scenario →
        </button>
      </div>
    </div>`;
}

function renderAskToPractice(mySession){
  if (mySession !== session) return;
  els.name.textContent = "Ryan";
  els.text.textContent = "Great job! Want to practice this one? Say yes or pick another on the right.";
  speak("Great job! Want to practice this one? Say yes or pick another on the right.", "Ryan")
    .then(()=> startListeningYesNo(mySession));
}

function startListeningYesNo(mySession){
  if (mySession !== session) return;
  const r = createRecognition(); if (!r) return;
  rec = r; showListening(true);
  listenTimer = setTimeout(()=>{ try{r.stop();}catch{} }, 6000);
  r.onresult = (e)=>{
    clearTimeout(listenTimer); showListening(false);
    const s = e.results[0][0].transcript.toLowerCase();
    if (s.includes('yes')) playScenario(currentScenarioKey, true);
    else speak("Okay — choose any scenario from the list.", "Ryan");
  };
  r.onerror = ()=>{ showListening(false); };
  r.onend = ()=>{ showListening(false); };
  try { r.start(); } catch {}
}

// ============================================================
// Continuous speech listening — auto-restart when browser times out
// Fix for the 15s cutoff problem. Browser speech recognition will
// auto-stop periodically; we restart it and accumulate the transcript.
// User is "done" when they pause for ~1.5s of silence.
// ============================================================
function listenForUser(mySession, maxTotalMs){
  return new Promise((resolve)=>{
    maxTotalMs = maxTotalMs || 60000; // absolute hard cap: 60s

    let accumulatedTranscript = '';   // everything the user has said so far
    let currentInterim = '';          // latest interim result from current rec session
    let silenceTimer = null;          // fires when user stops speaking
    let hardTimer = null;             // absolute maximum listen time
    let currentRec = null;
    let isResolved = false;
    let lastSpeechActivity = Date.now();
    let restartCount = 0;
    const MAX_RESTARTS = 8;           // safety: ~8 * 10s = 80s max theoretical

    const SILENCE_BEFORE_STOP_MS = 1500; // how long user must be silent before we decide they're done

    function finish(reason){
      if (isResolved) return;
      isResolved = true;

      // Stop whatever timers are running
      clearTimeout(silenceTimer);
      clearTimeout(hardTimer);
      if (listenTimer) { clearTimeout(listenTimer); listenTimer = null; }

      // Stop the current recognition cleanly
      if (currentRec) {
        try {
          currentRec.onresult = null;
          currentRec.onerror = null;
          currentRec.onend = null;
          currentRec.stop();
        } catch (e) {}
        currentRec = null;
      }

      showListening(false);

      // Combine accumulated + any trailing interim result
      let finalText = accumulatedTranscript.trim();
      if (currentInterim.trim() && !finalText.toLowerCase().includes(currentInterim.trim().toLowerCase())) {
        finalText = (finalText + ' ' + currentInterim).trim();
      }

      resolve(finalText || null);
    }

    function scheduleSilenceCheck(){
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(()=>{
        // If no new speech in SILENCE_BEFORE_STOP_MS, the user is done.
        if (Date.now() - lastSpeechActivity >= SILENCE_BEFORE_STOP_MS - 100) {
          finish('silence_detected');
        }
      }, SILENCE_BEFORE_STOP_MS);
    }

    function startRecognitionSession(){
      if (isResolved || mySession !== session) return;
      if (restartCount >= MAX_RESTARTS) {
        finish('max_restarts');
        return;
      }
      restartCount++;

      const r = createRecognition();
      if (!r) { finish('no_recognition'); return; }
      r.interimResults = true;
      r.continuous = true; // request continuous mode (not all browsers honor this but ask for it)
      currentRec = r;
      rec = r; // expose globally so stopEverything() can kill it

      currentInterim = '';

      r.onresult = (e)=>{
        if (isResolved || mySession !== session) { finish('session_changed'); return; }

        lastSpeechActivity = Date.now();

        // Walk ALL results in this batch and categorize them
        let newFinalChunks = '';
        let latestInterim = '';

        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            newFinalChunks += (newFinalChunks ? ' ' : '') + transcript.trim();
          } else {
            latestInterim = transcript.trim();
          }
        }

        if (newFinalChunks) {
          // Append new final chunks to accumulated transcript
          accumulatedTranscript = (accumulatedTranscript + ' ' + newFinalChunks).trim();
        }
        currentInterim = latestInterim;

        // Any speech activity resets the silence timer
        scheduleSilenceCheck();
      };

      r.onerror = (e)=>{
        // Common errors: 'no-speech', 'aborted', 'audio-capture', 'network'
        // 'no-speech' is normal — user just paused. Don't bail.
        if (e.error === 'no-speech' || e.error === 'aborted') {
          // Let onend handle the restart decision
          return;
        }
        finish('error_' + e.error);
      };

      r.onend = ()=>{
        if (isResolved || mySession !== session) return;

        // Browser auto-stopped. Decide: restart (continue listening) or finish.
        const timeSinceLastSpeech = Date.now() - lastSpeechActivity;

        if (timeSinceLastSpeech >= SILENCE_BEFORE_STOP_MS) {
          // User has been silent long enough — they're done.
          finish('browser_stopped_after_silence');
        } else if (!accumulatedTranscript && !currentInterim && restartCount >= MAX_RESTARTS) {
          // No speech captured in max attempts — user probably not speaking
          finish('no_speech_after_retries');
        } else {
          // User is still mid-thought — restart recognition quickly
          setTimeout(()=>{
            if (!isResolved && mySession === session) {
              startRecognitionSession();
            }
          }, 100);
        }
      };

      try {
        r.start();
        showListening(true);
      } catch (e) {
        // Couldn't start — wait briefly and try once more
        setTimeout(()=>{
          if (!isResolved) startRecognitionSession();
        }, 200);
      }
    }

    // Absolute hard cap on total listen time
    hardTimer = setTimeout(()=>{ finish('hard_timeout'); }, maxTotalMs);
    listenTimer = hardTimer; // expose so stopEverything() can cancel

    // Start the first recognition session
    startRecognitionSession();
  });
}

/* ===== Helpers ===== */
const pause = (ms)=> new Promise(r=> setTimeout(r, ms));
const randomChoice = (arr)=> arr[Math.floor(Math.random()*arr.length)];
function similarity(actual, promptText){
  const expected = promptText.replace('Say: ','').replace(/'/g,'').toLowerCase();
  const words = expected.split(/\s+/).filter(w=>w.length>2);
  const said = (actual||'').toLowerCase();
  const match = words.filter(w=> said.includes(w)).length;
  return match / Math.max(1, words.length);
}

/* ===== Shelf UI ===== */
function renderShelf() {
  const keys = Object.keys(SCENARIOS);
  els.select.innerHTML = keys.map(k=>`<option value="${k}">${SCENARIOS[k].title}</option>`).join('');
  els.select.onchange = ()=> playScenario(els.select.value, false);
  els.shelf.innerHTML = '';
  const limit = 3;
  keys.slice(0,limit).forEach(k => els.shelf.appendChild(makeCard(k)));
  if (keys.length > limit) {
    els.showMore.style.display = 'block';
    els.showMore.textContent = `+ ${keys.length - limit} more — show all`;
    let expanded = false;
    els.showMore.onclick = ()=>{
      expanded = !expanded;
      els.shelf.innerHTML = '';
      const list = expanded ? keys : keys.slice(0,limit);
      list.forEach(k=> els.shelf.appendChild(makeCard(k)));
      els.showMore.textContent = expanded ? 'Show fewer' : `+ ${keys.length - limit} more — show all`;
    };
  } else els.showMore.style.display = 'none';
}
function makeCard(key){
  const sc = SCENARIOS[key];
  const card = document.createElement('div');
  card.className = 'sc-card';
  const img = document.createElement('img');
  img.className = 'sc-thumb';
  img.src = sc.thumb || 'Ryan.jpg';
  img.onerror = ()=>{ img.style.display='none'; };
  const title = document.createElement('div');
  title.innerHTML = `<div class="sc-title">${sc.title}</div><div class="sc-sub">Click to load</div>`;
  card.appendChild(img); card.appendChild(title);
  card.onclick = ()=> playScenario(key, false);
  return card;
}

/* ===== Avatar Picker ===== */
function renderAvatarPicker() {
  if (!els.pickerBackdrop) return;
  els.pickerGrid.innerHTML = AVATAR_SETS.map(s => `
    <div class="pick-card" data-id="${s.id}">
      <img class="pick-img" src="${s.thumb || 'Ryan.jpg'}" alt="${s.label}">
      <div class="pick-meta"><b>${s.label}</b><br>Choose this person</div>
      <div class="pick-foot">🎬 Mary: ${s.maryVideo || '—'} &nbsp; • &nbsp; 🎥 Daniel: ${s.danielVideo || '—'}</div>
    </div>
  `).join('');
  Array.from(els.pickerGrid.querySelectorAll('.pick-card')).forEach(card=>{
    card.onclick = ()=>{
      const id = card.getAttribute('data-id');
      const set = AVATAR_SETS.find(x=>x.id===id);
      applyAvatarSet(set);
      els.pickerBackdrop.style.display = 'none';
      bootAfterAvatarSelected();
    };
  });
  els.pickerBackdrop.style.display = 'flex';
}

/* ===== Buttons ===== */
els.enterPractice.onclick = ()=> playScenario(currentScenarioKey || Object.keys(SCENARIOS)[0], true);
els.micBtn.onclick = ()=> {};
els.chooseBtn.onclick = renderAvatarPicker;

/* ===== Boot sequence ===== */
function bootAfterAvatarSelected(){
  initMediaElements(); // set up dual-element media system (Ryan img + avatar video)
  renderShelf();
  const firstKey = Object.keys(SCENARIOS)[0];
  // Initialize metrics UI for first scenario immediately:
  Metrics.refreshUI(firstKey);
  playScenario(firstKey, false);
}

// Start with a random avatar, user can change via button
function bootDefault(){
  const set = AVATAR_SETS[Math.floor(Math.random()*AVATAR_SETS.length)];
  applyAvatarSet(set);
  Metrics.bindLikeButton();
  renderShelf(); // show scenario list immediately while waiting

  // ── Start screen ──────────────────────────────────────────────────────
  // Must wait for user tap before loading model — two reasons:
  //   1) Browser blocks AudioContext without a user gesture
  //   2) 80MB model download should not race against the conversation
  const overlay = document.createElement('div');
  overlay.id = 'ek-start-overlay';
  overlay.style.cssText = [
    'position:fixed','inset:0','z-index:10000',
    'background:rgba(13,14,18,0.97)',
    'display:flex','flex-direction:column',
    'align-items:center','justify-content:center','gap:16px'
  ].join(';');
  overlay.innerHTML = `
    <div style="font-size:52px;line-height:1">🎙️</div>
    <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px">Eklipses</div>
    <div style="font-size:14px;color:#9aa4b2;max-width:280px;text-align:center;line-height:1.7">
      AI voices load once (~80MB) and are cached forever after.
    </div>
    <button id="ek-start-btn" style="
      background:#ffb300;color:#000;border:none;border-radius:999px;
      padding:14px 44px;font-size:16px;font-weight:800;cursor:pointer;margin-top:4px;
      transition:transform .1s ease;
    " onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform=''">
      ▶&nbsp; Tap to Start
    </button>
    <div id="ek-prog-wrap" style="display:none;width:280px;text-align:center">
      <div style="background:#2b2e36;border-radius:6px;height:8px;overflow:hidden;margin-bottom:8px">
        <div id="ek-prog-fill" style="
          background:#ffb300;height:100%;width:0%;
          border-radius:6px;transition:width 0.25s ease;
        "></div>
      </div>
      <div id="ek-prog-label" style="font-size:12px;color:#777">Downloading AI model…</div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('ek-start-btn').onclick = async () => {
    document.getElementById('ek-start-btn').style.display = 'none';
    document.getElementById('ek-prog-wrap').style.display = 'block';

    try {
      await KokoroSpeech.preload((info) => {
        const fill  = document.getElementById('ek-prog-fill');
        const label = document.getElementById('ek-prog-label');
        if (fill  && info.progress != null) fill.style.width = Math.round(info.progress) + '%';
        if (label && info.file) label.textContent = 'Loading ' + info.file.split('/').pop() + '…';
      });
    } catch(err) {
      console.error("[Eklipses] Model load failed:", err);
      const lbl = document.getElementById("ek-prog-label");
      if (lbl) lbl.innerHTML = "<span style='color:#ff6b6b'>❌ Failed: " + err.message + "<br>Check F12 console for details.</span>";
      return; // stay on start screen so user can read the error
    }

    overlay.remove();
    initMediaElements(); // set up dual-element media system
    const firstKey = Object.keys(SCENARIOS)[0];
    Metrics.refreshUI(firstKey);
    playScenario(firstKey, false);
  };
}

bootDefault();
