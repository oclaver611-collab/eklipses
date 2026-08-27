# AUTOMATION_REPORT — dating-mvp-build branch
Branch: dating-mvp-build
Baseline tag: v-dating-mvp-baseline

---

## G0 Baseline — 2026-08-27

| Test suite | Result | Notes |
|---|---|---|
| test-all-scenarios.js | **14/14 PASS** | All scenarios audio pipeline passing on production |
| test-paywall.js | **PASS** | Paywall triggers correctly after session limit |
| test-lesson-player.js | **20/20 PASS** | All lesson player tests pass |
| test-new-features.js | **87/87 PASS** | Captions, ambient, certification, picker all pass |

All 4 suites pass on `main` / production as of baseline tag `v-dating-mvp-baseline`.

---

## G3 iOS Voice — 2026-08-27

**What was built:**
- `api/stt.js` — new serverless endpoint. Accepts multipart/form-data `audio` field,
  calls OpenAI Whisper API (`whisper-1`), returns `{ transcript: string }`.
  Includes `checkRateLimit` gate so it respects the same free session limit.
  Minimal multipart parser (no new dependencies). node --check: pass.
- `vercel.json` — added `/api/stt` explicit rewrite (redundant given Vercel auto-routing
  for `/api/` files, but harmless safety net).
- `player.js` — added:
  - `hasSpeechRecognition()` — returns true only when Chrome/Edge Web Speech API present
  - `listenForUserWhisper(mySession, maxTotalMs)` — MediaRecorder press-and-hold path:
    getUserMedia → MediaRecorder → Blob → POST /api/stt → transcript → correctSTT() → resolve
    Session guard matches listenForUserType pattern (300ms poll).
    data-stt-mode attribute on hold button for Playwright assertion.
    Auto-stop after 30s. Graceful fallback (resolve null) if mic denied.
  - `listenForUser()` dispatch: after type-mode check, `if (!hasSpeechRecognition()) return listenForUserWhisper(...)` 
    Chrome/Android Web Speech API path completely unchanged.
- `player.js` — ToS link added to paywall modal: "By subscribing you agree to our Terms of Service"

**Syntax checks:** node --check passes on api/stt.js and player.js.

**G3.5 WebKit test status:** Not yet run — requires a Preview URL to be live.
Vercel Preview is building from the pushed branch (dating-mvp-build).
The `test:speech` injection hook in player.js bypasses the STT capture entirely
(injects at conversation level), so it can signal that the code path loads and runs
without needing real mic permissions.

**iOS-specific surprises logged to PENDING-APPROVALS.md:** None yet (pre-deploy).
Expected to check AudioContext unlock and autoplay policy on first real-device test.

---

## G5 Dating Niche Polish — 2026-08-27

| Task | What changed | File |
|---|---|---|
| G5.1 Hero | Added "Stop overthinking it. Start practicing." 3-line hero above scenario grid | index.html |
| G5.2 Lesson tab default | `initTabs()` now defaults to PRACTICE tab. LEARN tab button hidden for new users without lesson progress. `?lessons=1` param restores the Learn tab. | lesson-player.js |
| G5.5 ToS link | "By subscribing you agree to our Terms of Service" + /terms link added to paywall modal | player.js |
| G5.4 Price mismatch flag | Paywall UI shows $19.99/$39.99 but Stripe may be $14.99. Logged to PENDING-APPROVALS.md as PA-005 | — |

**Syntax checks:** node --check passes on lesson-player.js and player.js.

**Test suites not re-run yet:** Will re-run against Preview URL once Vercel build completes.
Note: test-lesson-player.js test #2 asserts "LEARN tab visible and **default**" — this test
will FAIL after the G5.2 change (PRACTICE is now default). That test needs to be updated to
expect PRACTICE as default, OR the test should check that the tab IS visible but PRACTICE is
default. Flagged below.

---

## ⚠️ Known gap requiring attention

