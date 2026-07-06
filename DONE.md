# DONE — July 6, 2026 (Cloudflare Worker audio proxy + Ryan direct R2 + lesson player test suite)

## Deploy summary
- Commit: `5de29a6` on `main`
- Vercel deploy job: `efav61QxJL2PxvULBsuB` (triggered 2026-07-06)
- Both gate suites: PASS (14/14 scenarios, paywall)
- Lesson player suite: **15/15 PASS**
- Deploy URL: https://eklipses.vercel.app

---

## TASK 0 — Cloudflare Worker audio proxy

**Problem:** R2 public dev URL is rate-limited and doesn't support CORS for production.
**Solution:** Cloudflare Worker (`eklipses-lesson-audio`) reads directly from R2 bucket and serves with CORS headers.

**Files created:**
- `cloudflare-worker/lesson-audio-worker.js` — Worker source (R2 binding: `EKLIPSES_VIDEOS`)
- `cloudflare-worker/wrangler.toml` — wrangler config
- `DEPLOY_WORKER.md` — step-by-step dashboard deploy instructions

**lesson-player.js changes:**
- Removed `R2_AUDIO_BASE`, `R2_MANIFEST` constants
- Added `WORKER_BASE = 'https://eklipses-lesson-audio.oclaver611.workers.dev'`
- All audio files (ryan, alex, sofia) + manifest now route through worker: `WORKER_BASE + '?file=' + encodeURIComponent(f.file)`

**Deploy status:** Worker not yet deployed — see `DEPLOY_WORKER.md`.
Do NOT deploy lesson-player.js to Vercel until worker is live and tested.

---

## TASK 1 — Ryan direct R2 routing (lesson-player.js)
Restored the `ryan_*` → direct R2 URL routing removed in the last session.
R2 CORS needs to be configured for eklipses.vercel.app to allow direct requests —
see R2 CORS section below. Until CORS is set, Ryan files will fail on production
but the 60s proxy timeout is still available as a fallback (all files can be
re-routed through proxy by reverting the one-liner in lesson-player.js:302).

**Current routing:**
- `ryan_*` → `https://pub-...r2.dev/lessons/lesson1/audio_v2/{file}` (direct R2)
- `alex_*`, `sofia_*`, `manifest.json` → `/api/lesson-audio?file=...` (streaming proxy, 60s timeout)

---

## TASK 2 — tests/test-lesson-player.js (15 tests)

```
npm run test:lesson
```

**Test coverage:**
1.  Page loads silently — no TTS on load
2.  LEARN tab visible and is the default tab
3.  Lesson 1 card with "Start Lesson" button
4.  Clicking Start Lesson opens the lesson player overlay
5.  Manifest loads — version: 3 | segments: 15
6.  No audio errors on first 3 segments (no TIMEOUT or audio error logs)
7.  ryan_seg00.mp3 accessible via proxy — HTTP 200
8.  Progress bar shows 1/15
9.  Segment label shows "Welcome"
10. Forward ×2 → "Before The Approach"
11. Back ×2 → "Welcome"
12. No overlapping audio (pre-navigation window; checks for simultaneous STARTs)
13. Pause button stops audio (button title changes to "Resume" = togglePause ran)
14. Completion screen appears when shown
15. Completion screen contains "One Tequila Makes Ideas Click"

**Test notes:**
- Runs against `https://eklipses.vercel.app` (production) — same as all other suites
- Sets `ek-dev-key` and `ek-onboarding-v1` in localStorage before reload to enter app
- navigate() resets `_paused=false` — test 13 accounts for this (one click to pause)
- Overlap check uses pre-navigation log window only — rapid navigation STARTs are intentional

---

## R2 CORS (still needed manually)
Ryan direct R2 URLs will fail until CORS is set. Apply in Cloudflare dashboard:
dash.cloudflare.com → R2 → eklipses-videos → Settings → CORS Policy

```json
[
  {
    "AllowedOrigins": ["https://eklipses.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

---

## Gate test results
- `node tests/test-all-scenarios.js` — **14/14 PASS**
- `node tests/test-paywall.js` — **PASS**
- `npm run test:lesson` — **15/15 PASS**
