# EKLIPSES — SESSION START FILE
# Last updated: May 18, 2026
# Upload this file at the start of every session to restore full context.

---

## WHAT IS EKLIPSES

A real-world social simulation platform. Users practice high-stakes conversations with AI video avatars, then get coached by Ryan. Dating is niche #1. The platform expands one niche per month as user milestones are hit.

**Live URL:** https://eklipses.vercel.app
**Repo:** https://github.com/oclaver611-collab/eklipses
**Stack:** Vercel (frontend + API routes) + Cloudflare R2 (video/image storage) + Groq/OpenAI (AI characters) + HeyGen (avatar videos)
**Local path:** D:\BUSINESS\executables\love\eklipses\EK7

---

## CURRENT STABLE TAG

`v-stable-may18-wave2`

To rollback:
```
git checkout v-stable-may18-wave2 -- player.js api/character.js scenarios.js
git add . && git commit -m "rollback" && git push origin HEAD:main
```

---

## PLATFORM VISION

Eklipses is NOT just a dating app. It is a real-world social simulation platform — a YouTube-style portal that expands niche by niche every month.

| Phase | User Milestone | Niche |
|-------|---------------|-------|
| 1 | 0 — 500 | Dating (current) |
| 2 | 500 — 1,000 | Dark Psychology (narcissists, manipulation) |
| 3 | 1,000 — 2,000 | Job Interviews |
| 4 | 2,000+ | Difficult Conversations |
| 5 | Scale | Public Speaking |
| 6 | Scale | Family / Parenting |

Dark psychology is the right second niche — r/NarcissisticAbuse has 600k members, r/raisedbynarcissists has 900k. Nothing like this exists anywhere.

---

## REDDIT LAUNCH

**Target date: May 24-25, 2026**
Target subreddits: r/socialskills, r/dating_advice, r/seduction, r/selfimprovement
Goal: Launch with 15 scenarios (6 existing + 9 new Wave 2)

---

## EXISTING 6 SCENARIOS (fully working)

| Scenario | Character | Status |
|----------|-----------|--------|
| Beach | Sofia | ✅ Live |
| Bar | Ava | ✅ Live |
| Museum | Isabelle | ✅ Live |
| Gym | Zoe | ✅ Live |
| Bookstore | Nadia | ✅ Live |
| Street | Julia | ✅ Live |

---

## WAVE 2 — 9 NEW SCENARIOS (code done, avatars in progress)

Code is fully wired in character.js, scenarios.js, player.js. Only missing: HeyGen videos + background images.

| # | Character | Scenario | Photo file | Personality | HeyGen status |
|---|-----------|----------|------------|-------------|---------------|
| 1 | Sanna | Rooftop bar | Sanna.png | Elizabeth (P&P) — wit, composure | ⚠️ Speaking done, idle needs review |
| 2 | Sarah | House party | Sarah.png | Rose (Titanic) — guarded warmth | ❌ Not started |
| 3 | Anna | Coffee shop | Anna.jpeg | Ally (Star Is Born) — deflects | ❌ Not started |
| 4 | Leila | Art gallery | Leila.jpeg | Mae (Photograph) — minimal words | ❌ Not started |
| 5 | Fatou | Yoga studio | Fatou.jpeg | Monica (L&B) — directness | ❌ Not started |
| 6 | Elena | Airport | Elena.png | Bea (Anyone But You) — banter | ❌ Not started |
| 7 | Eden | Supermarket | Eden.png | Emily (Big Sick) — feedback as affection | ❌ Not started |
| 8 | Maya | Office lobby | Maya.jpg | Rachel (CRA) — grounded warmth | ❌ Not started |
| 9 | Erika | Train | Erika.png | Sarah (Palm Springs) — chaotic bonding | ❌ Not started |

**Photos location:** C:\Users\serge\Downloads\dames\

---

## HEYGEN WORKFLOW (manual web UI — Avatar IV is better than V for Eklipses)

For each character:
1. Go to app.heygen.com/avatar → My Avatars → Create Avatar → upload photo
2. Once created → click avatar → Add a script → Start with a script
3. Select **Avatar IV** (confirmed better than V for subtle natural movement)
4. Paste **speaking script** → generate → download → rename `[name]_speaking.mp4`
5. For idle: use **Custom Motion** (click Motion button) with prompt below + short script
6. Download idle → rename `[name]_idle.mp4`
7. Upload both to R2:
```
wrangler r2 object put eklipses-videos/[name]_speaking.mp4 --file="[name]_speaking.mp4" --remote
wrangler r2 object put eklipses-videos/[name]_idle.mp4 --file="[name]_idle.mp4" --remote
wrangler r2 object put eklipses-videos/[Name]_thumb.jpg --file="[photo file]" --remote
```

**Idle Custom Motion prompt (same for all):**
`Calm and still. Looking forward quietly. Slight natural breathing. Occasional blink. Relaxed posture. Not speaking. Listening.`

**Idle script (same for all):**
`Mm... Mm... Mm... Mm... Mm... Mm... Mm... Mm... Mm... Mm...`
Do NOT hit "More expressive" — leave it OFF.

---

## SPEAKING SCRIPTS FOR WAVE 2

