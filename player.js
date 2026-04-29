/* ===== Global state ===== */
let currentScenarioKey = null;
let currentScript = null;
let isPractice = false;
let stepIndex = 0;
let rec = null;
let listenTimer = null;
let session = 0;

const els = {
  select:         document.getElementById('scenarioSelect'),
  enterPractice:  document.getElementById('enterPractice'),
  micBtn:         document.getElementById('micBtn'),
  chooseBtn:      document.getElementById('chooseAvatarBtn'),
  media:          document.getElementById('media'),
  name:           document.getElementById('speakerName'),
  text:           document.getElementById('lineText'),
  shelf:          document.getElementById('shelfList'),
  showMore:       document.getElementById('showMore'),
  listenPill:     document.getElementById('listenPill'),
  pickerBackdrop: document.getElementById('avatarPicker'),
  pickerGrid:     document.getElementById('pickerGrid'),
  likeBtn:        document.getElementById('likeBtn'),
  likeCount:      document.getElementById('likeCount'),
  viewCount:      document.getElementById('viewCount'),
  sceneBg:        document.getElementById('sceneBg'),
  stageFrame:     document.getElementById('stageFrame'),
};

/* ===== Metrics ===== */
const Metrics = (() => {
  const KEY = 'ek-metrics-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {scenarios:{}}; } catch { return {scenarios:{}}; } };
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const ensure = (s,id) => {
    if (!s.scenarios[id]) {
      const sc = (window.SCENARIOS||{})[id] || {};
      s.scenarios[id] = { views: sc.seedViews||0, likes: sc.seedLikes||0, youLiked:false, lastViewAt:0 };
    }
  };
  const get = id => { const s=load(); ensure(s,id); return s.scenarios[id]; };
  const bumpView = id => {
    if (!id) return;
    const s=load(); ensure(s,id);
    const m=s.scenarios[id], now=Date.now();
    if (now-(m.lastViewAt||0)>30000) { m.views++; m.lastViewAt=now; save(s); }
  };
  const toggleLike = id => {
    if (!id) return;
    const s=load(); ensure(s,id);
    const m=s.scenarios[id];
    m.youLiked ? (m.likes=Math.max(0,m.likes-1), m.youLiked=false) : (m.likes++, m.youLiked=true);
    save(s); return m;
  };
  const refreshUI = id => {
    if (!id) return;
    const m=get(id);
    if (els.viewCount) els.viewCount.textContent = m.views;
    if (els.likeCount) els.likeCount.textContent = m.likes;
    if (els.likeBtn) els.likeBtn.classList.toggle('btn-primary', !!m.youLiked);
  };
  const bindLikeButton = () => {
    if (!els.likeBtn) return;
    els.likeBtn.onclick = () => { if (!currentScenarioKey) return; toggleLike(currentScenarioKey); refreshUI(currentScenarioKey); };
  };
  return { bumpView, refreshUI, bindLikeButton, get };
})();

/* ===== Avatar sets ===== */
const AVATAR_SETS = [
  { id:'bella', label:'Bella', thumb:'bella_thumb.jpg', maryVideo:'bella1.mp4',    danielVideo:'bella9.mp4' },
  { id:'nora',  label:'Nora',  thumb:'nora_thumb.jpg',  maryVideo:'nora_mary.mp4', danielVideo:'nora_daniel.mp4' },
  { id:'ivy',   label:'Ivy',   thumb:'ivy_thumb.jpg',   maryVideo:'ivy_mary.mp4',  danielVideo:'ivy_daniel.mp4' },
  { id:'julia', label:'Julia', thumb:'julia_thumb.jpg', maryVideo:'julia_mary.mp4',danielVideo:'julia_daniel.mp4' },
];

const AVATARS = {
  Daniel:      { type:'video', src:'bella9.mp4' },
  Mary:        { type:'video', src:'bella1.mp4' },
  Ryan:        { type:'orb' },
  User_Prompt: { type:'video', src:'bella9.mp4' },
};

function applyAvatarSet(set) {
  if (!set) return;
  if (set.maryVideo)   AVATARS.Mary.src   = set.maryVideo;
  if (set.danielVideo) { AVATARS.Daniel.src = set.danielVideo; AVATARS.User_Prompt.src = set.danielVideo; }
}

/* ===== Stop everything ===== */
const __audioContexts = [];
if (typeof AudioContext !== 'undefined') {
  const Orig = AudioContext;
  window.AudioContext = function(...a) { const c=new Orig(...a); __audioContexts.push(c); return c; };
  window.AudioContext.prototype = Orig.prototype;
}

