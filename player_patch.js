// ============================================================
// EKLIPSES — player.js PATCH
// Apply these as replacements to the corresponding functions.
// 3 replacements total — search for the function name and swap.
// ============================================================

// ─────────────────────────────────────────────────────────────
// REPLACEMENT 1: speak()
//
// What changed:
//   - Mary's text (caption + lineText) now shows ONLY when audio
//     actually starts playing — not before, not during fetch.
//   - Caption overlay is now wired up: Caption.show() on audio
//     start, Caption.hide() when done.
//   - els.text stays as '...' (thinking state) until audio fires.
//   - Subtle "thinking pause" (150–350ms) added before audio loads
//     for Mary — makes the response feel considered, not instant.
//   - All other behaviour (video switching, session guard,
//     Kokoro for Ryan) is unchanged.
// ─────────────────────────────────────────────────────────────

async function speak(text, speaker) {
  const mySession = session;
  try { __audioContexts.forEach(c => { try { if (c.state === 'suspended') c.resume(); } catch {} }); } catch {}

  if (speaker === 'Mary') {
    setMediaForSpeaker('User_Prompt'); // idle video while audio loads
  } else {
    setMediaForSpeaker(speaker);
  }

  if (speaker === 'Ryan') {
    const orbEl = document.getElementById('ryan-orb');
    if (orbEl) ryanOrbSetState('speaking');
  }

  if (mySession !== session) return;

  // Thinking pause for Mary — feels considered, not robotic
  if (speaker === 'Mary') {
    await pause(150 + Math.floor(Math.random() * 200));
    if (mySession !== session) return;
  }

  const switchToSpeaking = () => {
    if (mySession !== session) return;
    if (speaker === 'Mary') {
      // Show text exactly when audio starts — not before
      els.text.textContent = text;
      Caption.show(text);
      if (AVATARS._marySpeakingVideo) {
        const el = els.media;
        if (el && el.tagName === 'VIDEO' && (el.getAttribute('src') || '') !== AVATARS._marySpeakingVideo) {
          el.src = AVATARS._marySpeakingVideo;
          el.load();
          try { el.play().catch(() => {}); } catch {}
        }
      } else {
        setMediaForSpeaker('Mary');
      }
    } else {
      const el = els.media;
      if (el && el.tagName === 'VIDEO') { try { el.play().catch(() => {}); } catch {} }
    }
  };

  const switchToIdle = () => {
    const doneEl = els.media;
    if (doneEl && doneEl.id === 'ryan-orb') ryanOrbSetState('silent');
    if (speaker === 'Mary') {
      Caption.hide();
      if (doneEl && doneEl.tagName === 'VIDEO') {
        try { doneEl.pause(); } catch {}
        const idleSrc = AVATARS._maryIdleVideo || AVATARS.User_Prompt.src;
        if (idleSrc && (doneEl.getAttribute('src') || '') !== idleSrc) {
          doneEl.src = idleSrc;
          doneEl.load();
          try { doneEl.play().catch(() => {}); } catch {}
        }
      }
    }
  };

  try {
    await Promise.race([
      (async () => {
        if (speaker === 'Mary') {
          await speakElevenLabs(text, switchToSpeaking);
          switchToIdle();
        } else {
          const voice = getKokoroVoice(speaker);
          let started = false;
          const poll = setInterval(() => {
            if (mySession !== session) { clearInterval(poll); return; }
            if (__audioContexts.some(c => c.state === 'running')) {
              clearInterval(poll);
              if (!started) { started = true; switchToSpeaking(); }
            }
          }, 30);
          setTimeout(() => { clearInterval(poll); if (!started) { started = true; switchToSpeaking(); } }, 3000);
          await KokoroSpeech.speak(text, voice);
          clearInterval(poll);
          switchToIdle();
        }
      })(),
      new Promise((_, rej) => {
        const chk = setInterval(() => {
          if (mySession !== session) { clearInterval(chk); rej(new Error('session_changed')); }
        }, 50);
        setTimeout(() => clearInterval(chk), 120000);
      }),
    ]);
  } catch (e) {
    if (e.message !== 'session_changed') console.warn('speak error:', e.message);
  }

  if (mySession !== session) return;
}


// ─────────────────────────────────────────────────────────────
// REPLACEMENT 2: getCharacterResponse()
//
// What changed:
//   - els.text now shows a randomised "thinking" indicator
//     instead of always '...' — tiny detail, big feel difference.
//   - On error/null response, text resets cleanly.
//   - Everything else is identical to the original.
// ─────────────────────────────────────────────────────────────