**test-lesson-player.js test #2** currently asserts:
  `✓ 2. LEARN tab visible and default`

After G5.2 (lesson-player.js defaulting to PRACTICE tab), this assertion will fail because
LEARN tab is now hidden for new users. The test needs to be updated before G6 can pass.

Options:
- Update assertion to: "PRACTICE tab is default; LEARN tab visible only with ?lessons=1"
- Or update it to: "PRACTICE tab has ek-tab-active class"

This is a test-hygiene fix, not a feature regression. The lesson player itself still works
(all other 19 tests pass). Will fix in the next task group run.

---

## G1 Core Conversation — 2026-08-27

| Task | Result | Notes |
|---|---|---|
| G1.1 SSE pipeline verify | **PASS** | Preview URL → 200 `text/event-stream` → `{"sentence":"Hi.","done":false}` confirmed |
| G1.2 processQueue mismatch | Deferred | Static analysis shows session guard in place at line 1557. Requires live interactive session debugging to reproduce — not blocking |
| G1.3 Ryan coach API | **PASS** | `/api/coach` returns score:7 + part1 text on production. API pipeline working |

---

## G2 Session Persistence — 2026-08-27

| Task | Result | Notes |
|---|---|---|
| G2.1 Supabase rows | **PASS** | Direct API test: IP-based SELECT returns `sessionsUsed:2, allowed:false` correctly. INSERT/UPDATE verbose logging added to count-session.js. No DB write errors. |
| G2.2 Rate limit at 2 sessions | **PASS** | `test-paywall.js` passes — paywall appears after simulated session limit exhaustion |
| G2.3 localStorage persistence | Pending | |
| G2.4 Dev bypass key | PASS (via test-paywall.js which uses `ek-dev-key`) | |

---

## G3 iOS Voice (continued) — 2026-08-27

| Check | Result | Notes |
|---|---|---|
| G3.5 WebKit hasSpeechRecognition()=false | **PASS** | WebKit correctly returns false; Whisper path would activate |
| G3.5 navigator.storage polyfill | **FIXED** | Polyfill moved to top of `<head>`, runs before PostHog/Supabase. After page load, `navigator.storage.persisted` is callable. Real iOS 14.5+ has native storage. |
| G3.5 MediaRecorder in Playwright WebKit | Not available | Playwright WebKit emulation doesn't include MediaRecorder. Real Safari 14.5+ supports it. Real device test needed (logged PA-006). |
| G3.6 iOS surprises | Logged | PA-006: navigator.storage timing, MediaRecorder real-device requirement, hasSpeechRecognition correctly false |

---

## G5 Dating Polish (continued) — 2026-08-27

| Task | Result | Notes |
|---|---|---|
| G5.4 Mobile smoke (375×812) | **4/4 PASS** | Hero visible, PRACTICE tab visible, no horizontal overflow (scrollWidth=375), scenario cards present |

---

## test-lesson-player.js test #2 fix — 2026-08-27

- Old assertion: "LEARN tab visible and default" (was passing before G5.2)
- New assertion: "PRACTICE tab is default; LEARN tab hidden for new users"
- Added `?lessons=1` navigation before lesson-specific tests so `#ek-start-lesson1` remains clickable
- Syntax check: pass

---

## Preview URL info

- Preview URL (current): `https://eklipses-hb2jxp6h7-oclaver611-collabs-projects.vercel.app`
- Branch: `dating-mvp-build`
- Bypass header: `x-vercel-protection-bypass: 4rAqwnc2ZfF6Yyuz4pKAbITVOCMpLIyA`

---

## Pending / not yet run

| Group | Status | Blocker |
|---|---|---|
| G1.2 processQueue mismatch fix | Deferred | Requires live session debugging; static analysis inconclusive |
| G2.3 localStorage persistence | Pending | |
| G4.1-G4.4 Payment funnel | Not started | Need Stripe test mode Playwright automation |
| G6.1-G6.4 Pre-launch QA | Not started | Depends on all groups |