function stopEverything() {
  session++;
  try { document.querySelectorAll('audio').forEach(a=>{ try{a.muted=true;a.pause();a.src='';if(a.parentNode)a.parentNode.removeChild(a);}catch{} }); } catch {}
  try { if (typeof KokoroSpeech!=='undefined') KokoroSpeech.cancel(); } catch {}
  try { __audioContexts.forEach(c=>{ try{if(c.state==='running')c.suspend();}catch{} }); } catch {}
  if (rec) { try{rec.onresult=null;rec.onerror=null;rec.onend=null;rec.stop();}catch{}; rec=null; }
  if (listenTimer) { clearTimeout(listenTimer); listenTimer=null; }
}

/* ===== Ryan orb ===== */
let _ryanOrbEl=null, _ryanOrbAnimFrame=null, _ryanOrbT=0;

function getRyanOrb() {
  if (_ryanOrbEl) return _ryanOrbEl;
  const div = document.createElement('div');
  div.id = 'ryan-orb';
  div.innerHTML = `
    <style>
      #ryan-orb{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:440px;gap:14px}
      #ryan-orb .ro-wrap{position:relative;width:110px;height:110px;display:flex;align-items:center;justify-content:center}
      #ryan-orb .ro-ring{position:absolute;border-radius:50%;border:1.5px solid #378ADD;opacity:0}
      #ryan-orb .ro-ring1{width:110px;height:110px} #ryan-orb .ro-ring2{width:130px;height:130px} #ryan-orb .ro-ring3{width:152px;height:152px}
      #ryan-orb .ro-orb{width:80px;height:80px;border-radius:50%;background:#378ADD;display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
      #ryan-orb .ro-inner{width:54px;height:54px;border-radius:50%;background:#185FA5;display:flex;align-items:center;justify-content:center}
      #ryan-orb .ro-lbl{font-size:15px;font-weight:600;color:#B5D4F4;letter-spacing:.1em}
      #ryan-orb .ro-bars{display:flex;align-items:flex-end;gap:3px;height:32px}
      #ryan-orb .ro-bar{width:4px;background:#378ADD;border-radius:2px;min-height:4px}
    </style>
    <div class="ro-wrap">
      <div class="ro-ring ro-ring1" id="roR1"></div><div class="ro-ring ro-ring2" id="roR2"></div><div class="ro-ring ro-ring3" id="roR3"></div>
      <div class="ro-orb" id="roOrb"><div class="ro-inner"><span class="ro-lbl">R</span></div></div>
    </div>
    <div class="ro-bars" id="roBars"></div>`;
  const bars = div.querySelector('#roBars');
  for (let i=0;i<18;i++) { const b=document.createElement('div'); b.className='ro-bar'; b.style.height='4px'; bars.appendChild(b); }
  return div;
}

function ryanOrbSetState(state) {
  const orb=document.getElementById('ryan-orb'); if(!orb) return;
  cancelAnimationFrame(_ryanOrbAnimFrame); _ryanOrbT=0;
  const orbEl=orb.querySelector('#roOrb'), r1=orb.querySelector('#roR1'), r2=orb.querySelector('#roR2'), r3=orb.querySelector('#roR3'), bars=orb.querySelectorAll('.ro-bar');
  function tick() {
    _ryanOrbT+=0.08; const t=_ryanOrbT;
    if (state==='speaking') {
      const amp=0.5+0.5*Math.sin(t*1.2);
      bars.forEach((b,i)=>{ const w=Math.sin(t*2.5+i*0.5)*0.5+0.5; b.style.height=Math.round(6+w*22*amp)+'px'; b.style.background='#378ADD'; });
      orbEl.style.transform='scale('+(1+0.06*Math.sin(t*2.5)).toFixed(3)+')';
      r1.style.opacity=(0.25+0.25*Math.sin(t*1.8)).toFixed(3); r2.style.opacity=(0.15+0.15*Math.sin(t*1.8)).toFixed(3); r3.style.opacity=(0.08+0.08*Math.sin(t*1.8)).toFixed(3);
    } else if (state==='listening') {
      bars.forEach((b,i)=>{ b.style.height=Math.round(4+((Math.sin(t*1.2+i*0.4)*0.5+0.5))*9)+'px'; b.style.background='#9FE1CB'; });
      orbEl.style.transform='scale(1)'; r1.style.opacity='0.12'; r2.style.opacity='0'; r3.style.opacity='0';
    } else {
      bars.forEach(b=>{ b.style.height='4px'; b.style.background='#378ADD'; });
      orbEl.style.transform='scale(1)'; r1.style.opacity='0'; r2.style.opacity='0'; r3.style.opacity='0';
    }
    _ryanOrbAnimFrame=requestAnimationFrame(tick);
  }
  tick();
}

