# Lesson Slice Template

Pipeline for converting a raw OBS lesson recording into portrait 9:16 short-form clips. Every setting here was measured and verified on Lesson 1's OBS recording (`EKtest.mp4`, 1280×720, 30fps).

**Script:** `scripts/lesson-slice-template.js`

---

## Quick start

1. Create a manifest file for your lesson (see schema below).
2. Run:
   ```
   node scripts/lesson-slice-template.js manifests/lesson2.js
   ```

The script will: extract lesson audio per slice → Whisper word-level transcription → build captions → Fish Audio cliffhanger TTS → render final MP4s.

**Prerequisites:** `ffmpeg`, `curl`, `ffprobe` all on PATH. `.env.local` must have `GROQ_API_KEY` and `FISH_AUDIO_API_KEY`.

---

## Manifest schema

```js
// manifests/lessonN.js
module.exports = {
  obsFile:    'C:/Users/serge/Videos/EKtest.mp4', // raw OBS recording
  lessonNum:  1,          // lesson number (used in output filenames and badges)
  totalSlices: 8,         // total slices in this lesson
  outputDir:  'D:/BUSINESS/executables/love/eklipses/EK7/lesson1_slices',

  slices: [
    {
      num:      1,
      obsStart: 3.030,      // seconds into OBS recording where this slice begins
      dur:      100.858,    // lesson content duration in seconds (NOT incl. hook/cliff/outro)
      hook:     "This is not a video.\\NThis is a gym.", // \\N = ASS line break
      badge:    'LESSON 1 · PART 1/8',
      cliffhanger: "But here's what most guys get wrong right before they walk over. That's in part two — follow to catch it.",
      // exchange: undefined — no speaker exchange in this slice
    },
    {
      num:      2,
      obsStart: 103.888,
      dur:      90.0,
      hook:     "He didn't rehearse\\Na single word.",
      badge:    'LESSON 1 · PART 2/8',
      cliffhanger: "Step one worked. But keeping her talking is a different skill — and that's part three. Follow to see it.",
      exchange: {
        offsetSec: 66.431, // lesson time (seconds) when exchange begins
        lines: [
          { t: 0.000, end: 2.210, text: "Hey, sorry one second.",                     voice: 'alex'  },
          { t: 2.260, end: 5.370, text: "That hairstyle — where do you get it done?", voice: 'alex'  },
          // ... more lines
        ],
        // contamZone: only needed when exchange audio bleeds into narration track
        // contamZone: { start: 33.0, end: 39.8 }
      },
    },
    // ... more slices
  ],
};
```

**Last slice:** The `cliffhanger` field on the final slice should be a closing/wrap-up line rather than a teaser for the next part (e.g. "That's all 5 steps — put one into practice today.").

---

## Locked visual constants

All values measured from the Lesson 1 OBS recording. Do not change without re-running pixel measurements.

### OBS crop

| Setting | Value | Why |
|---------|-------|-----|
| Crop origin | `x=445, y=18` | x=445 keeps Ryan's orb fully visible on the left and Sofia's face unclipped on the right. x=490 (earlier attempt) clipped Sofia's right edge. y=18 trims the OS title bar chrome. |
| Crop size | `w=390, h=693` | Captures the Eklipses app lesson panel exactly — nothing from outside the app boundary. |
| Output scale | `1080×1920` | Standard portrait short-form (9:16 at 1080p). |
| Scale filter | `lanczos` | Highest quality for upscaling from 390→1080px (≈2.77× magnification). |

### Dark caption box (drawbox)

| Setting | Value | Why |
|---------|-------|-----|
| `y` | `1125` | Pixel-measured: Sofia's name tag text ends at y=1111 in the 1080×1920 output. y=1125 gives a 14px margin so the full name tag is visible. Earlier value of y=1110 clipped the bottom 2 rows of "Sofia". |
| `h` | `795` (= 1920−1125) | Covers from the dark box start to the bottom of frame. |
| Color | `0x15171C` | Matches the Eklipses app's dark background palette — no visible seam. |

### Caption positioning

| Setting | Value | Why |
|---------|-------|-----|
| Font | Arial Black | Matches the Eklipses app's bold display font used in lesson UI. |
| Font size | `86` | Verified readable at arm's length on mobile; fills ~75% of caption zone width for typical 4-5 word lines. |
| ASS Alignment | `8` (top-anchor) | Positions caption at a fixed distance from the TOP of the frame rather than floating with content height. |
| MarginV | `1182` | Caption text top = drawbox top (1125) + 80px desired gap − 23px libass internal offset = 1182. The 80px gap keeps captions visually clear of the content photo above. |
| Max words per chunk | `6` | Verified readable at 30fps without requiring rewind. Longer lines on-screen feel like rushing. |
| Pause break threshold | `0.45s` | Forces a new caption chunk when Ryan pauses ≥0.45s. Captures natural phrasing without fragmenting sentences mid-breath. |

### Speaker colors

All in ASS BGR hex (note: ASS uses BBGGRR byte order, opposite of CSS RGB):

| Speaker | ASS Style | Color | Hex |
|---------|-----------|-------|-----|
| Ryan (narrator) | `Caption` | Amber/gold | `&H0054A0D9` |
| Alex | `AlexCaption` | Cyan | `&H00FFE500` |
| Sofia | `SofiaCaption` | Soft pink/purple | `&H00B97EFF` |