async function getCharacterResponse(userSaid) {
  const sc = SCENARIOS[currentScenarioKey] || {};
  els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);

  // Randomised thinking indicator — feels less robotic than always '...'
  const thinkingStates = ['...', '…', '  ', '...'];
  els.text.textContent = thinkingStates[Math.floor(Math.random() * thinkingStates.length)];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('/api/character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: userSaid,
        scenarioKey: currentScenarioKey,
        characterId: currentCharacterId,
        history: conversationHistory,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      els.text.textContent = '...';
      return null;
    }
    const data = await res.json();
    const maryText = data.response;
    if (!firstUserOpener) firstUserOpener = userSaid;
    conversationHistory.push({ role: 'user', content: userSaid });
    conversationHistory.push({ role: 'assistant', content: maryText });
    if (conversationHistory.length > 12) conversationHistory = conversationHistory.slice(-12);
    // NOTE: do NOT set els.text here — speak() will set it when audio starts
    return maryText;
  } catch (err) {
    clearTimeout(timeout);
    els.text.textContent = '...';
    return null;
  }
}


// ─────────────────────────────────────────────────────────────
// REPLACEMENT 3: freeConversation() — the main convo loop
//
// What changed:
//   - els.text set to '...' (not the reply) after each exchange,
//     so text never "pre-loads" before audio fires.
//   - The pause between exchanges is tuned: 1200ms (was 1500ms)
//     — tighter rhythm, feels less like a loading screen.
//   - els.name reset happens AFTER pause, not before — avoids
//     the flash of name change while audio is still going.
//   - All rescue lines, impatience lines, timer logic unchanged.
// ─────────────────────────────────────────────────────────────