/* ===== Media ===== */
function setMediaForSpeaker(speaker) {
  const asset = AVATARS[speaker] || AVATARS.Ryan;
  const current = els.media;
  if (!current) return;

  if (asset.type==='orb') {
    if (current.id!=='ryan-orb') {
      if (current.tagName==='VIDEO') { try{current.pause();current.src='';}catch{} }
      const orbEl=getRyanOrb();
      current.replaceWith(orbEl);
      els.media=orbEl; _ryanOrbEl=orbEl;
    }
    ryanOrbSetState('silent');
    return;
  }

  if (_ryanOrbAnimFrame) { cancelAnimationFrame(_ryanOrbAnimFrame); _ryanOrbAnimFrame=null; }

  if (current.tagName!=='VIDEO') {
    const vid=document.createElement('video');
    vid.id='media'; vid.className=current.className||'media';
    vid.autoplay=true; vid.loop=true; vid.muted=true; vid.playsInline=true;
    vid.style.cssText='width:100%;height:440px;object-fit:cover;';
    vid.src=asset.src;
    current.replaceWith(vid); els.media=vid;
    vid.load(); try{vid.play().catch(()=>{});}catch{}
  } else {
    if ((current.getAttribute('src')||'')!==asset.src) { current.src=asset.src; current.load(); }
    try{current.play().catch(()=>{});}catch{}
  }
}

function setSceneBackground(key) {
  const sc=(SCENARIOS[key])||{};
  const bgEl=els.sceneBg, frameEl=els.stageFrame;
  if (!bgEl||!frameEl) return;
  if (sc.bg) {
    bgEl.src=sc.bg; bgEl.classList.remove('hidden'); frameEl.classList.add('has-bg');
  } else {
    bgEl.classList.add('hidden'); bgEl.src=''; frameEl.classList.remove('has-bg');
  }
}

function renderLine(line) {
  setMediaForSpeaker(line.speaker);
  els.name.textContent = (line.speaker==='User_Prompt') ? 'Your Turn' : line.speaker;
  if (line.speaker==='User_Prompt') {
    els.text.innerHTML = `<div class="practice-prompt"><strong>READ THIS OUT LOUD:</strong><br><br>"${line.text.replace('Say: ','').replace(/'/g,'')}"</div><div class="user-response-area">🎤 Speak when ready…</div>`;
  } else {
    els.text.textContent = line.text;
  }
}

/* ===== TTS ===== */
async function speak(text, speaker) {
  const mySession=session;
  try { __audioContexts.forEach(c=>{ try{if(c.state==='suspended')c.resume();}catch{} }); } catch {}
  setMediaForSpeaker(speaker);
  if (speaker==='Ryan') {
    const orbEl=document.getElementById('ryan-orb'); if(orbEl) ryanOrbSetState('speaking');
  }
  if (mySession!==session) return;
  const voice=getKokoroVoice(speaker);
  try {
    await Promise.race([
      (async()=>{
        let started=false;
        const sync=()=>{ if(!started&&mySession===session){started=true;const el=els.media;if(el&&el.tagName==='VIDEO'){try{el.play().catch(()=>{});}catch{}}} };
        const poll=setInterval(()=>{ if(mySession!==session){clearInterval(poll);return;} if(__audioContexts.some(c=>c.state==='running')){clearInterval(poll);sync();} },30);
        setTimeout(()=>{clearInterval(poll);sync();},500);
        await KokoroSpeech.speak(text, voice);
        clearInterval(poll);
        const doneEl=els.media; if(doneEl&&doneEl.id==='ryan-orb') ryanOrbSetState('silent');
      })(),
      new Promise((_,rej)=>{
        const chk=setInterval(()=>{ if(mySession!==session){clearInterval(chk);rej(new Error('session_changed'));} },50);
        setTimeout(()=>clearInterval(chk),120000);
      })
    ]);
  } catch {}
  if (mySession!==session) return;
}

