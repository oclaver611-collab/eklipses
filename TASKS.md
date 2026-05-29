# EKLIPSES TASKS
## Add tasks here during the day. Claude Code executes them in the evening.

---

## PRIORITY — DO THESE FIRST

- [x] Integrate ElevenLabs Flash API for character voice responses — done, per-character voice IDs, OpenAI fallback
- [x] Build session history system + progress dashboard — localStorage, last 10 sessions, bar chart modal
- [x] Add streak counter — consecutive days, fire badge in topbar, scales at 3+ and 7+
- [x] Sofia mood variation — 5 moods randomly selected per session, injected into system prompt
- [x] Fix voice bleed bug — speakElevenLabs now passes characterId to /api/tts
- [x] Fix silent avatars bug — 12s fetch timeout + 20s audio watchdog in speakElevenLabs
- [x] Build eval-pipeline.js, eval-tts.js, test-all.js master runner
- [ ] Integrate Stripe — $14.99/month beta plan, 3 free sessions then paywall, use Stripe Checkout hosted page

---

## WEEK 1 TASKS

- [x] Add Sofia mood variation — done (in PRIORITY above)
- [ ] Fix Deepgram STT — ensure fallback to Chrome STT is seamless, add console logging so we can see which STT is active
- [ ] Add approach warm-up screen — 10-second Ryan focus screen before each session starts ("Take a breath. She hasn't judged you yet. Go.")
- [ ] Redesign feedback card — make it screenshot-worthy, score prominent, best line quoted, "Would she date him?" verdict clear
- [ ] Build deploy.bat — one-click deploy script (already created, just copy to EK7 folder)

---

## WEEK 2 TASKS

- [ ] Cross-session memory — Sofia remembers the user from last session, references it in opening lines
- [ ] Mobile CSS optimization — fix layout on iPhone screen size
- [ ] Pattern coaching — Ryan tracks recurring mistakes across last 5 sessions, mentions them in feedback
- [ ] Scenario unlock progression — scenarios unlock as user completes sessions (first 3 free, rest unlock at certain session counts)
- [ ] Weekly progress email — send summary every Monday (requires email capture at paywall)

---

## WEEK 3 TASKS

- [ ] Generate 10 new scenarios from Dark Needle YouTube channel using gen-scenario-v2.js
- [ ] Live vibe meter — subtle visual indicator on session screen showing character interest level
- [ ] Leaderboard first version — show top 10 scores of the week (shared localStorage or simple backend)
- [ ] ProductHunt assets — prepare GIF of Sofia responding, Ryan feedback card screenshot

---

## BACKLOG (later)

- [ ] Branching scenario states — each scenario has 3 random starting states
- [ ] Escalating relationship system — Sofia changes behavior after sessions 3, 7, 15
- [ ] Dark psychology niche — new character type, new scenarios (manipulative boss, toxic friend)
- [ ] Squad mode — share a code with friends, compete on weekly scores
- [ ] Camera/context-aware opener — point camera, AI generates situation-specific opener

---

## COMPLETED
*(move tasks here when done)*

- [x] Groq as default model (latency fix)
- [x] SSE streaming character responses  
- [x] Dynamic silence detection 900/1800ms
- [x] Full Sofia prompts in character-stream.js
- [x] Deepgram Nova-3 STT integrated
- [x] All 5 Ryan coach issues fixed
- [x] Coach eval at 142/144 → now 144/144 (motivational close keywords + post-processor)
- [x] Stable tags: v-stable-may27-latency-fix, v-stable-may28-coach-fix
- [x] eval-coach-v4.js — full coach quality eval (banned phrases, score, card fields, motivational close)
- [x] test-all.js — master runner, exit-code detection, 180s pipeline timeout
