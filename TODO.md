# TODO — Lesson Player Run 1 Fixes + Content Updates
**Written: July 5, 2026 | For: Claude Code | Repo: D:\BUSINESS\executables\love\eklipses\EK7**

---

## RULES
- Fully autonomous. No approval steps. No pausing.
- Branch: `git checkout -b feature/lesson-player-run1`
- Run `node tests/test-all-scenarios.js` (14/14) before any deploy.
- Run `node tests/test-stripe-paywall.js` before any deploy.
- DO NOT deploy — commit and push branch only. Serge reviews first.
- Write DONE.md at the end no matter what.

---

## CONTEXT

The lesson player works but has these bugs and missing content:

**Bugs:**
1. Back button causes multiple audio instances to play simultaneously — voices overlap
2. Sofia's lip sync continues after pause — lips keep moving when nobody is speaking
3. Lip sync timing is off — lips must activate exactly when audio starts, stop exactly when audio ends

**Missing content:**
4. No context intro — user jumps straight into lesson with no scene setting
5. No Ryan introduction — who is Ryan?
6. No Alex introduction — who is Alex?
7. No observation coaching before Alex's opener — Ryan should narrate what Alex notices before he speaks

**Voice change:**
8. Alex voice needs to change from OpenAI echo to OpenAI onyx

**Script fix:**
9. Sofia's closing line "...direct." needs to be replaced with a more natural response

---

## TASK 1 — Fix voice overlapping on back button

Find the playback engine in lesson-player.js.

Current bug: when user clicks back, the current audio keeps playing while new audio starts — causing multiple voices simultaneously.

Fix:
- When back or forward button is clicked, immediately stop ALL currently playing audio before starting new segment
- Cancel any pending 700ms inter-file pauses
- Abort the current play sequence completely
- Only then start the new segment from the beginning

The existing `_playGen` counter pattern should handle this — verify it is being incremented on navigation AND that `playOneAudio` checks it correctly before and after the `await`. If there is any gap where stale audio can continue, close it.

Add this safety measure: on any navigation (back, forward, or segment click), call:
```javascript
if (_currentAudio) {
  _currentAudio.pause();
  _currentAudio.currentTime = 0;
  _currentAudio = null;
}
_playGen++;
```
BEFORE starting the new segment.

---

## TASK 2 — Fix Sofia lip sync

Current bug: Sofia's lips keep moving after pause, and timing is not synced to audio events.

Find where Sofia's speaking/idle state is toggled in lesson-player.js.

Fix:
- Sofia ONLY enters speaking state when a `sofia_` audio file's `play` event fires
- Sofia returns to idle state when that audio file's `ended` OR `pause` OR `error` event fires
- When lesson is paused mid-Sofia-line: immediately set Sofia to idle
- When lesson resumes mid-Sofia-line: set Sofia to speaking again as audio resumes
- Between files (700ms gap): Sofia must be in idle state
- This must use the actual Audio element events — not timers, not segment type detection

Implementation:
```javascript
const a = new Audio(url);
if (voice === 'sofia') {
  a.addEventListener('play', () => setSofiaState(true));
  a.addEventListener('pause', () => setSofiaState(false));
  a.addEventListener('ended', () => setSofiaState(false));
  a.addEventListener('error', () => setSofiaState(false));
}
```

Also fix the pause button: when user clicks pause and Sofia is speaking, call `setSofiaState(false)` immediately.

---

## TASK 3 — Record new audio segments

### 3A — New Segment 0 (Ryan voice — Fish Audio, voice ID: 44b996214285427697767cb469793647, temperature 0.7)

File: `lesson1_audio_v2/ryan_seg00.mp3`

Text:
"Before we start — let me set the scene. [pause] You are walking along a beach, late afternoon. You notice a woman sitting alone. She's been there a while, writing something in a notepad. She looks completely at ease in her own world. [pause] You're interested. But you have no excuse to talk to her. No mutual friends. No obvious opener. Just you, her, and about thirty seconds before the moment passes. [pause] I'm Ryan. I've spent years studying what works and what doesn't when it comes to approaching women. Not theory — real situations, real results. [pause] The man you're about to watch is Alex. He doesn't know her. She doesn't know he exists. [pause] Watch what he does. I'll stop and explain every move. [pause] Let's go."

---

### 3B — New Segment 2.5 (Ryan voice — same settings)

File: `lesson1_audio_v2/ryan_seg02b.mp3`

Text:
"Watch Alex for a second. [pause] He doesn't walk straight over. He takes a moment. [pause] He looks at her. What is she doing? She's writing. Focused. Not looking around, not waiting for anyone. She's in her own world. [pause] He notices the notepad. He notices she's completely at ease alone. [pause] Two things just happened. He found his opener — something specific, something real. And he read her energy — she's not hostile, just absorbed. [pause] That's all the preparation he needs. [pause] Now watch."

---

### 3C — Re-record Sofia's closing line (Fish Audio, Sofia's voice ID)

Find Sofia's voice ID in api/tts.js or api/character.js.

File: `lesson1_audio_v2/sofia_s11_03.mp3` (replaces existing file)