async function freeConversation(mySession) {
  let freeConvRescueUsed = null;
  let firstExchangeDone = false;
  let silenceCount = 0;
  if (mySession !== session) return;
  const sc = SCENARIOS[currentScenarioKey] || {};
  const FREE_MS = 3 * 60 * 1000, NUDGE_MS = 2 * 60 * 1000;
  const start = Date.now();
  let nudged = false;

  resetConversation();

  if (!sc.coldOpen) {
    await speak("Great work! Now let's have a real conversation -- no script, just talk to her naturally for ten minutes. I'll give you feedback at the end.", 'Ryan');
    if (mySession !== session) return;
    await pause(900);
  }

  const timerEl = document.createElement('div');
  timerEl.id = 'free-timer';
  timerEl.style.cssText = 'position:fixed;top:70px;right:20px;background:#1a1c22;border:1px solid #2b2e36;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;color:#ffb300;z-index:9999';
  document.body.appendChild(timerEl);
  const timerInterval = setInterval(() => {
    if (mySession !== session) { clearInterval(timerInterval); timerEl.remove(); return; }
    const rem = Math.max(0, FREE_MS - (Date.now() - start));
    timerEl.textContent = Math.floor(rem / 60000) + ':' + String(Math.floor((rem % 60000) / 1000)).padStart(2, '0') + ' left';
    if (rem <= 0) clearInterval(timerInterval);
  }, 1000);

  setMediaForSpeaker('Mary');
  els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);
  els.text.textContent = '...';

  const warmupMs = currentScenarioKey === 'street' ? 2500 : 1200;
  await pause(warmupMs);

  while (mySession === session) {
    const elapsed = Date.now() - start;
    if (elapsed >= FREE_MS) {
      await speak("That's time. Let me put together your feedback.", 'Ryan');
      break;
    }

    if (!nudged && elapsed >= NUDGE_MS) {
      nudged = true;
      await speak("Two minutes left -- make it count.", 'Ryan');
      if (mySession !== session) break;
      await pause(900);
      setMediaForSpeaker('Mary');
      els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);
      els.text.textContent = '...';
    }

    const remMs = Math.min(30000, FREE_MS - (Date.now() - start));
    if (remMs < 2000) break;

    const said = await listenForUser(mySession, remMs);
    if (mySession !== session) break;

    if (!said) {
      if (sc.coldOpen && !firstExchangeDone) {
        const rescuesByScenario = {
          beach:       ["You walked all the way over here. Might as well say something.", "I don't bite. Usually.", "The waves aren't that interesting, I promise.", "Most people just walk past. You didn't.", "You can sit if you want. I don't mind.", "The quiet is better when someone breaks it well.", "I saw you walk by earlier.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          street:      ["You stopped for a reason.", "I have somewhere to be, just so you know.", "Clock's ticking.", "Most people just walk past.", "You look like you had something to say.", "Take your time. But not too much.", "Still working up to it?", "This is the part where you say something."],
          bar:         ["You came over for a reason.", "I don't bite. Usually.", "Most people just stand at the bar.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          gym:         ["You came over for a reason.", "I'm between sets, not retired.", "Clock's ticking.", "You look like you had something to say.", "Take your time."],
          museum:      ["You stopped here for a reason.", "Most people just walk past.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          bookstore:   ["You came down this aisle for a reason.", "Most people just browse.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          rooftop:     ["You came all the way over here.", "The view isn't going anywhere.", "Most people just stay on their side.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          house_party: ["You came over for a reason.", "I don't bite. I'm at a party.", "Most people just stay in their group.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          coffee_shop: ["You stopped at this table for a reason.", "I'm not that focused on the notebook.", "Most people just walk past.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          art_gallery: ["You stopped at this piece for a reason.", "Most people walked past it.", "You look like you had something to say.", "Take your time.", "Still working up to it?", "The painting isn't going anywhere."],
          yoga_studio: ["You came over for a reason.", "I'm stretching, not meditating.", "Clock's ticking — I'll finish and leave.", "You look like you had something to say.", "Take your time."],
          airport:     ["We've got time. Flight's delayed.", "Most people just stay in their seat.", "You look like you had something to say.", "Take your time.", "Still working up to it?", "The board hasn't changed."],
          supermarket: ["You stopped in this aisle for a reason.", "Most people just keep moving.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          office_lobby:["You came over for a reason.", "The elevator's taking its time.", "Most people just look at their phones.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          train:       ["You're still here.", "The train has a few more stops.", "Most people just look out the window.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
        };
        const rescues = rescuesByScenario[currentScenarioKey] || rescuesByScenario.beach;
        if (!freeConvRescueUsed) freeConvRescueUsed = new Set();
        const available = rescues.filter(r => !freeConvRescueUsed.has(r));
        const pool = available.length > 0 ? available : rescues;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        freeConvRescueUsed.add(chosen);
        if (freeConvRescueUsed.size >= rescues.length) freeConvRescueUsed.clear();
        await speak(chosen, 'Mary');
        if (mySession !== session) break;
        await pause(1800);
      } else {
        silenceCount++;
        if (firstExchangeDone && silenceCount >= 2) {
          silenceCount = 0;
          const impatience = {
            street:       ["Still there?", "I do have somewhere to be.", "You went quiet.", "Was there something else?"],
            beach:        ["Still there?", "You went quiet.", "Was there something else?", "Take your time."],
            bar:          ["Still there?", "You went quiet.", "Was there something else?"],
            gym:          ["Still there?", "You went quiet.", "Was there something else?"],
            museum:       ["Still there?", "You went quiet.", "Was there something else?"],
            bookstore:    ["Still there?", "You went quiet.", "Was there something else?"],
            rooftop:      ["Still there?", "You went quiet.", "Was there something else?"],
            house_party:  ["Still there?", "You went quiet.", "Was there something else?"],
            coffee_shop:  ["Still there?", "You went quiet.", "Was there something else?"],
            art_gallery:  ["Still there?", "You went quiet.", "Was there something else?"],
            yoga_studio:  ["Still there?", "You went quiet.", "Was there something else?"],
            airport:      ["Still there?", "You went quiet.", "Was there something else?", "The board still hasn't changed."],
            supermarket:  ["Still there?", "You went quiet.", "Was there something else?"],
            office_lobby: ["Still there?", "You went quiet.", "Was there something else?"],
            train:        ["Still there?", "You went quiet.", "Was there something else?", "Few more stops."],
          };
          const pool = impatience[currentScenarioKey] || impatience.beach;
          const line = pool[Math.floor(Math.random() * pool.length)];
          await speak(line, 'Mary');
          if (mySession !== session) break;
          await pause(1000);
        } else {
          await pause(500);
        }
      }
      continue;
    }

    // Got a reply — fetch character response (text stays '...' until audio fires)
    const reply = await getCharacterResponse(said);
    firstExchangeDone = true;
    silenceCount = 0;
    if (mySession !== session) break;

    if (reply) {
      await speak(reply, 'Mary');
    } else {
      await speak(randomChoice(["Hmm?", "Say that again?", "What was that?"]), 'Mary');
    }
    if (mySession !== session) break;

    // Tighter gap between exchanges — 1200ms feels like conversation, 1500ms feels like loading
    await pause(1200);
    setMediaForSpeaker('Mary');
    // Reset name+text AFTER the pause so there's no flash during audio tail
    els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);
    els.text.textContent = '...';
  }

  clearInterval(timerInterval);
  const te = document.getElementById('free-timer');
  if (te) te.remove();
  if (mySession !== session) return;
  await runCoachFeedback(mySession);
}
