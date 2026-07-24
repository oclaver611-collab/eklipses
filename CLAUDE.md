# Eklipses — Project Conventions

## Testing
The ONLY canonical test suites are these three Playwright browser tests:
- tests/test-all-scenarios.js
- tests/test-paywall.js
- tests/test-lesson-player.js
Plus tests/test-new-features.js (captions, ambient audio, certification, Coached Practice).
`npm test` / scripts/test-auto.js is a DIFFERENT framework (HTTP eval scripts hitting production API) — do not treat it as equivalent or run it instead of the canonical suites unless explicitly asked.

## Deploy
Always use `deploy.bat "message"` — never `git push` directly. Never use a colon in the commit message (breaks arg parsing on some setups — verify current deploy.bat is colon-safe before assuming). Always confirm the Vercel deployment actually completes (check status), don't just trust the trigger fired.

## Local dev vs testing
Local `npx vercel dev` has repeatedly hit Groq rate limits and missing-config issues that block real testing. Prefer deploying to a Vercel PREVIEW URL for any manual testing that needs real API calls to work reliably. Local dev is fine for quick syntax/structural checks only.

## Security
NEVER let dev-only bypass tools (e.g. dev-setup.html, ek-dev-key flags) ship to production — these must stay local/untracked only, since they'd let any real user unlock paid features for free.

## Branching
Any feature bigger than a small bugfix goes on its own branch (feature/name-here), gets a baseline test run BEFORE changes, then a full test run AFTER changes, confirming nothing that was passing before is now broken — not just that new tests pass. Only merge to main after explicit approval.

## Workflow
Serge works a 9-5 day job and reviews Eklipses work in a 1-2 hour evening window. Bucket A = tasks you can complete fully autonomously (code, content drafts, tests) without needing his real-time input — dispatch these freely. Bucket B = anything requiring his actual eyes/ears/judgment (visual UI checks, audio quality, voice/mic testing, strategic decisions) — minimize what lands here, and when something does need his review, make it as fast as possible (see "Review efficiency" below).

## Review efficiency (important — read before finishing any Bucket A task)
Before marking anything "ready for review," ask: could this have been verified without a human? Specifically:
- For any AI-generated content/suggestion that should "make sense" in context (e.g. Coached Practice's suggested lines), add an automated semantic check: after generating output, make a second cheap LLM call asking "does this make sense given [context]? yes/no" and only surface for human review if it fails, or spot-check a sample rather than requiring every case to be manually verified.
- For any visual UI change, capture a Playwright screenshot automatically and include it in your report, rather than just telling Serge to go navigate the live app and look for something himself.
- For repetitive/mechanical tasks applying an already-proven pattern (e.g. rolling the same change out to 14 avatars), don't ask for the same depth of review as a genuinely novel feature — say explicitly "this is a repeat of an already-verified pattern" so Serge can spot-check instead of fully re-verifying.
