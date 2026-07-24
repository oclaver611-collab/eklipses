# Pause-and-Rewind Coaching — Architecture & Risk Assessment

**Status:** Design only — no implementation started  
**Date:** July 2026  
**Scope:** Mid-conversation teachable-moment detection, pause, coaching overlay, and conversation rollback

---

## 0. How the existing end-of-scenario coach works (baseline)

After the full scenario ends, `showFeedbackCard()` fires. It calls `/api/coach` as a POST with:
- Full `conversationHistory` (up to last 12 messages)
- `scenarioKey`, `characterId`, `userOpener`
- `lesson1Complete` / `lesson2Complete` flags
- `practiceFocus` (free / lesson1 / lesson2)

The coach LLM runs a full evaluation: scoring on a 1–10 band, lesson skill checks (OTIMC / FRAME), `bestMoment`, `missedOpportunity`, `tryNextTime`, `wouldSheDateHim`. This typically takes 2–5 seconds and produces ~1,500–2,500 tokens of structured JSON.

Everything below compares against this baseline.

---

## 1. Detecting a teachable moment mid-conversation

### What we need vs. what the existing coach does

The end-of-scenario coach evaluates the *whole arc*. A mid-turn detector needs to answer a narrower binary question: **"Did this specific user turn contain a clear, concrete mistake worth interrupting for?"**

The output is structurally simpler:
```
{ teachable: boolean, severity: 'critical' | 'notable', coaching: string }
```

Where `coaching` is Ryan's short spoken line referencing the user's literal last message — not a full evaluation.

### Proposed detection mechanism

**A lightweight `/api/coach-moment` endpoint** (or a `mode: 'moment'` flag on the existing `/api/coach` endpoint) that receives:

- The user's last turn only (not full history)
- The character's response to that turn
- `scenarioKey` + `characterId` (for context)
- The `practiceFocus` flag (only meaningful in lesson modes)
- An explicit instruction to be *conservative* — only flag clearly significant moments, not every imperfect line

The system prompt would be dramatically shorter than the full coach prompt, targeting a 300–600 token response and a 1–2 second latency rather than 2–5 seconds.

### When to fire it

The natural trigger point is **immediately after `streamCharacterAndSpeak()` returns** — the character has finished speaking, `conversationHistory` has been updated, and the mic hasn't re-opened yet. This is the gap between the character's last word and `listenForUser()` starting.

```
[user speaks] → streamCharacterAndSpeak() → [gap here] → listenForUser()
                                               ↑
                                   fire moment-check here (async, non-blocking)
```

The check runs in the background while the system transitions back to listening mode. If it returns positive *before* the user speaks their next line, the pause triggers. If the user speaks before it returns, **the result is discarded** — it's too late to interrupt without confusing the flow.

This creates a natural urgency window: the check must resolve in roughly the time between the character finishing speaking and the user starting their next sentence (in practice, 2–8 seconds of silence while the user thinks). If latency on the moment-check is consistently above 3 seconds, users will frequently speak before the interrupt can fire, making the feature unreliable.

### Sensitivity calibration

The prompt must be conservative by design. Common failure modes if miscalibrated:

- **Too sensitive**: Ryan interrupts on every imperfect line — immersion breaks constantly, feature feels like a punishment system
- **Too loose**: Genuinely bad turns (number-ask on turn 2, bragging opener, agreeing with every test) pass without comment

Proposed initial heuristic filters to apply *before* the API call (cheap, client-side), to reduce API call frequency in obvious non-teachable moments:
- User turn length < 5 words → skip (probably mic misfire or "hi")
- `_exchangeCount` === 0 (opening line) → always let it play out, never interrupt the very first turn
- Character's response was warm and engaged → probably not a critical failure, maybe skip

These filters won't be perfect, but they can reduce the moment-check API hit rate by ~50% without missing the genuinely bad turns.

---

## 2. What "pause" actually requires

### Current reality

There is no soft-pause in the current system. The only stop mechanism is `stopEverything()`, which:
1. Increments `session` (the cancellation token for all async code)
2. Kills all `<audio>` elements
3. Cancels KokoroSpeech
4. Suspends all AudioContexts
5. Stops SpeechRecognition
6. Clears all timers and the watchdog interval

This is nuclear — once called, the current `playLoop` execution is dead. Any `await` that follows returns immediately via the `mySession !== session` guard.

### What pause needs to do differently

