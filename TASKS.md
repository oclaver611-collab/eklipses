# EKLIPSES TASKS
## Add tasks here during the day. Claude Code executes them in the evening.

---

## PRIORITY — DO THESE FIRST

- [ ] Integrate ElevenLabs Flash API for character voice responses in character-stream.js (replace OpenAI TTS for Mary/character voice only, keep Kokoro for Ryan)
- [ ] Build session history system using localStorage — store last 10 sessions with date, scenario, character, score, tryNextTime line
- [ ] Build progress dashboard — show last 10 sessions as a score graph on the main screen
- [ ] Add streak counter — track consecutive days with at least 1 session, show streak on main screen
- [ ] Integrate Stripe — $14.99/month beta plan, 3 free sessions then paywall, use Stripe Checkout hosted page

---

## WEEK 1 TASKS

- [ ] Add Sofia mood variation — 5 moods (focused, restless, curious, guarded, playful), selected randomly each session, passed to character-stream.js as context
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
- [x] Coach eval at 142/144
- [x] Stable tags: v-stable-may27-latency-fix, v-stable-may28-coach-fix