function getKokoroVoice(speaker) {
  if (speaker==='Mary') return 'af_nicole';
  if (speaker==='Ryan') return 'am_adam';
  return 'am_michael';
}

/* ===== Dynamic Mary ===== */
let conversationHistory=[];
function resetConversation() { conversationHistory=[]; }

async function getDynamicMaryResponse(userSaid) {
  const sc=SCENARIOS[currentScenarioKey]||{};
  els.name.textContent='Mary'; els.text.textContent='...';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try {
    const res=await fetch('/api/mary',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        userMessage:userSaid,
        scenarioTitle:sc.title||'',
        scenarioKey:currentScenarioKey,
        history:conversationHistory,
        // If Sofia already introduced herself, remind her
        alreadyIntroduced: currentScenarioKey==='beach' && conversationHistory.some(m=>m.role==='assistant' && m.content.toLowerCase().includes('sofia')),
      }),
      signal:controller.signal,
    });
    clearTimeout(timeout);
    if(!res.ok) return null;
    const data=await res.json();
    const maryText=data.response;
    conversationHistory.push({role:'user',content:userSaid});
    conversationHistory.push({role:'assistant',content:maryText});
    if(conversationHistory.length>12) conversationHistory=conversationHistory.slice(-12);
    return maryText;
  } catch(err) {
    clearTimeout(timeout);
    return null;
  }
}

/* ===== Speech recognition ===== */
function createRecognition() {
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) return null;
  const r=new SR(); r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1;
  return r;
}

function showListening(on=true) {
  if (els.listenPill) els.listenPill.style.display=on?'block':'none';
  const orbEl=document.getElementById('ryan-orb');
  if (orbEl) ryanOrbSetState(on?'listening':'silent');
}

/* ===== listenForUser — robust continuous ===== */
function listenForUser(mySession, maxTotalMs) {
  return new Promise(resolve=>{
    maxTotalMs=maxTotalMs||30000;
    let accumulated='', interim='', silenceTimer=null, hardTimer=null, currentRec=null;
    let resolved=false, lastSpeech=Date.now(), restarts=0;
    const MAX_RESTARTS=8, SILENCE_MS=1500;

    function finish(val) {
      if (resolved) return;
      resolved=true;
      clearTimeout(silenceTimer); clearTimeout(hardTimer);
      if (listenTimer) { clearTimeout(listenTimer); listenTimer=null; }
      if (currentRec) { try{currentRec.onresult=null;currentRec.onerror=null;currentRec.onend=null;currentRec.stop();}catch{}; currentRec=null; }
      showListening(false);
      let final=accumulated.trim();
      if (interim.trim() && !final.toLowerCase().includes(interim.trim().toLowerCase())) final=(final+' '+interim).trim();
      resolve(final||null);
    }

    function scheduleSilence() {
      clearTimeout(silenceTimer);
      silenceTimer=setTimeout(()=>{ if(Date.now()-lastSpeech>=SILENCE_MS-100) finish('silence'); }, SILENCE_MS);
    }

    function startRec() {
      if (resolved||mySession!==session) return;
      if (restarts>=MAX_RESTARTS) { finish('max_restarts'); return; }
      restarts++;
      const r=createRecognition(); if(!r){finish('no_sr');return;}
      r.interimResults=true; r.continuous=true;
      currentRec=r; rec=r; interim='';

      r.onresult=e=>{
        if (resolved||mySession!==session){finish('session');return;}
        lastSpeech=Date.now();
        let finals='', lat='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const t=e.results[i][0].transcript;
          e.results[i].isFinal ? finals+=(finals?' ':'')+t.trim() : lat=t.trim();
        }
        if(finals) accumulated=(accumulated+' '+finals).trim();
        interim=lat;
        scheduleSilence();
      };

      r.onerror=e=>{ if(e.error==='no-speech'||e.error==='aborted') return; finish('err_'+e.error); };

      r.onend=()=>{
        if(resolved||mySession!==session) return;
        if(Date.now()-lastSpeech>=SILENCE_MS) { finish('ended_silent'); return; }
        if(!accumulated&&!interim&&restarts>=MAX_RESTARTS) { finish('no_speech'); return; }
        setTimeout(()=>{ if(!resolved&&mySession===session) startRec(); }, 100);
      };

      try { r.start(); showListening(true); }
      catch { setTimeout(()=>{ if(!resolved) startRec(); }, 200); }
    }

    hardTimer=setTimeout(()=>finish('hard_timeout'), maxTotalMs);
    listenTimer=hardTimer;
    startRec();
  });
}