Old text: "...direct."
New text: "...oh. You're a strange one. A little too direct, aren't you?"

---

### 3D — Re-record ALL Alex lines with OpenAI onyx voice (replaces echo)

Change voice from `echo` to `onyx` for ALL alex_* files.

Re-record these files (save to `lesson1_audio_v2/`, overwrite existing):
- alex_s03_01.mp3 — "Hey — sorry, one second."
- alex_s03_02.mp3 — "That hairstyle... where do you get it done?"
- alex_s03_03.mp3 — "No seriously, it's actually really good."
- alex_s03_04.mp3 — "Nothing special — it looks incredible though."
- alex_s03_05.mp3 — "I'm Alex by the way."
- alex_s05_01.mp3 — "So what are you writing?"
- alex_s05_02.mp3 — "People who say nothing interesting are always writing something very interesting."
- alex_s05_03.mp3 — "You're very good at keeping secrets."
- alex_s05_04.mp3 — "I like that actually."
- alex_s07_01.mp3 — "Something I never explain on a beach — it kills the mood immediately."
- alex_s07_02.mp3 — "It really is. What about you?"
- alex_s07_03.mp3 — "Okay — I'll tell you over coffee. Deal?"
- alex_s09_01.mp3 — "You know what I noticed about you from over there?"
- alex_s09_02.mp3 — "You looked completely fine being alone. Not waiting for anyone. Not checking your phone. Just... present."
- alex_s09_03.mp3 — "No. It's rare. Most people can't do that."
- alex_s09_04.mp3 — "Only when something's worth observing."
- alex_s11_01.mp3 — "I have to be honest — I didn't plan to spend twenty minutes talking to someone on a beach today."
- alex_s11_02.mp3 — "No. Opposite actually. Look — I'd like to continue this somewhere that isn't a beach. Coffee, a drink, whatever works for you."
- alex_s11_03.mp3 — "Good. Give me your number."
- alex_s11_04.mp3 — "You seem like someone who appreciates that."

---

## TASK 4 — Update manifest.json

After recording all new files, update `lesson1_audio_v2/manifest.json` to include the new segments.

New segment order:
```json
[
  {
    "segmentId": "00",
    "type": "coaching",
    "title": "Welcome",
    "files": [
      { "file": "ryan_seg00.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "01",
    "type": "coaching",
    "title": "The Lesson",
    "files": [
      { "file": "ryan_seg01.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "02",
    "type": "coaching",
    "title": "Before The Approach",
    "files": [
      { "file": "ryan_seg02.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "02b",
    "type": "coaching",
    "title": "What Alex Sees",
    "files": [
      { "file": "ryan_seg02b.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "03",
    "type": "exchange",
    "title": "Watch — The Approach",
    "sequence": [
      { "file": "alex_s03_01.mp3", "voice": "alex" },
      { "file": "alex_s03_02.mp3", "voice": "alex" },
      { "file": "alex_s03_03.mp3", "voice": "alex" },
      { "file": "sofia_s03_01.mp3", "voice": "sofia" },
      { "file": "sofia_s03_02.mp3", "voice": "sofia" },
      { "file": "alex_s03_04.mp3", "voice": "alex" },
      { "file": "alex_s03_05.mp3", "voice": "alex" },
      { "file": "sofia_s03_03.mp3", "voice": "sofia" }
    ]
  },
  {
    "segmentId": "04",
    "type": "coaching",
    "title": "Step 1 — The Observation Opener",
    "files": [
      { "file": "ryan_seg04.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "05",
    "type": "exchange",
    "title": "Watch — The Tease",
    "sequence": [
      { "file": "alex_s05_01.mp3", "voice": "alex" },
      { "file": "sofia_s05_01.mp3", "voice": "sofia" },
      { "file": "alex_s05_02.mp3", "voice": "alex" },
      { "file": "sofia_s05_02.mp3", "voice": "sofia" },
      { "file": "alex_s05_03.mp3", "voice": "alex" },
      { "file": "sofia_s05_03.mp3", "voice": "sofia" },
      { "file": "alex_s05_04.mp3", "voice": "alex" }
    ]
  },
  {
    "segmentId": "06",
    "type": "coaching",
    "title": "Step 2 — Playful Challenge",
    "files": [
      { "file": "ryan_seg06.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "07",
    "type": "exchange",
    "title": "Watch — The Mystery",
    "sequence": [
      { "file": "sofia_s07_01.mp3", "voice": "sofia" },
      { "file": "alex_s07_01.mp3", "voice": "alex" },
      { "file": "sofia_s07_02.mp3", "voice": "sofia" },
      { "file": "alex_s07_02.mp3", "voice": "alex" },
      { "file": "sofia_s07_03.mp3", "voice": "sofia" },
      { "file": "alex_s07_03.mp3", "voice": "alex" },
      { "file": "sofia_s07_04.mp3", "voice": "sofia" }
    ]
  },
  {
    "segmentId": "08",
    "type": "coaching",
    "title": "Step 3 — Own Your Mystery",
    "files": [
      { "file": "ryan_seg08.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "09",
    "type": "exchange",
    "title": "Watch — The Verbal Spike",
    "sequence": [
      { "file": "alex_s09_01.mp3", "voice": "alex" },
      { "file": "sofia_s09_01.mp3", "voice": "sofia" },
      { "file": "alex_s09_02.mp3", "voice": "alex" },
      { "file": "sofia_s09_02.mp3", "voice": "sofia" },
      { "file": "alex_s09_03.mp3", "voice": "alex" },
      { "file": "sofia_s09_03.mp3", "voice": "sofia" },
      { "file": "alex_s09_04.mp3", "voice": "alex" },
      { "file": "sofia_s09_04.mp3", "voice": "sofia" }
    ]
  },
  {
    "segmentId": "10",
    "type": "coaching",
    "title": "Step 4 — The Verbal Spike",
    "files": [
      { "file": "ryan_seg10.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "11",
    "type": "exchange",
    "title": "Watch — The Close",
    "sequence": [
      { "file": "alex_s11_01.mp3", "voice": "alex" },
      { "file": "sofia_s11_01.mp3", "voice": "sofia" },
      { "file": "alex_s11_02.mp3", "voice": "alex" },
      { "file": "sofia_s11_02.mp3", "voice": "sofia" },
      { "file": "alex_s11_03.mp3", "voice": "alex" },
      { "file": "sofia_s11_03.mp3", "voice": "sofia" },
      { "file": "alex_s11_04.mp3", "voice": "alex" },
      { "file": "sofia_s11_04.mp3", "voice": "sofia" }
    ]
  },
  {
    "segmentId": "12",
    "type": "coaching",
    "title": "Step 5 — The Natural Close",
    "files": [
      { "file": "ryan_seg12.mp3", "voice": "ryan" }
    ]
  },
  {
    "segmentId": "13",
    "type": "coaching",
    "title": "Your Five Steps",
    "files": [
      { "file": "ryan_seg13.mp3", "voice": "ryan" }
    ]
  }
]
```

