# Eklipses — Technical Issues Log

## Issue #001 — Sofia/Character Audio Silent (Lips Moving, No Sound)
**Date:** June 3, 2026  
**Symptom:** Character lips moving, text changing, but no audio. 20-30s delays before occasional audio snippet.  
**Root cause:** Kokoro TTS server on Render free tier has 20-30s cold starts. Vercel Hobby plan had 10s function timeout. Combined = audio always timed out before arriving.  
**Fix:** Disabled Kokoro in api/tts.js, ElevenLabs now primary. Upgraded Vercel to Pro (30s timeout).  
**Tag:** v-stable-june3-elevenlabs-primary  
**Future:** Replace with Fish Audio or Chatterbox once tested — $7/month flat vs ElevenLabs variable cost.

## Issue #002 — Frontend Fetch Timeout Killing TTS Requests  
**Date:** June 3, 2026  
**Symptom:** TTS requests cancelled at exactly 10s in Network tab.  
**Root cause:** speakElevenLabs() had its own 10s AbortController independent of server timeout.  
**Fix:** Removed frontend fetch timeout — server handles timeouts.  
**File:** player.js — speakElevenLabs()

## Issue #003 — audio.play() Errors Swallowed Silently  
**Date:** June 3, 2026  
**Symptom:** Audio data received (200 OK) but nothing plays.  
**Root cause:** audio.play().catch(() => {}) silently swallowed autoplay blocks and errors.  
**Fix:** await audio.play() with proper try/catch and logging.  
**File:** player.js — speakElevenLabs()

## Issue #004 — Ryan Feedback Skips Real Opening Line
**Date:** June 3, 2026  
**Symptom:** Ryan says "you started with X" but X is not the user's actual first line.  
**Root cause:** coach.js prompt picks a notable exchange, not necessarily the first one.  
**Fix needed:** In coach.js prompt, explicitly instruct: always reference the user's very first message as the opener analysis.  
**Priority:** P2 — cosmetic but affects coaching accuracy.