/* ===== Scenario engine ===== */
async function playScenario(key, practice=false) {
  stopEverything();
  resetConversation();
  await pause(200);
  const mySession=session;
  currentScenarioKey=key;
  Metrics.bumpView(key); Metrics.refreshUI(key);
  setSceneBackground(key);
  const sc=SCENARIOS[key]; if(!sc) return;
  // Cold open scenarios skip demo entirely — throw user straight into practice
  if (sc.coldOpen) practice=true;
  isPractice=practice;
  currentScript=practice?sc.practice:sc.demo;
  stepIndex=0;
  if(els.select.value!==key) els.select.value=key;
  await playLoop(mySession);
}

async function playLoop(mySession) {
  while (stepIndex<currentScript.length) {
    if(mySession!==session) return;
    const line=currentScript[stepIndex];
    renderLine(line);

    if (line.speaker==='User_Prompt') {
      const said=await listenForUser(mySession, 60000);
      if(mySession!==session) return;

      if (said && isPractice) {
        const reply=await getDynamicMaryResponse(said);
        if(mySession!==session) return;
        if(reply) {
          if(stepIndex+1<currentScript.length && currentScript[stepIndex+1].speaker==='Mary') stepIndex++;
          await speak(reply,'Mary');
          setMediaForSpeaker('User_Prompt');
          let look=stepIndex+1;
          while(look<currentScript.length && currentScript[look].speaker==='Ryan') look++;
          if(look<currentScript.length && currentScript[look].speaker==='User_Prompt') stepIndex=look-1;
        } else {
          await speak(randomChoice(['Sorry, say that again?','Hmm, what was that?','Say that again?']),'Mary');
          setMediaForSpeaker('User_Prompt');
        }
      } else if (!said) {
        await speak("No worries, let's keep going.",'Ryan');
      }
      stepIndex++; continue;
    }

    await speak(line.text, line.speaker);
    if(mySession!==session) return;
    await pause(250);
    stepIndex++;
  }

  if(!isPractice) renderAskToPractice(mySession);
  else await freeConversation(mySession);
  // Note: coldOpen scenarios always have isPractice=true so they always go to freeConversation
}

/* ===== Free Conversation ===== */
async function freeConversation(mySession) {
  if(mySession!==session) return;
  const sc=SCENARIOS[currentScenarioKey]||{};
  const FREE_MS=10*60*1000, NUDGE_MS=8*60*1000;
  const start=Date.now();
  let nudged=false;

  if (!sc.coldOpen) {
    await speak("Great work! Now let's have a real conversation -- no script, just talk to her naturally for ten minutes. I'll give you feedback at the end.",'Ryan');
    if(mySession!==session) return;
    await pause(900);
  }

  const timerEl=document.createElement('div');
  timerEl.id='free-timer';
  timerEl.style.cssText='position:fixed;top:70px;right:20px;background:#1a1c22;border:1px solid #2b2e36;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;color:#ffb300;z-index:9999';
  document.body.appendChild(timerEl);
  const timerInterval=setInterval(()=>{
    if(mySession!==session){clearInterval(timerInterval);timerEl.remove();return;}
    const rem=Math.max(0,FREE_MS-(Date.now()-start));
    timerEl.textContent=Math.floor(rem/60000)+':'+String(Math.floor((rem%60000)/1000)).padStart(2,'0')+' left';
    if(rem<=0) clearInterval(timerInterval);
  },1000);

  setMediaForSpeaker('Mary');
  els.name.textContent=sc.coldOpen?'Sofia':'Mary';
  els.text.textContent='...';

  while(mySession===session) {
    const elapsed=Date.now()-start;
    if(elapsed>=FREE_MS) { await speak("That's time. Let me put together your feedback.",'Ryan'); break; }

    if(!nudged&&elapsed>=NUDGE_MS) {
      nudged=true;
      await speak("Two minutes left -- make it count.",'Ryan');
      if(mySession!==session) break;
      await pause(900);
      setMediaForSpeaker('Mary');
      els.name.textContent=sc.coldOpen?'Sofia':'Mary';
    }

    const remMs=Math.min(30000, FREE_MS-(Date.now()-start));
    if(remMs<2000) break;

    const said=await listenForUser(mySession, remMs);
    if(mySession!==session) break;

    if (!said) {
      if (sc.coldOpen) {
        const rescues=["You walked all the way over here. Might as well say something.","I don't bite. Usually.","The waves aren't that interesting, I promise."];
        await speak(randomChoice(rescues),'Mary');
        if(mySession!==session) break;
        await pause(900);
      } else {
        await pause(500);
      }
      continue;
    }

    const reply=await getDynamicMaryResponse(said);
    if(mySession!==session) break;

    if(reply) {
      await speak(reply,'Mary');
    } else {
      await speak(randomChoice(["Hmm?","Say that again?","What was that?"]),'Mary');
    }
    if(mySession!==session) break;
    await pause(900);
    setMediaForSpeaker('Mary');
    els.name.textContent=sc.coldOpen?'Sofia':'Mary';
  }

  clearInterval(timerInterval);
  const te=document.getElementById('free-timer'); if(te) te.remove();
  if(mySession!==session) return;
  await runCoachFeedback(mySession);
}

