/* ===== Global state ===== */
let voices = [];
let voiceReady = false;

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
  Ryan:       { type: "img",   src: "Ryan.jpg" },
  User_Prompt:{ type: "video", src: "bella9.mp4" }
};

function applyAvatarSet(set) {
  SELECTED_AVATAR_SET = set;
  if (set?.maryVideo)   AVATARS.Mary.src   = set.maryVideo;
  if (set?.danielVideo) AVATARS.Daniel.src = set.danielVideo;
}

/* ===== Utility ===== */
function stopEverything() {
  session++;
  try { speechSynthesis.cancel(); } catch {}
  if (rec) {
    try { rec.onresult = null; rec.onerror = null; rec.onend = null; rec.stop(); } catch {}
    rec = null;
  }
  if (listenTimer) { clearTimeout(listenTimer); listenTimer = null; }
}

/* ===== Voices ===== */
function getVoiceIndex(speaker) {
  if (speaker === "Daniel" || speaker === "User" || speaker === "User_Prompt") return 140;
  if (speaker === "Mary")  return 139;
  if (speaker === "Ryan")  return 137;
  return 0;
}
function selectVoiceFor(speaker) {
  const desired = getVoiceIndex(speaker);
  if (!voices || !voices.length) return null;
  if (voices[desired]) return voices[desired];
  const clamped = Math.min(Math.max(desired, 0), voices.length - 1);
  return voices[clamped] || voices[0] || null;
}
function initVoices() {
  voices = window.speechSynthesis.getVoices();
  if (voices.length) voiceReady = true;
}
initVoices();
window.speechSynthesis.onvoiceschanged = () => { initVoices(); };
function waitForVoicesReady(maxMs = 4000) {
  return new Promise(resolve => {
    if (voiceReady) return resolve();
    const start = Date.now();
    const tick = () => {
      initVoices();
      if (voiceReady || (Date.now() - start) > maxMs) return resolve();
      setTimeout(tick, 100);
    };
    tick();
  });
}

/* ===== Media display ===== */
function setMediaForSpeaker(speaker) {
  const asset = AVATARS[speaker] || AVATARS.Ryan;
  if (asset.type === 'video') {
    const v = document.createElement('video');
    v.src = asset.src;
    v.className = 'media';
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    els.media.replaceWith(v);
    els.media = v;
  } else {
    const img = document.createElement('img');
    img.src = asset.src;
    img.className = 'media';
    img.alt = speaker;
    img.onerror = () => { img.style.display = 'none'; };
    els.media.replaceWith(img);
    els.media = img;
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

/* ===== Speech synthesis ===== */
async function speak(text, speaker) {
  setMediaForSpeaker(speaker);
  await waitForVoicesReady();
  return new Promise((resolve)=>{
    const u = new SpeechSynthesisUtterance(text);
    const voice = selectVoiceFor(speaker);
    if (voice) u.voice = voice;
    u.onend = u.onerror = () => resolve();
    try { speechSynthesis.cancel(); } catch {}
    speechSynthesis.speak(u);
  });
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
      const said = await listenForUser(mySession, 10000);
      if (mySession !== session) return;

      if (said && similarity(said, line.text) >= 0.4) {
        await speak(randomChoice(["Nice!","Good job!","Great!"]), 'Ryan');
      } else if (!said) {
        await speak("No worries — here's the line for reference.", 'Ryan');
        await speak(line.text.replace('Say: ','').replace(/'/g,''), 'Daniel');
      } else {
        await speak("Interesting approach — let's continue.", 'Ryan');
      }
      stepIndex++;
      continue;
    }

    await speak(line.text, line.speaker);
    if (mySession !== session) return;
    await pause(650);
    stepIndex++;
  }

  if (!isPractice) renderAskToPractice(mySession);
  else await speak("Excellent work! Want to try another scenario? Pick one on the right.", "Ryan");
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

function listenForUser(mySession, timeoutMs){
  return new Promise((resolve)=>{
    const r = createRecognition();
    if (!r) return resolve(null);
    rec = r; showListening(true);
    listenTimer = setTimeout(()=>{ try{ r.stop(); }catch{} }, timeoutMs);
    r.onresult = (e)=>{ if (mySession!==session) return resolve(null);
      clearTimeout(listenTimer); showListening(false);
      resolve(e.results[0][0].transcript.trim());
    };
    r.onerror = ()=>{ clearTimeout(listenTimer); showListening(false); resolve(null); };
    r.onend = ()=>{ showListening(false); };
    try { r.start(); } catch { resolve(null); }
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
  bootAfterAvatarSelected();
}

bootDefault();