### Cards

| Card | Duration | Notes |
|------|----------|-------|
| Hook | 2s | Dark card at start of each slice. Text is white, centered, Alignment=5. Hook line uses `\\N` for line breaks in ASS. Badge appears in top-right corner (Alignment=9). |
| Cliffhanger | ~5–7s (measured from actual TTS audio) | Dark card between lesson and outro. Ryan gold captions, Alignment=5 (centered). Text split by `chunkSegment` using proportional word timing. |
| Outro | 4s | Dark card at end. Fixed layout: "Want to try this yourself?" / "eklipses.com" / "2 free sessions · no card required". |

### Badge style

```
Style: Badge,Arial Black,40,&H00FFFFFF,&H000000FF,&H00000000,&H44000000,-1,0,0,0,100,100,0,0,3,12,0,9,20,20,40,1
```

- BorderStyle=3: opaque background box (chip style)
- Alignment=9: top-right corner
- Margins: L=20, R=20, V=40 from edge
- Text format: `LESSON [N] · PART [X]/[TOTAL]` (e.g. `LESSON 1 · PART 2/8`)

---

## Sync approach: Whisper word-level timestamps

**Why not proportional splitting?** The original approach (`chunkSegment` applied to Groq ASR segments) distributed caption timing proportionally by word count. Ryan's dramatic pauses caused ±1–3s drift because the actual pause position didn't match the word-count midpoint. The word-level approach eliminates this completely.

**Implementation:**

1. Extract mono 16kHz MP3 of the lesson audio from OBS using ffmpeg.
2. POST to `https://api.groq.com/openai/v1/audio/transcriptions` with `model=whisper-large-v3-turbo`, `response_format=verbose_json`, `timestamp_granularities[]=word`.
3. Group returned words into caption chunks using `groupWordsIntoCaptions(words, 6, 0.45)`.

**Exchange dialogue:** Speaker exchange lines (Alex/Sofia dialogue) are provided as a manifest constant with known timestamps, NOT transcribed by Whisper. Exchange audio contains multiple overlapping voices which confuse the transcriber. Whisper is only used for Ryan's narration mono-voice track.

**Contamination zones:** When an exchange happens while Ryan is also pausing (audio track contains Alex/Sofia voices overlapping Ryan's silence), Whisper picks up the exchange words as narration. Fix: filter out words in the contamination time range before grouping. Specify `exchange.contamZone` in the manifest. Lesson 1 Slice 3 example: `{ start: 33.0, end: 39.8 }`.

---

## Cliffhanger TTS

- API: Fish Audio (`https://api.fish.audio/v1/tts`)
- Ryan's voice ID: `44b996214285427697767cb469793647` (production clone, cleared for use)
- Format: MP3, non-streaming
- Target duration: 5–7 seconds spoken
- Script: reference the next part number. Example pattern:
  - Non-final: *"[Tension hook]. That's in part [N+1] — follow to catch it."*
  - Final slice: closing/summary line without a part reference

The script measures actual TTS audio duration with `ffprobe` and uses that for the dark card and caption timing — do not hardcode duration.

---

## Output structure

```
outputDir/
  lesson1-slice01-of08.mp4   (hook 2s + lesson Xs + cliffhanger Ys + outro 4s)
  lesson1-slice02-of08.mp4
  ...
tmp/  (auto-created in OS temp, e.g. %TEMP%/ek-lesson1/)
  lesson_s1.mp3              lesson audio for Whisper
  cliffhanger_s1.mp3         Fish Audio TTS
  slice1.ass  hook1.ass  cliff1.ass  outro.ass   subtitle files
  ...
```

---

## Encoding settings

```
-c:v libx264 -crf 18 -preset fast
-c:a aac -b:a 192k
-movflags +faststart
```

CRF 18 gives near-lossless quality at reasonable file size (~15–30 MB per slice at these dimensions). `faststart` places the MP4 moov atom at the front for streaming.

---

## Known issues / lessons learned (Lesson 1)

- **Groq rate limits:** Whisper calls occasionally hit rate limits during batch processing. The script does not retry — re-run if one slice fails. Do not test locally with `npx vercel dev`; it hits rate limits faster than production.
- **Slice 3 contamination:** Alex/Sofia voices bled into Ryan's lesson audio at t≈33–39.8s because they were recorded simultaneously. The contamination window was measured by listening and confirmed by checking Whisper's spurious word timestamps. If a future slice has the same symptom (captions show dialogue words during narration), add a `contamZone` to the manifest.
- **Sofia name tag:** The Eklipses UI places Sofia's name tag at the very bottom of her photo card. The drawbox y must stay at or above the UI chrome elements but below the name tag bottom. Current value (y=1125) was pixel-measured from the raw OBS source. If the app layout changes (e.g. name tag moves), re-measure by extracting a raw OBS frame without drawbox and scanning for white pixel clusters in y=1090–1150.
- **chunkSegment drift:** `chunkSegment` (proportional splitting) is still used for exchange dialogue since we have known text but no word-level timestamps. It's accurate enough for scripted exchanges with relatively even pacing. For long monologue segments, always use Whisper word-level timestamps instead.