/* ===== Coach Feedback ===== */
async function runCoachFeedback(mySession) {
  if(mySession!==session) return;
  els.name.textContent='Ryan'; els.text.textContent='Analyzing your session...';
  setMediaForSpeaker('Ryan');
  const sc=SCENARIOS[currentScenarioKey]||{};
  try {
    const res=await fetch('/api/coach',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ conversation:conversationHistory, scenarioTitle:sc.title||'Dating scenario', scenarioKey:currentScenarioKey||'' }),
    });
    if(!res.ok) throw new Error('Coach failed');
    const f=await res.json();
    if(mySession!==session) return;
    await speak(f.spokenSummary,'Ryan');
    if(mySession!==session) return;
    showFeedbackCard(f);
  } catch(err) {
    await speak("Good session! Keep practicing -- pick another scenario.",'Ryan');
  }
}

function showFeedbackCard(f) {
  const scoreColor=f.score>=7?'#40c770':f.score>=5?'#ffb300':'#ff6b6b';
  const isBeach=currentScenarioKey==='beach';
  const bodyHTML=isBeach?`
    <div style="display:grid;gap:10px;margin-bottom:14px">
      <div style="background:#161820;border:1px solid #2b2e3a;border-radius:10px;padding:12px">
        <div style="color:#9aa4b2;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Your opener</div>
        <div style="color:#cfd6e4;font-size:13px;line-height:1.6">${f.openerBreakdown||'---'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:#162016;border:1px solid #1e3a1e;border-radius:10px;padding:12px">
          <div style="color:#40c770;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Best moment</div>
          <div style="color:#c8e6c9;font-size:13px;line-height:1.6">${f.bestMoment||'---'}</div>
        </div>
        <div style="background:#1e1616;border:1px solid #3a1e1e;border-radius:10px;padding:12px">
          <div style="color:#ff6b6b;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Missed opportunity</div>
          <div style="color:#ffcdd2;font-size:13px;line-height:1.6">${f.missedOpportunity||'---'}</div>
        </div>
      </div>
      <div style="background:#1a1730;border:1px solid #2e2a50;border-radius:10px;padding:12px">
        <div style="color:#a78bfa;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Try this next time</div>
        <div style="color:#e0d9ff;font-size:14px;font-style:italic">"${f.tryNextTime||f.tryThisLine||'---'}"</div>
      </div>
      <div style="background:#1a1620;border:1px solid #2e1e3a;border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px">
        <div style="font-size:22px">${(f.wouldSheDateHim||'').startsWith('Yes')?'💚':(f.wouldSheDateHim||'').startsWith('No')?'❌':'🤔'}</div>
        <div>
          <div style="color:#d4a8ff;font-size:11px;font-weight:700;margin-bottom:3px;text-transform:uppercase">Would Sofia date you?</div>
          <div style="color:#e0d9ff;font-size:13px;line-height:1.5">${f.wouldSheDateHim||'---'}</div>
        </div>
      </div>
    </div>` : `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div style="background:#162016;border:1px solid #1e3a1e;border-radius:10px;padding:12px">
        <div style="color:#40c770;font-size:12px;font-weight:700;margin-bottom:8px">CHECK WHAT WORKED</div>
        ${(f.strengths||[]).map(s=>`<div style="color:#c8e6c9;font-size:13px;margin-bottom:4px">- ${s}</div>`).join('')}
      </div>
      <div style="background:#1e1616;border:1px solid #3a1e1e;border-radius:10px;padding:12px">
        <div style="color:#ff6b6b;font-size:12px;font-weight:700;margin-bottom:8px">IMPROVE THIS</div>
        ${(f.improvements||[]).map(i=>`<div style="color:#ffcdd2;font-size:13px;margin-bottom:4px">- ${i}</div>`).join('')}
      </div>
    </div>
    <div style="background:#1a1730;border:1px solid #2e2a50;border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="color:#a78bfa;font-size:12px;font-weight:700;margin-bottom:6px">TRY THIS LINE NEXT TIME</div>
      <div style="color:#e0d9ff;font-size:14px;font-style:italic">"${f.tryThisLine||'---'}"</div>
    </div>`;

  els.text.innerHTML=`
    <div style="background:#1a1c22;border:1px solid #2b2e36;border-radius:16px;padding:20px;margin:10px 0;text-align:left;max-width:860px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="font-size:42px;font-weight:900;color:${scoreColor}">${f.score}<span style="font-size:20px;color:#666">/10</span></div>
        <div style="font-size:16px;color:#cfd6e4;line-height:1.5">${f.spokenSummary}</div>
      </div>
      ${bodyHTML}
      <div style="text-align:center;margin-top:14px">
        <button onclick="playScenario('${currentScenarioKey}',true)" style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:10px 28px;font-size:14px;font-weight:800;cursor:pointer;margin-right:8px">
          Try Again
        </button>
        <button onclick="playScenario(Object.keys(SCENARIOS).find(k=>k!=='${currentScenarioKey}'),false)" style="background:#2a2e36;color:#fff;border:1px solid #3a3f4b;border-radius:999px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">
          Next Scenario
        </button>
      </div>
    </div>`;
}