Pause must be **soft** — it stops audio and mic but does not kill the session or the playLoop. The playLoop needs to remain suspended at a specific point and be resumable.

Minimum requirements for a valid pause:

1. **Stop TTS**: Mute and stop the current `<audio>` element playing the character's last line. Since the moment-check fires *after* `streamCharacterAndSpeak()` returns, the character has already finished speaking — there is nothing active to stop. This is actually the easy case.

2. **Prevent mic from opening**: The gap between `streamCharacterAndSpeak()` returning and `listenForUser()` starting is where the pause needs to be inserted. Mechanically, this means introducing a `pauseFlag` check at that point: before calling `listenForUser()`, check if a pause is pending and await a "resume" signal instead.

3. **No timer to halt**: The scenario itself has no wall-clock timer. `listenForUser()` has a 60-second timeout, but it won't have been called yet. Nothing to clear.

4. **Show Ryan's coaching overlay**: Display a modal with Ryan's coaching text. Optionally play it as TTS (using the existing `speak()` function for Ryan). This requires the `mySession` to still be valid, which it is under a soft-pause model.

### The soft-pause mechanism (design sketch, not implementation)

A module-level `pauseState` object:
```
{ active: boolean, resolve: function | null }
```

Inserted as a single await point in `playLoop` immediately before each `listenForUser()` call:
```
await waitIfPaused(mySession);   ← new gate
const said = await listenForUser(mySession, 60000);
```

`waitIfPaused` returns immediately if not paused, or waits on a Promise that resolves when the pause clears. The pause-and-resume is fully internal to the `playLoop` — nothing from the outside needs to know about the session counter.

This does **not** require changing `stopEverything()` or the session lifecycle. The session counter remains untouched during pause.

---

## 3. What "rewind" actually requires

### The conversation state that needs to roll back

The in-memory state that `playLoop` and `streamCharacterAndSpeak` mutate after each user turn:

| Variable | Where it lives | Rollback needed? |
|----------|---------------|-----------------|
| `conversationHistory` | Module-level array (up to 12 messages) | **Yes** — the last 2 entries (user + assistant) |
| `_exchangeCount` | Module-level counter | **Yes** — decrement by 1 |
| `firstUserOpener` | Module-level string | **No** — preserve (used in final coach eval) |
| `stepIndex` | Local to `playLoop` | **Yes** — back 1 step to the `User_Prompt` line |
| Caption overlay | DOM | **Yes** — hide it |
| Transcript display | DOM | **Yes** — visually remove last exchange |

### The snapshot approach

Before each `listenForUser()` call, take a lightweight snapshot:
```
snapshot = {
  history: conversationHistory.slice(),   // shallow copy (strings only)
  exchangeCount: _exchangeCount,
  stepIndex: stepIndex,
}
```

On rewind, restore from snapshot. This is cheap (< 1ms) and happens at a natural pause point where the code is already waiting.

### What genuinely cannot be undone

**The character's spoken audio.** Once `streamCharacterAndSpeak()` has played the character's response, that audio has been heard. Rewinding the *data* is clean; rewinding the *experience* is not. The character said "I've heard that before" and the user heard it.

This is not necessarily a fatal problem — it's the same as a chess engine showing you the move you just made before offering a "take back." The user knows they already made the move; the coaching moment is about *understanding why it was wrong* and practicing the alternative. The heard audio is context, not damage.

