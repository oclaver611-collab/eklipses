# Eklipses Task Tracker

## Stable Tags (newest first)
| Tag | What it marks |
|-----|---------------|
| `v-stable-greeting-fix` | "Nice to meet you" greeting bug fixed in both character files |
| `v-stable-launch-ready` | 2-session limit, paywall text, all 14 scenarios pass |
| `v-stable-2session-limit` | Free limit reduced 3→2, server-side only |
| `v-stable-bookstore-fix` | Conversation history double-push guard |
| `v-stable-new-voices` | Fish Audio voice IDs updated |
| `v-stable-paywall-working` | Client-side subscriber bypass removed |
| `v-stable-stripe-two-tiers` | Pro + Elite pricing, two-card paywall UI |
| `v-stable-fishaudio-live` | Fish Audio TTS live |

---

## Bugs

| Status | Task |
|--------|------|
| ✅ DONE | **"Nice to meet you" identical greeting bug** — `nameReminder` in both `character-stream.js` and `character.js` now explicitly bans greeting formulas; `character.js` had "Nice to meet you" as a suggested *example* — removed. Tagged `v-stable-greeting-fix`. |
| ✅ DONE | **Bookstore self-conversation bug** — `usedFallback` guard prevents conversation history being pushed twice when streaming falls back to non-streaming path. Tagged `v-stable-bookstore-fix`. |
| ✅ DONE | **Scenario cards bypassing paywall** — `playScenario(key, false)` changed to `true` so all card clicks go through `canPlay()`. |
| ✅ DONE | **Client-side subscriber bypass (security)** — `isProSubscriber()` removed from `canPlay()` and `countSession()`; server-side Stripe validation only. Tagged `v-stable-paywall-working`. |

---

## Features

| Status | Task |
|--------|------|
| ✅ DONE | **Stripe live E2E test** — `tests/test-stripe-paywall.js` verifies paywall triggers after 2 free sessions, Pro/Elite cards render with correct prices and plan buttons. |
| ✅ DONE | **Pro + Elite pricing tiers** — `api/create-checkout.js` supports `plan: 'pro'` and `plan: 'elite'`; paywall UI shows two cards ($19.99/60 sessions, $39.99/200 sessions). |
| ✅ DONE | **Fish Audio TTS migration** — All characters mapped to Fish Audio voice IDs; TTS latency logging added. |
| ✅ DONE | **Session limit 3→2** — `FREE_SESSION_LIMIT = 2` in both `check-session.js` and `count-session.js`; paywall UI text updated. |

---

## Open / Next

| Priority | Task |
|----------|------|
| — | *(add next tasks here)* |