/* ===== After demo ===== */
function renderAskToPractice(mySession) {
  if(mySession!==session) return;
  els.name.textContent='Ryan';
  els.text.textContent='Want to practice this one? Say yes or pick another scenario.';
  speak("Want to practice this one? Say yes, or pick another scenario.",'Ryan').then(()=>startListeningYesNo(mySession));
}

function startListeningYesNo(mySession) {
  if(mySession!==session) return;
  const r=createRecognition(); if(!r) return;
  rec=r; showListening(true);
  listenTimer=setTimeout(()=>{try{r.stop();}catch{}},6000);
  r.onresult=e=>{
    clearTimeout(listenTimer); showListening(false);
    if(e.results[0][0].transcript.toLowerCase().includes('yes')) playScenario(currentScenarioKey,true);
    else speak("Okay -- choose any scenario from the list.",'Ryan');
  };
  r.onerror=()=>showListening(false);
  r.onend=()=>showListening(false);
  try{r.start();}catch{}
}

/* ===== UI ===== */
function renderShelf() {
  const keys=Object.keys(SCENARIOS);
  els.select.innerHTML=keys.map(k=>`<option value="${k}">${SCENARIOS[k].title}</option>`).join('');
  els.select.onchange=()=>playScenario(els.select.value,false);
  els.shelf.innerHTML='';
  const limit=3;
  keys.slice(0,limit).forEach(k=>els.shelf.appendChild(makeCard(k)));
  if(keys.length>limit){
    els.showMore.style.display='block';
    els.showMore.textContent='+ '+(keys.length-limit)+' more -- show all';
    let exp=false;
    els.showMore.onclick=()=>{
      exp=!exp; els.shelf.innerHTML='';
      (exp?keys:keys.slice(0,limit)).forEach(k=>els.shelf.appendChild(makeCard(k)));
      els.showMore.textContent=exp?'Show fewer':'+ '+(keys.length-limit)+' more -- show all';
    };
  } else els.showMore.style.display='none';
}

function makeCard(key) {
  const sc=SCENARIOS[key];
  const card=document.createElement('div'); card.className='sc-card';
  const img=document.createElement('img'); img.className='sc-thumb'; img.src=sc.thumb||'Ryan.jpg'; img.onerror=()=>img.style.display='none';
  const title=document.createElement('div'); title.innerHTML='<div class="sc-title">'+sc.title+'</div><div class="sc-sub">Click to load</div>';
  card.appendChild(img); card.appendChild(title);
  card.onclick=()=>playScenario(key,false);
  return card;
}