**Design implication**: the rewind should be presented explicitly as "let's try that again" not as an illusion that the previous exchange never happened. The character will re-enter from her prior line (the line that preceded the user's bad turn) and will have no memory of the "undone" exchange (because `conversationHistory` was rolled back). From the character's API perspective, the bad turn simply didn't happen.

### Re-triggering the character's prior line

After rollback, the character needs to re-deliver her previous line to give the user a clean "go" signal. This is the line she spoke *immediately before* the user's bad turn — captured in the snapshot or derived from the rolled-back `conversationHistory` as the last `assistant` entry.

Options:
- **Re-speak from cache**: If the character's prior line TTS audio was cached (likely, since it was just played), just re-play it. Fast, no API call.
- **Re-generate**: Call TTS fresh. Adds latency and produces a slightly different audio (ElevenLabs varies slightly). Unnecessary if caching is available.

The ElevenLabs `/api/tts` response is not currently cached client-side (no `prefetchedUrl` mechanism for character lines, only for Ryan). This is a gap — for rewind to feel fast, the character's prior-line audio needs to be held in a buffer for one turn.

### The `hasIntroduced` flag

This is server-side state derived from `conversationHistory` in `character.js`. When the rolled-back history is sent on the next call, `character.js` recomputes whether the character has introduced herself from the rolled-back data. No client-side tracking needed.

---

## 4. Technical risk points, ranked

### Risk 1 — Session lifecycle corruption (HIGH)

**The risk**: If pause-rewind is implemented incorrectly and calls `stopEverything()` or increments `session` mid-rewind, the `mySession !== session` guard fires in every awaited function in `playLoop` and `streamCharacterAndSpeak`. The loop silently exits. The character stops responding. Audio plays nothing. No error is shown.

This failure mode is silent and hard to diagnose in production. The session counter mechanism was designed for a single clean-termination model (back button, new scenario), not for "pause-and-resume within the same loop iteration."

**Mitigation**: Soft-pause must never touch `session`. If a rewind triggers a `streamCharacterAndSpeak()` call for the re-delivery of the character's prior line, that call must use the same `mySession` as the active `playLoop` iteration.

**Risk level**: HIGH — wrong implementation here is invisible until production.

### Risk 2 — Voice recognition re-entry after pause (HIGH)

**The risk**: SpeechRecognition is stateful. If `listenForUser()` has already started when a pause is triggered (race condition if the user speaks very quickly), aborting it mid-stream leaves the browser's recognition engine in an ambiguous state. The next `listenForUser()` call (after rewind) may fail silently, fire its `onerror` handler, or produce a duplicate result.

The existing `listenForUser()` already has watchdog handling for SpeechRecognition state issues (the `watchdogInterval` pattern). But it was not designed for "was aborted deliberately mid-listen."

**Mitigation**: The moment-check fires in the gap *before* `listenForUser()`, so in the common case recognition hasn't started. But the race window (user speaks immediately after character finishes) must be handled explicitly — if `listenForUser()` has already received a result, the pause attempt must be abandoned, not forced.

**Risk level**: HIGH — SpeechRecognition reliability is the most fragile part of the existing system.

### Risk 3 — Latency making the pause feel wrong (MEDIUM-HIGH)

**The risk**: If the teachable-moment check takes 3–5 seconds, the pause fires *after* the user has already started their next turn — or worse, after the character is already responding to it. A late-arriving interrupt that freezes mid-response is confusing.

The window is real but narrow. The check needs to resolve in < 3 seconds consistently (targeting < 2 seconds). Current coach latency averages 2–4 seconds on the full evaluation. A lighter prompt with a smaller model might achieve 1–2 seconds, but it's not guaranteed.

**Mitigation**: Hard abort rule — if `listenForUser()` receives *any* speech input before the moment-check resolves, discard the check result. Never interrupt a turn that's already in progress.

**Risk level**: MEDIUM-HIGH — latency is infrastructure-dependent and hard to control.

### Risk 4 — Conversation history desync after rewind (MEDIUM)

**The risk**: The rollback removes the last user+assistant pair from `conversationHistory`. On the retry, the user speaks and a fresh character response is generated from the rolled-back history. This is the intended behavior. But if the original character response contained something that primed the character's persona (e.g., she mentioned a detail about herself that the user is now about to reference), the retry character won't have that context.

Example: Character mentioned she's from Helsinki in the "undone" turn. User's retry opens with "Helsinki, that's interesting—". Character has no memory of saying Helsinki. She'll respond oddly.

**Mitigation**: This is inherent to any conversation rollback. The coaching prompt should instruct Ryan to note "we're going back to just before [her prior line]" so the user understands the context they're working with. On the character side, there's no clean fix — it's a known edge case, not a blocking issue.

**Risk level**: MEDIUM — acceptable for a first implementation, worth documenting as known behavior.

### Risk 5 — Impact on final scoring (MEDIUM-LOW)

**The risk**: The end-of-scenario coach evaluation sees the final `conversationHistory` and `firstUserOpener`. If the user retried a turn after a rewind, the "bad" turn is no longer in history — only the retry is. The score reflects the retry, not the original mistake.

This is actually the *intended* behavior, but it creates a subtle disconnect: if the user's retry is significantly better than their original, the coach score won't reflect "they needed a rewind to get there." No attempt count or rewind metadata is passed to the coach.

**Mitigation**: Could pass a `rewindCount` to the final coach evaluation for transparency, but this is polish, not a blocking concern. For now, the final score reflecting the final attempt is reasonable.

**Risk level**: MEDIUM-LOW — intentional behavior, minor disclosure gap.

### Risk 6 — Drill system interference (LOW)

**The risk**: The drill system runs its own scripted flow (warm-up exchanges before free conversation begins). Pause-rewind should not fire during drills.

**Mitigation**: The moment-check only fires after `streamCharacterAndSpeak()` in the free-conversation path, not during scripted drill exchanges. Mode detection already exists (`isPractice` flag, `practiceFocus` check). Adding `if (practiceFocus === 'coached')` as a gate on the moment-check call is one line.

**Risk level**: LOW — clean separation already exists in the flow.

---

## 5. Should this be a separate mode or always-on?

### The case for a separate "Coached Practice" mode

**Existing pattern**: The practice focus modal already presents a selector (Free Practice / Lesson 1 / Lesson 2). Adding a fourth option — "Coached Practice" — is consistent with this UI and requires no new modal or UX concept.

**Arguments for separate mode**:
- Users who want the immersive, uninterrupted flow keep it. Advanced users who find constant interruptions patronizing can stay on Free Practice.
- Toggleable in one place — if the moment-check API proves too slow or too noisy, it can be disabled without touching anything else.
- Clearer contract for testing: "this session is a coached session" is a flag the app can pass to all relevant APIs.
- Reduces unexpected surface area — the pause mechanism only needs to exist in the `playLoop` code path when coached mode is active. No risk of accidental pauses in normal practice.

**Arguments against**:
- The selector already has three options; four is getting crowded. Could fold it into an advanced toggle rather than a top-level choice.
- Users may not discover it (discoverability problem shared by all opt-in features).
- A "smarter free practice" that just works without a mode switch would be better UX — if the latency problem were solved.

### The case for always-on with a per-session toggle

If the moment-check latency can be brought reliably under 1.5 seconds, always-on is viable — but it requires the false-positive rate to be extremely low. A single unwanted interrupt erodes trust in the feature more than a missed teachable moment does.

### Recommendation

**Implement as "Coached Practice" mode first.** Fourth option in the practice focus modal. Label it clearly as an active coaching mode so users set the right expectation. Promote to always-on or offer a persistent toggle only once the latency and sensitivity are validated.

This is also the safest implementation path: the feature is fully isolated to a flag, the moment-check API call only exists behind that flag, and existing practice flows are unchanged.

---

## 6. Open questions before implementation starts

1. **Character audio buffer for rewind**: Should the prior-line TTS audio be held in memory for one turn to enable fast re-delivery? This is a new caching pattern not currently in the codebase — needs a decision before the rewind path is designed.

2. **Ryan's coaching voice vs. text**: Should Ryan's coaching during the pause be spoken (ElevenLabs / Kokoro TTS) or text-only? Spoken is more immersive but adds latency to the pause. Text-only is instant but breaks the "Ryan is always a voice" convention.

3. **Coaching granularity**: Should the moment-check detect only lesson-skill failures (OTIMC / FRAME — things the user has been explicitly taught), or also general social errors (bragging, ignoring what she said, moving too fast)? The former is more defensible; the latter is more comprehensive but requires the model to make judgment calls the user hasn't been trained to anticipate.

4. **Rewind depth**: Always exactly one turn back, or should the user be able to request more? One turn is the safe design. Multiple rewinders adds state management complexity and potential for conversation incoherence.

5. **Frequency limit**: Should there be a cap on how many times per session Ryan can interrupt? Unlimited interruptions feel punishing; zero interruptions is the current behavior. Two or three per session might be the right ceiling, enough to be useful without dominating.

---

## Summary table

| Concern | Approach | Risk |
|---------|----------|------|
| Teachable-moment detection | Lightweight `/api/coach-moment` after each character turn, async with discard-if-late rule | Medium latency risk |
| Pause mechanism | `waitIfPaused()` gate before each `listenForUser()`, no session counter touch | High if misimplemented |
| Rewind state | Snapshot before each user turn: `conversationHistory`, `_exchangeCount`, `stepIndex` | Medium — history desync edge case |
| Character re-delivery | Re-play prior-line TTS from buffer (needs buffering, currently absent) | Medium — new pattern needed |
| Voice recognition re-entry | Abandon pause if `listenForUser()` has already started | High race condition risk |
| Mode | Separate "Coached Practice" in practice focus modal | Low |
| Existing practice flows | Zero changes — moment-check and pause gate are behind mode flag | Low |
