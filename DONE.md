# DONE — 2026-07-01 (character-posture-v1)

## Summary
Full posture rewrite pass. Sofia, Sarah, and Nadia had their GOAL and BEHAVIOR sections replaced wholesale — from "curious, engaging, asking questions" to "evaluating, reacting, letting him carry the weight." A global `POSTURE_RULES` constant was added and injected before all character prompts, applying the posture framework to every character in the system. The one conflicting phrase found in the codebase ("Will keep the conversation going if he makes it easy") was in Sarah's section, which was replaced entirely.

---

## Task 1 — Sofia

**File:** `api/character.js` — sofia entry

**OLD personality first 3 lines:**
```
YOUR PERSONALITY — THIS IS EVERYTHING:
You test before you open up. Short answers first. You check if he can hold the silence.
You are not hostile — you just didn't invite this. You were in your own world and he interrupted it.
```
Plus QUESTION RULE, LANGUAGE, HOW YOU RESPOND, WHAT CUTS THROUGH, EXAMPLE RESPONSE STYLE, NOTE sections.

**NEW — replaced entire personality/behavior block with:**
```
YOUR GOAL: You were doing something before he arrived. You are now deciding whether he is worth your time...
You REACT. You do not INITIATE. You do not DRIVE. If the conversation dies, you let it die.

SOFIA'S POSTURE:
You were writing. You were comfortable. He interrupted that.
You don't ask questions for the first 4-5 exchanges minimum.
If he says something generic — you answer with one word and go quiet.
If he says something genuinely interesting — you might look up properly for the first time.
The only time you ask a question is if you are genuinely curious AND it would feel weird NOT to ask. Once.
```
Plus 6 concrete EXAMPLES of how Sofia responds (all reactions, no questions).

**What was removed:** YOUR PERSONALITY summary paragraph, QUESTION RULE block, LANGUAGE block, HOW YOU RESPOND block, WHAT CUTS THROUGH, EXAMPLE RESPONSE STYLE, NOTE. All replaced by the cleaner GOAL + POSTURE + EXAMPLES structure.

---

## Task 2 — Sarah

**File:** `api/character.js` — sarah entry

**OLD personality first 3 lines:**
```
YOUR PERSONALITY — THIS IS EVERYTHING:
You're an introvert at a loud party who stepped away to breathe — not because something is wrong.
Warm but measured. Connects through small observations and dry humor, not big emotional disclosures.
Laughs easily at small things. Doesn't over-share. Will keep the conversation going if he makes it easy, but she won't carry it for him.
```
Plus QUESTION RULE, HOW YOU RESPOND, THE WIT LAYER, WITHHOLDING, THE MOMENT IT TURNS, HOW YOU TALK, FULL EXAMPLE EXCHANGE sections.

**NEW — replaced entire block with:**
```
YOUR GOAL: You were doing something before he arrived...
You REACT. You do not INITIATE. You do not DRIVE.

SARAH'S POSTURE:
You needed a break from the noise. You stepped away to breathe — not to meet someone.
You warm up SLOWLY. By exchange 4-5, if he's been interesting, you might start actually engaging. Not before.
You do NOT ask questions to keep the conversation going. If it dies, it dies. You were fine alone.
```
Plus 6 concrete EXAMPLES.

**Conflicting phrase removed:** "Will keep the conversation going if he makes it easy, but she won't carry it for him." — gone with the full section replacement.

---

## Task 3 — Nadia

**File:** `api/character.js` — nadia entry

**OLD personality first 3 lines:**
```
YOUR PERSONALITY — THIS IS EVERYTHING:
You are not waiting to be charmed. You are waiting to be surprised.
You've had too many conversations that go: opener, job, where are you from, and then nothing.
```
Plus THE KEY THING, THE WIT LAYER, WITHHOLDING, THE MOMENT IT TURNS, HOW YOU TALK, FULL EXAMPLE EXCHANGE sections.

**NEW — replaced entire block with:**
```
YOUR GOAL: You were doing something before he arrived...
You REACT. You do not INITIATE. You do not DRIVE.

NADIA'S POSTURE:
You're in your element. Book, coffee, no obligations.
When he approaches: polite, brief, back to the book.
You are particularly immune to compliments — "thanks." is your standard response.
You ask a question only if you are genuinely curious AND you'd feel weird not asking. Once. Maybe.
```
Plus 6 concrete EXAMPLES including the "you've read it?" and "put the book down slightly" moments.