| Character | Speaking script |
|-----------|----------------|
| Sanna | The view up here is worth it. Whether the crowd is — still deciding. |
| Sarah | I was just getting some air. It's a good party. I think. |
| Anna | I've been on this line for an hour. It might just not be working today. |
| Leila | Most people walk past this one. I've been standing here for twenty minutes. |
| Fatou | Hip flexors. A week of this. The body doesn't care how many classes you teach. |
| Elena | Two hours delayed. I've moved through frustration into something I'd call acceptance. |
| Eden | I had a list. Then I saw the mangoes and it completely unraveled. |
| Maya | Floor twelve. I've seen you in the lobby. You're on eight. |
| Erika | Someone at the end of the car has been playing the same thirty seconds of a song. Eleven times. |

---

## BACKGROUND IMAGES NEEDED (9 new scenarios)

Still need to find free photos on Pexels and upload to R2:

| Scenario key | R2 filename needed |
|-------------|-------------------|
| rooftop | rooftop_bg.jpg |
| house_party | party_bg.jpg |
| coffee_shop | coffee_bg.jpg |
| art_gallery | gallery_bg.jpg |
| yoga_studio | yoga_bg.jpg |
| airport | airport_bg.jpg |
| supermarket | supermarket_bg.jpg |
| office_lobby | office_bg.jpg |
| train | train_bg.jpg |

Upload each with:
```
wrangler r2 object put eklipses-videos/[filename] --file="[filename]" --remote
```

---

## PHOTO QUALITY DECISION

All 9 Wave 2 character photos are currently Meta AI generated. Decision made: **redo all 9 with ChatGPT Plus** for better quality and framing. Subscribe to ChatGPT Plus ($20/month), regenerate all 9 with this addition to every prompt:

`close-up portrait, face and shoulders filling the frame, looking directly at camera, 16:9 aspect ratio, 4K`

Then redo HeyGen avatars with the new photos.

---

## HEYGEN API STATUS

- API key: stored in .env as HEYGEN_API_KEY
- API balance: $5.00 loaded (Visa ending 8689)
- Test script: scripts/heygen-test.js (working)
- Correct upload endpoint: upload.heygen.com/v1/talking_photo (NOT /v1/asset)
- API quality is inferior to web UI — use web UI for all production videos
- Batch script: scripts/heygen-batch.js (ready for future use when API quality improves)

---

## COMPETITIVE LANDSCAPE

Full analysis saved in: Eklipses_Competitive_Analysis_May2026.docx

Summary:
- **RizzAgent**: $29.99/mo, text-only avatars, no voice. Most dangerous but text-based.
- **Talkville**: iOS only, text-based, solo developer. Low threat.
- **SmoothTalk**: Text-based, no avatars. Medium threat on messaging.
- All three are bootstrapped with under 10,000 users each. No funded competitor yet.
- **Eklipses advantage**: Only product with voice + video avatar + spoken coaching. 6x cheaper than RizzAgent.

---

## FEATURES TO ADD (from competitive research)

Priority order:
1. Session history + score tracking (localStorage) — Phase 2
2. Live interest/vibe meter during session — Phase 2
3. Pre-session approach warm-up (10-second focus screen) — Phase 2
4. Pattern analysis in Ryan's debrief — Phase 3
5. Squad/leaderboard mode — Phase 3 (post-500 users)
6. Camera/context-aware openers — Phase 4

---

## MONETIZATION

- Free: 1 session/day
- Paid ($4.99/month): unlimited sessions
- Trigger to activate paywall: when monthly API bill hits $300
- No ads ever — Eklipses is a clean product

---

## KEY FILES

| File | Purpose |
|------|---------|
| api/character.js | All character personalities + settings (Wave 1 + Wave 2) |
| scenarios.js | All scenario definitions, demo conversations, practice setups |
| player.js | Avatar sets, rescue lines, impatience lines, scenario-character mapping |
| scripts/heygen-test.js | HeyGen API test (Sanna, Avatar V test) |
| scripts/heygen-batch.js | HeyGen batch generator (all 9 characters) |
| scripts/test-auto.js | AI output evaluator — run when changing prompts in api/ (`npm run eval`) |
| tests/test-all-scenarios.js | Playwright suite — 14 scenarios end-to-end |
| tests/test-paywall.js | Playwright suite — paywall / session limit |
| tests/test-lesson-player.js | Playwright suite — lesson player UI (20 checks) |
| tests/test-new-features.js | Playwright suite — captions, auth, Coached Practice (53 checks) |

---

## BEFORE EVERY PUSH

```
npm test
```
All 4 Playwright browser suites must be green:
- test-all-scenarios.js  → 14/14 scenarios
- test-paywall.js        → PASS
- test-lesson-player.js  → 20/20
- test-new-features.js   → 53/53

When changing AI prompt logic in api/ (character.js, coach.js, etc.), also run:
```
npm run eval
```

---

## TODAY'S SESSION SUMMARY (May 18, 2026)

- Generated 9 new character photos with Meta AI
- Wrote 9 full character personality prompts (matched to real film archetypes)
- Wrote 9 new scenario blocks with demo conversations
- Updated character.js, scenarios.js, player.js — all pushed and tagged
- Built HeyGen API batch script — confirmed working endpoint
- Discovered API quality inferior to web UI — switched to manual workflow
- Confirmed Avatar IV better than Avatar V for Eklipses use case
- Sanna speaking + idle uploaded to R2 — Rooftop scenario partially live
- Added $5 to HeyGen API balance, generated API key
- Created Eklipses_Competitive_Analysis_May2026.docx
- Locked platform vision: niche-by-niche expansion portal
- Cleaned repo — removed .wrangler state files, added to .gitignore
