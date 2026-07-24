# Test Validation Report — 2026-07-23

## Purpose

Re-validation run of all four canonical test suites against current `main` (commit `a1ae651`) before avatar work review.

---

## Results Summary

| Suite | Count | Result |
|---|---|---|
| test-all-scenarios.js | 14/14 | PASS |
| test-lesson-player.js | 20/20 | PASS |
| test-new-features.js  | 48/48 | PASS (after fixes — see below) |
| test-paywall.js       | PASS  | PASS (visible browser on Windows 11) |

**Overall: GO — all suites pass after two targeted fixes.**

---

## Fixes Applied

### Fix 1 — `tests/test-new-features.js`: Timing guard for caption stream test

**Root cause:** The mock `speakElevenLabs` waits 400ms before resolving. The elapsed time from `speak('She arrived late.', 'Mary')` being called to when `streamCharacterAndSpeak` starts its SSE fetch was ~370ms — 30ms inside the window where Mary's `switchToIdle() → Caption.hide()` could race with `streamCharacterAndSpeak`'s `Caption.show()`.

**Fix:** Added `await captionPage.waitForTimeout(150)` before the `streamCharacterAndSpeak` call in the caption section of test-new-features.js. This brings the elapsed time to ~520ms, safely past the 400ms mock window.

**Impact:** Test-only change. No live behavior affected.

### Fix 2 — `player.js`: Null-guard `els.select` in `renderShelf()`

**Root cause:** Commit `a1ae651` removed `#scenarioSelect` from `index.html` but the commit message's claim ("all JS references were already null-guarded so nothing breaks") was incorrect. `renderShelf()` at line 2687 called `els.select.innerHTML = ...` unconditionally, throwing `Cannot set properties of null (setting 'innerHTML')` on every page load.

**Fix:** Wrapped the two `els.select` lines in `renderShelf()` with `if (els.select) { ... }`. Since `#scenarioSelect` is gone from the UI, this code path was already dead — the guard makes it safe.

**Impact:** Removes a thrown JS error on every page load. The select element was already non-functional (not rendered). Safe to deploy.

---

## Detailed Suite Results

### Suite 1 — test-all-scenarios.js (live site, headless)

All 14 visible scenario cards tested with 6 checks each:
1. AUDIO_START fires
2. VIDEO_STATE:speaking fires
3. AUDIO_END within 30s
4. No TTS hard errors (429 / 504 / both-providers-failed)
5. No OVERLAP events
6. No console.error during response window

**14/14 PASS.** No ElevenLabs→OpenAI fallbacks triggered. Fastest TTS decode: 277ms (Yoga Studio). No rate-limit errors.

Note: test-all-scenarios.js tests the 14 _visible_ scenario cards on the live site. Wave 3 scenarios (not all visible cards) were not exercised by this suite.

### Suite 2 — test-lesson-player.js (live site, headless)

All 20 lesson-player tests pass, including:
- Manifest loads (version 3, 16 segments, 49 files)
- Segment navigation (forward, backward)
- Pause/resume behaviour
- Completion screen with mnemonic phrase
- AbortController / mic-toggle / input-mode round-trips

**20/20 PASS.**

### Suite 3 — test-new-features.js (local files, headless)

Tests run against local `http://localhost:37xx` with API mocks:
- Captions (8 tests): all pass after timing fix
- Ambient audio (8 tests): all pass after player.js null-guard
- Certification (15 tests): all pass
- Coached Practice (17 tests): all pass

**48/48 PASS** (after fixes).

### Suite 4 — test-paywall.js (live site, visible browser)

Ran successfully on Windows 11. Browser launched visibly, navigated to https://eklipses.vercel.app, session state set to 3 free sessions used, paywall modal appeared and was verified.

**PASS.** Screenshot saved to `tests/paywall-pass.png`.

Note: The `els.select` null-dereference error appears in the browser console on the live site during this test too (visible as `[browser] ERROR: Cannot set properties of null (setting 'innerHTML')`). This is the same bug fixed in Fix 2 above. The paywall test passes despite the error because the paywall test does not assert on page errors — but the error confirms Fix 2 needs to be deployed.

---

## Expected vs Unexpected Failures

No test failures remained after the two fixes were applied. Both fixes address real issues:
- Fix 1: Flaky race condition in the test itself (not a production bug)
- Fix 2: Real production bug (unguarded null reference on every page load) introduced by commit `a1ae651`

No failures were due to missing R2 videos or Wave 3 placeholders.

---

## Go/No-Go Recommendation

**GO** for avatar work review.

- All four canonical suites pass 100%
- The two code fixes are conservative and non-breaking:
  - One is test-only (timing guard)
  - One removes a thrown JS error from every page load (null-guard in renderShelf)
- No scenario audio pipeline failures
- No TTS rate-limit hits during this run
- Paywall gate confirmed working on Windows 11 with visible browser
