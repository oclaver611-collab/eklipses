# DONE — July 5, 2026

## Summary
feature/lesson-player-run1: all 5 tasks complete. Bug fixes applied to lesson-player.js (back-button overlap, Sofia lip sync). 23 new/re-recorded audio files live in R2. Manifest updated to version 3 with 15 segments. Both test suites passing. Waiting for Serge manual review before merge/deploy.

## Task 1 — Voice overlapping fix
**What changed in `navigate()`:**
- Audio cleanup now happens BEFORE `_playGen++` (was after)
- Added `_currentAudio.currentTime = 0` so paused audio can't resume from mid-position
- Order: pause audio → reset time → null ref → increment gen → unblock resume → start new segment

This ensures any in-flight `playSequence` sees the gen mismatch and exits cleanly before new audio starts, with no window where stale audio can replay.

## Task 2 — Lip sync fix
**What changed:**
- `playOneAudio(url)` → `playOneAudio(url, voice)`
- For `voice === 'sofia'`: four event listeners added to the Audio element (`play` → `setSofiaState(true)`, `pause`/`ended`/`error` → `setSofiaState(false)`)
- Removed manual `setSofiaState(true)` from `onFileStart('sofia')` — now driven by the Audio `play` event
- Removed `setSofiaState(false)` from `onFileEnd('sofia')` — now driven by Audio `ended` event
- Pause button: when user pauses mid-Sofia-line, the `pause` event fires automatically → lips stop immediately. Resume fires `play` event → lips restart exactly with audio.
- `playSequence` updated to pass `f.voice` to `playOneAudio`

## Task 3 — New recordings
- ryan_seg00.mp3: recorded OK — 672.7 KB (Fish Audio / Ryan / temp 0.7)
- ryan_seg02b.mp3: recorded OK — 472.7 KB (Fish Audio / Ryan / temp 0.7)
- sofia_s11_03.mp3 (new line "...oh. You're a strange one..."): recorded OK — 70.6 KB (Fish Audio / Sofia)
- Alex lines re-recorded with onyx: 20/20 succeeded
  - alex_s03_01 27.7KB  alex_s03_02 51.6KB  alex_s03_03 47.8KB  alex_s03_04 55.3KB  alex_s03_05 23.9KB
  - alex_s05_01 27.2KB  alex_s05_02 86.3KB  alex_s05_03 45.0KB  alex_s05_04 26.3KB
  - alex_s07_01 84.4KB  alex_s07_02 35.2KB  alex_s07_03 45.9KB
  - alex_s09_01 59.5KB  alex_s09_02 124.2KB  alex_s09_03 48.3KB  alex_s09_04 46.4KB
  - alex_s11_01 115.3KB  alex_s11_02 150.0KB  alex_s11_03 30.9KB  alex_s11_04 46.9KB
- All 23 files uploaded to R2 at lessons/lesson1/audio_v2/

## Task 4 — Manifest updated
- Version bumped to 3
- 15 segments: 00 (Welcome), 01, 02, 02b (What Alex Sees), 03–13
- New segments 00 and 02b added with ryan_seg00.mp3 and ryan_seg02b.mp3
- Uploaded to R2 at lessons/lesson1/audio_v2/manifest.json — verified 200 OK

## Task 5 — Segment titles updated
- SEGMENTS array in lesson-player.js expanded from 13 to 15 entries
- Titles: Welcome / The Lesson / Before The Approach / What Alex Sees / Watch — The Approach / Step 1–5 / Watch segments / Your Five Steps
- Progress label default updated to 1/15
- openLesson default start changed from '01' to '00'
- renderLearnTab "Start Lesson" also updated to start at '00'

## Test results
- test-all-scenarios.js: PASS — 14/14
- test-paywall.js: PASS

## Branch status
- Branch: feature/lesson-player-run1
- Committed: yes
- Pushed: yes
- Merged: NO
- Deployed: NO

## NEEDS MANUAL REVIEW — Serge
1. npx vercel dev → http://localhost:3000
2. Clear localStorage lesson keys (eklipses_lesson1_progress, eklipses_lesson1_complete)
3. Click Start Lesson — does it start with Ryan setting the scene? ("Before we start — let me set the scene...")
4. Does the new segment "What Alex Sees" play before Alex approaches?
5. Click back button — do voices overlap or does only one voice play?
6. Click pause while Sofia is speaking — do her lips stop immediately?
7. Resume — do lips start again exactly with the audio?
8. Does Sofia's close line now say "...oh. You're a strange one. A little too direct, aren't you?"
9. Does Alex sound deeper/more confident with onyx voice?
10. Does the progress bar show X/15 now?

## Blockers / flags
None.