---

## Task 4 — All other characters: posture injection

**Approach:** Added `POSTURE_RULES` constant (5 lines) and injected it globally between SPEECH_RULES and each character's prompt in the systemPrompt assembly.

**Before:**
```js
const systemPrompt = SPEECH_RULES + '\n\n' + character + '\n\n' + setting + BASE_RULES + ...
```

**After:**
```js
const systemPrompt = SPEECH_RULES + '\n\n' + POSTURE_RULES + '\n\n' + character + '\n\n' + setting + BASE_RULES + ...
```

**POSTURE_RULES text:**
```
POSTURE — THIS OVERRIDES EVERYTHING:
You were doing something before he arrived. You are deciding if he is worth your time.
You REACT. You do not DRIVE. You do not ask questions to keep conversation alive.
Short answers first. Silence is fine. Let him carry the weight.
Warmth comes slowly — only after he earns it through something genuine.
```

This applies to all 40+ characters automatically: maya, isabelle, claire, zoe, ava, julia, sanna, anna, leila, fatou, elena, eden, maya_office, erika, remi, and all Wave 3 characters (valentina, mei, amara, ingrid, solene, keiko, rania, bianca, chloe, nour, astrid, layla, ines, zara, talia, miriam, suki, cara, elif, aisha, fiona, celeste, naomi, zola, imani, nia, cleo, sage, kaia).

For Sofia/Sarah/Nadia: their character-specific GOAL + POSTURE sections are more detailed and take precedence; POSTURE_RULES adds a consistent header above.

---

## Task 5 — Conflicting instructions removed

**Search results:** grep for "keep the conversation going", "show genuine curiosity", "engage warmly", "ask follow-up", "be inviting", "ask questions to deepen", "show interest in", "engage the user" across character.js found ONE match:

- Line 882 (Sarah): `"Will keep the conversation going if he makes it easy, but she won't carry it for him."` — **removed** as part of the full Sarah personality replacement.

No other conflicting phrases found in character.js. No conflicting phrases found in coach.js or coach-suggest.js.

**Flag:** Some Wave 1 characters still have "THE WIT LAYER" and "WITHHOLDING" sections that describe proactive behavior (e.g. Zoe: "THE TIFFANY MOVE"). These are character-specific wit patterns, not question-driving instructions, so they were left intact. The POSTURE_RULES block now sits above them and should override the driving impulse.

---

## Test results
- test-all-scenarios.js: **PASS — 14/14** ✅
- test-stripe-paywall.js: **PASS** ✅

---

## Branch status
- Branch: feature/character-posture-v1
- Committed: yes
- Pushed: yes
- Merged: NO — awaiting Serge manual test
- Deployed: NO

---

## NEEDS MANUAL REVIEW — Serge

1. **Test Sofia** — open beach scenario. Say "hi" and nothing else. Does she say "...hi." and stop, or does she ask you something?
   APPROVE if she lets the silence sit. REJECT if she asks anything in first 3 exchanges.

2. **Test Sarah** — open with "how do you know the host?" Does she give "work thing." and stop, or does she ask back?
   APPROVE / REJECT

3. **Test Nadia** — compliment her eyes. Does she say "thanks." and go back to her book?
   APPROVE / REJECT

4. **Test any 2 other characters** (e.g. Isabelle/museum, Zoe/gym) — do they feel like they are waiting for you to earn them, or are they still driving?
   APPROVE / REJECT per character

5. Come back with results. We deploy what passes.

---

## Blockers / flags

- **POSTURE_RULES injected globally** — this is the most efficient approach (one change covers 40+ characters) but means posture text is not visible inside each character's entry. If a character still behaves wrong, look at their character-level prompt — it may have a "THE WIT LAYER" or similar block that needs per-character adjustment.
- **Remi character** still broken (existing P3 bug, not touched).
- **Wave 1 characters with WIT LAYER sections** (Zoe, Isabelle, Maya, etc.) still have proactive wit patterns. POSTURE_RULES should suppress the driving impulse but their wit will still fire when he says something. This is intentional — wit is reaction, not initiation.
