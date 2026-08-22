# record-trace-cue-v3.js — Debug Notes

## What works
- **Bug 1 (no TTS stubs)**: `/api/tts` is intercepted with `route.fetch()` (real ElevenLabs call), bytes copied, real audio plays in browser. Confirmed by ttsCount log.
- **Bug 2 (real DOM timestamps)**: MutationObserver on stageFrame fires `logEvent('trace_cue_show')` via `page.exposeFunction`. `recordingStartMs` captured at context creation. Works correctly.
- **Session gate mocks**: `/api/check-session` and `/api/count-session` both mocked — rate limit never blocks.
- **Input submission**: `field.press('Enter')` (not button click) avoids the transcript-badge overlay interception that blocked Run 1.
- **Coach interrupt**: `_coachActive = isCoachMode()` is false (localStorage coached_mode removed), so `waitIfPaused` is never called and coach interrupts can never fire. Confirmed by DOM state log.

## Root cause of the hang (exchanges 1–4 work, exchange 5 hangs)

After the 5th user send, `#type-input-wrap` never becomes visible again. DOM state at timeout: `{"inputWrapDisplay":"none","coachInterrupt":false,"paywall":false,"session":1}`. Session is intact, no overlays.

The hang is in `streamCharacterAndSpeak` → real Groq API takes 50+ seconds on the 5th exchange (likely a long 2nd/3rd sentence streaming slowly, or a 3rd TTS call that stalls). The 20-second `processQueue` timeout in `streamCharacterAndSpeak` (line 1708) should fire after 20s, but combined with the SSE stream fetch timeout (25s) the total can exceed 45s before `streamCharacterAndSpeak` returns. Meanwhile my `waitInputReady(55s)` deadline expires first.

Evidence: last TTS captured at 121s on exchange 5, `sofia_done` at 166.7s — that's 45.7s of audio playing after the last captured TTS. Either the 2nd sentence audio is 45s long (implying a very long Groq response), or a 3rd TTS call starts but takes so long to complete that `logEvent('tts_captured')` fires after my 55s deadline.

## Fix attempted: mock `/api/character-stream`

Added `SOFIA_SCRIPT` array with 7 scripted Sofia responses, including T cue at exchange 3 and C cue at exchange 4. Registered `page.route('**/api/character-stream', ...)` before navigation.

**Problem: the mock is not being triggered.** The `char_stream_mock` logEvent never appears in output even though other `**/api/X` mocks (check-session, count-session, tts) all work. The real Groq API is still being called.

## Possible reasons the character-stream mock doesn't fire

1. **Route registration timing**: All routes are registered before `page.goto()`. The `character-stream` requests happen after reload + login sequence. Should be fine — all other mocks work the same way.

2. **URL pattern mismatch**: `**/api/character-stream` works for other endpoints. Need to verify the actual URL used. In player.js it's `fetch('/api/character-stream', ...)` which resolves to `https://eklipses.vercel.app/api/character-stream`. Pattern should match.

3. **Route handler error silently failing**: The try/catch should log `[ROUTE] character-stream mock error:` but nothing appears. Possible that the route IS being hit but `route.fulfill()` is throwing in a way that bypasses the catch, or the handler is never entered.

4. **Playwright route ordering**: Multiple routes registered for the same pattern — Playwright uses LIFO (last registered wins). Check if there's a conflict.

5. **Service worker / cache**: App may use a service worker that intercepts the request before Playwright's route handler sees it. Service workers run in a separate context.

## Next steps when resuming

1. Add a `console.log('[MOCK-DEBUG] character-stream route hit')` at the very top of the handler (before the try block) to confirm whether it fires at all.

2. Try `page.route('https://eklipses.vercel.app/api/character-stream', ...)` with the full URL instead of the glob, to rule out pattern mismatch.

3. Check for service worker: `await page.evaluate(() => navigator.serviceWorker?.getRegistrations().then(r => r.map(s => s.scope)))` — if one exists, it may intercept fetch calls.

4. If service worker is the issue: pass `serviceWorkers: 'block'` in the browser context options to disable them.

## Current state of the script

`scripts/record-trace-cue-v3.js` has all the fixes described above. The character-stream mock IS in the file (lines 230–258) but isn't firing. Once the mock fires, the conversation will be:
- Exchange 0–2: short 2-sentence Sofia responses (~8–14s each)
- Exchange 3: T cue + 1 sentence ("You notice things.")
- Exchange 4: C cue + 1 sentence ("...sorry. Where were we.") ← CLIP MOMENT
- Exchange 5: "I know. Most people would have moved away."

Total recording before C cue: ~60–90s. Clip is 5s before cue → 20s total.

Deliverable path: `C:\Users\serge\OneDrive\Desktop\eklipses-trace-touch.mp4`
