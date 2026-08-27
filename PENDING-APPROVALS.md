# PENDING-APPROVALS

When you check in, answer each item below. The runner will pick up where it left off.
Fill in the `[ ]` that applies, or write your own answer in the blank.

---

## Pre-seeded decisions (from initial audit — answer these first)

### PA-001 — Voice input platform strategy ✅ RESOLVED
**Question:** Chrome Web Speech API (the current STT) works on Chrome desktop and Android Chrome, but is broken on iOS Safari and Firefox. For the dating niche, a significant share of users will be on iPhone.

**Options:**
- [ ] A) Ship text-first for MVP.
- [x] B) Integrate a third-party STT for cross-browser voice. ← **CHOSEN**
- [ ] C) Block MVP launch until cross-browser voice works.

**Decision (2026-08-27):** Integrate OpenAI Whisper via MediaRecorder for iOS Safari and any browser lacking Web Speech API. Keep free browser STT where it already works. Cost ~$0.006/min, approved. Implemented in G3.

---

### PA-002 — Landing page / hero
**Question:** The current app opens directly into the scenario card grid. A first-time visitor from a dating-niche ad or social post may not immediately understand the product.

**Options:**
- [ ] A) Add a 3-line hero above the card grid: headline, subline, CTA. ~1 hour of work. Stays as a single page.
- [ ] B) Keep the existing card grid as the landing experience. Fast, no new copy to write.
- [ ] C) Build a separate marketing landing page at a different route.

**Recommendation:** A — minimal hero in the existing page. Something like: "**Stop overthinking it. Start practicing.**  AI characters that talk back. Real feedback after every conversation." and a "Start for free →" CTA that scrolls to the card grid.

---

### PA-003 — Which 3 anchor scenarios for launch
**Question:** The runner will confirm at least 3 scenarios work end-to-end. Which should be the "anchor" three that marketing and onboarding highlight?

**Current scenario list (non-hidden):** Beach (Sofia), Museum (Isabelle), Bookstore (Julia?), Gym, Office, Street, Wedding, Livingroom, etc.

**Recommendation:** Beach (Sofia) — best tested, coastal energy for social content. Museum (Isabelle) — intellectual vibe, different audience. Gym or Bookstore — third for variety. Mark all others as secondary.

- [ ] Approved as recommended
- [ ] Different choice: _____________________________________________

---

### PA-004 — Auth before or after payment
**Question:** Currently the system is anonymous (IP-based rate limiting). Users don't create an account. After payment, Stripe customer ID is stored in localStorage. There's no email login.

**Risk:** If a paying user clears localStorage or switches devices, they lose subscriber access until they contact support. Supabase auth is partially wired (api/auth-config.js, auth.js) but not enforced.

**Options:**
- [ ] A) Keep anonymous for MVP. Stripe customer ID in localStorage. Document the "clear cookies" support case.
- [ ] B) Require email/Google login before checkout. Supabase auth is already wired — just enforce it. Adds 1–2 days.
- [ ] C) Require login only for subscribers (after payment), not for free users.

**Recommendation:** A for MVP. The current stack works. Add auth in v1.1 once you have paying users to learn from.

---

### PA-005 — Paywall price mismatch ✅ RESOLVED (2026-08-27)
**Finding:** Both `STRIPE_PRO_PRICE_ID` (`price_1TlwfIFSGWeDPq8xtbRCZA0s`) and `STRIPE_ELITE_PRICE_ID` (`price_1TlwjLFSGWeDPq8xbSp4Begn`) return "No such price" when queried with the test-mode key in `.env.local` — this is expected because the prices were created in **live mode** and test keys cannot see live-mode resources.

**Conclusion:** The $14.99 figure was from an old TASKS.md note (pre-dated the price update). The user confirmed via a live checkout test that Stripe is already at **$19.99 / $39.99**, matching the UI exactly. No code change needed. UI and Stripe config are in sync.

---

### PA-006 — G3.6 iOS/WebKit surprises (logged 2026-08-27)
**Found during G3.5 WebKit Playwright test against Preview URL:**

1. **`navigator.storage.persisted` crash** — Supabase's client library calls `navigator.storage.persisted()` on startup. In Playwright's WebKit emulation (and potentially older iOS Safari 13), `navigator.storage` is undefined, causing a `TypeError`. **Fixed:** added a polyfill guard in `index.html` before the Supabase script tag. This is a defensive guard that's a no-op in browsers that already have `navigator.storage`.

2. **MediaRecorder unavailable in Playwright WebKit** — `typeof MediaRecorder` is undefined in Playwright's WebKit emulation. However, MediaRecorder IS available in real Safari 14.5+ on iOS/macOS. This is a test environment limitation. The `listenForUserWhisper()` code path will work on real iOS devices running Safari 14.5+. Playwright WebKit emulation cannot test this path — **real device test recommended** (BrowserStack or physical iPhone).

3. **hasSpeechRecognition() correctly returns false** in WebKit ✓ — the dispatch to `listenForUserWhisper()` will trigger correctly on real iOS Safari.

**No blocking issues.** Real-device test on iPhone (Safari 14.5+) is the definitive check for MediaRecorder + mic permissions. Add to launch QA checklist (G6.4).

---

_Runner appends new items here automatically. Answer them and re-run: `node scripts/dating-mvp-runner.js --loop`_