function renderAvatarPicker() {
  if(!els.pickerBackdrop) return;
  els.pickerGrid.innerHTML=AVATAR_SETS.map(s=>`
    <div class="pick-card" data-id="${s.id}">
      <img class="pick-img" src="${s.thumb||'Ryan.jpg'}" alt="${s.label}">
      <div class="pick-meta"><b>${s.label}</b><br>Choose this person</div>
      <div class="pick-foot">${s.maryVideo||'--'} / ${s.danielVideo||'--'}</div>
    </div>`).join('');
  els.pickerGrid.querySelectorAll('.pick-card').forEach(card=>{
    card.onclick=()=>{
      const set=AVATAR_SETS.find(x=>x.id===card.getAttribute('data-id'));
      applyAvatarSet(set);
      els.pickerBackdrop.style.display='none';
      renderShelf(); Metrics.refreshUI(Object.keys(SCENARIOS)[0]); playScenario(Object.keys(SCENARIOS)[0],false);
    };
  });
  els.pickerBackdrop.style.display='flex';
}

els.enterPractice.onclick=()=>playScenario(currentScenarioKey||Object.keys(SCENARIOS)[0],true);
els.micBtn.onclick=()=>{};
els.chooseBtn.onclick=renderAvatarPicker;

/* ===== Helpers ===== */
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const randomChoice=arr=>arr[Math.floor(Math.random()*arr.length)];
function similarity(actual,promptText){
  const exp=promptText.replace('Say: ','').replace(/'/g,'').toLowerCase();
  const words=exp.split(/\s+/).filter(w=>w.length>2);
  const said=(actual||'').toLowerCase();
  return words.filter(w=>said.includes(w)).length/Math.max(1,words.length);
}

/* ===== Boot ===== */
function bootDefault() {
  const set=AVATAR_SETS[Math.floor(Math.random()*AVATAR_SETS.length)];
  applyAvatarSet(set);
  Metrics.bindLikeButton();

  const overlay=document.createElement('div');
  overlay.id='ek-start-overlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(13,14,18,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px';
  overlay.innerHTML=`
    <div style="font-size:48px;line-height:1">🎙️</div>
    <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px">Eklipses</div>
    <div style="font-size:15px;color:#9aa4b2;max-width:320px;text-align:center;line-height:1.9;font-style:italic">
      "Most guys know what to say.<br>They freeze anyway.<br>This is where you fix that."
    </div>
    <button id="ek-start-btn" style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:14px 48px;font-size:17px;font-weight:800;cursor:pointer;margin-top:8px;transition:transform .1s ease" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform=''">
      Show me what you've got
    </button>
    <div id="ek-prog-wrap" style="display:none;width:280px;text-align:center">
      <div style="background:#2b2e36;border-radius:6px;height:8px;overflow:hidden;margin-bottom:8px">
        <div id="ek-prog-fill" style="background:#ffb300;height:100%;width:0%;border-radius:6px;transition:width 0.25s ease"></div>
      </div>
      <div id="ek-prog-label" style="font-size:12px;color:#777">Loading AI model...</div>
    </div>`;
  document.body.appendChild(overlay);

  let _bootStarted = false;
  document.getElementById('ek-start-btn').onclick=async()=>{
    if (_bootStarted) return; // prevent double-tap
    _bootStarted = true;
    document.getElementById('ek-start-btn').style.display='none';
    document.getElementById('ek-prog-wrap').style.display='block';
    try {
      await KokoroSpeech.preload(info=>{
        const fill=document.getElementById('ek-prog-fill'), label=document.getElementById('ek-prog-label');
        if(fill&&info.progress!=null) fill.style.width=Math.round(info.progress)+'%';
        if(label&&info.file) label.textContent='Loading '+info.file.split('/').pop()+'...';
      });
    } catch(err) {
      const lbl=document.getElementById('ek-prog-label');
      if(lbl) lbl.innerHTML='<span style="color:#ff6b6b">Failed: '+err.message+'</span>';
      return;
    }
    overlay.remove();
    renderShelf(); // populate shelf and dropdown now, after overlay gone
    const firstKey=Object.keys(SCENARIOS)[0];
    Metrics.refreshUI(firstKey);
    currentScenarioKey=firstKey;
    setMediaForSpeaker('Ryan');
    els.name.textContent='Ryan';
    els.text.textContent='';
    // Ryan speaks the hook — then waits for user to pick a scenario
    await speak("Most guys know what to say. They freeze anyway.", 'Ryan');
    await pause(500);
    await speak("Pick a scenario. Show me what you've got.", 'Ryan');
    // Show idle state — user picks from shelf or dropdown
    els.text.textContent='Choose a scenario to begin.';
    ryanOrbSetState('silent');
  };
}

bootDefault();