After updating manifest.json locally, upload it to R2:
- Bucket: `eklipses-videos`
- Key: `lessons/lesson1/audio_v2/manifest.json`
- Content-Type: application/json

Also upload all new/re-recorded MP3 files to R2 under `lessons/lesson1/audio_v2/`.

Update the total segment count in lesson-player.js from 13 to 15 (we now have segments 00, 01, 02, 02b, 03-13).

---

## TASK 5 — Update segment titles in lesson-player.js

The segment titles array needs to match the new 15 segments:
```javascript
const SEGMENT_TITLES = {
  '00': 'Welcome',
  '01': 'The Lesson',
  '02': 'Before The Approach',
  '02b': 'What Alex Sees',
  '03': 'Watch — The Approach',
  '04': 'Step 1 — The Observation Opener',
  '05': 'Watch — The Tease',
  '06': 'Step 2 — Playful Challenge',
  '07': 'Watch — The Mystery',
  '08': 'Step 3 — Own Your Mystery',
  '09': 'Watch — The Verbal Spike',
  '10': 'Step 4 — The Verbal Spike',
  '11': 'Watch — The Close',
  '12': 'Step 5 — The Natural Close',
  '13': 'Your Five Steps'
};
```

---

## TASK 6 — Tests and commit

- Run `node tests/test-all-scenarios.js` — must be 14/14
- Run `node tests/test-stripe-paywall.js` — must pass
- Commit all to `feature/lesson-player-run1`
- Push to origin
- DO NOT merge. DO NOT deploy.

---

## DONE.md TEMPLATE

```
# DONE — [DATE]

## Summary
[What was fixed, what was recorded, what's ready for review]

## Task 1 — Voice overlapping fix
[What was changed to fix back button overlap]

## Task 2 — Lip sync fix
[How Sofia's state is now driven by audio events]

## Task 3 — New recordings
- ryan_seg00.mp3: recorded/failed, size
- ryan_seg02b.mp3: recorded/failed, size
- sofia_s11_03.mp3 (new line): recorded/failed, size
- Alex lines re-recorded with onyx: X/20 succeeded

## Task 4 — Manifest updated
[New segment count, R2 upload confirmed]

## Task 5 — Segment titles updated
[Yes/no]

## Test results
- test-all-scenarios.js: [PASS/FAIL — X/14]
- test-stripe-paywall.js: [PASS/FAIL]

## Branch status
- Branch: feature/lesson-player-run1
- Committed: yes/no
- Pushed: yes/no
- Merged: NO
- Deployed: NO

## NEEDS MANUAL REVIEW — Serge
1. npx vercel dev → http://localhost:3000
2. Clear localStorage lesson keys
3. Click Start Lesson — does it start with Ryan setting the scene? ("Before we start — let me set the scene...")
4. Does the new segment "What Alex Sees" play before Alex approaches?
5. Click back button — do voices overlap or does only one voice play?
6. Click pause while Sofia is speaking — do her lips stop immediately?
7. Resume — do lips start again with the audio?
8. Does Sofia's close line now say "...oh. You're a strange one. A little too direct, aren't you?"
9. Does Alex sound deeper/more confident with onyx voice?
10. Does the progress bar show X/15 now?

## Blockers / flags
[Anything incomplete or risky]
```
