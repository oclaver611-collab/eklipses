# DONE — 2026-07-01 (speech-fix-v2)

## Summary
Surgical fix pass on top of the previous speech rewrite. Sofia and Sarah now have hard QUESTION RULE blocks that override everything — no questions in first 3 exchanges, maximum one ever, only if he says something genuinely surprising. Ryan's evaluation opener is fixed: removed the "nuclear fix" code that was prepending verbatim user quotes, rewrote the part1 format spec to "name the move, judge the move" without quoting. Speech rules audit confirmed SPEECH_RULES loads first but was being partially overridden by permissive character-level language — now plugged at the character level for Sofia and Sarah.

---

## Task 1 — Sofia question cap

**File:** `api/character.js` — Sofia's character entry

**What was added:** A `QUESTION RULE — THIS OVERRIDES EVERYTHING` block inserted before HOW YOU RESPOND, plus a `LANGUAGE` block emphasizing casual speech. The old permissive bullet ("Only ask a question back when you're genuinely curious — maybe once or twice in the whole session.") was removed from HOW YOU RESPOND.

**QUESTION RULE added:**
```
QUESTION RULE — THIS OVERRIDES EVERYTHING:
Do NOT ask questions to drive the conversation. You are not curious about him yet.
You have not earned that curiosity. Let him do the work.
If you feel the urge to ask a question, DON'T. React instead.
React with: "hm." / "oh." / "okay." / "weird." / a flat observation.
You may ask ONE question — maximum — only after he has said something genuinely interesting.
Genuinely interesting = surprising, funny, or specific. Not a generic opener.
Until that moment: short answers, flat reactions, let the silence sit.
Examples of what you DO: "...hi." / "mm." / "okay." / "that's... kind of a weird thing to say."
Examples of what you DON'T do: "What brings you here today?" / "What do you do?" / Any question in first 3 exchanges.
```

**LANGUAGE block added:**
```
LANGUAGE: Simple, casual. No complete sentences required.
Drop subjects: "yeah" not "yes I agree". "makes sense" not "that makes a lot of sense to me".
No polished vocabulary. Talk like a 26-year-old on a beach, not a novelist.
```

---

## Task 2 — Sarah question cap

**File:** `api/character.js` — Sarah's character entry

**What was added:** Same QUESTION RULE pattern, adapted for the party context. The vague old bullet ("Don't ask a question every turn — sometimes just react, let it sit.") was removed from HOW YOU RESPOND.

**QUESTION RULE added:**
```
QUESTION RULE — THIS OVERRIDES EVERYTHING:
You stepped away from the party to breathe. You did not come here to interview someone.
Do NOT ask questions to drive the conversation forward.
React first. Short answers second. Questions almost never — and only if genuinely curious.
You may ask ONE question — maximum — only if he says something that genuinely surprises you.
Until that moment: react, give short answers, let him carry the weight.
Examples of what you DO: "oh— hi." / "yeah." / "honestly same." / "that's... actually kind of funny."
Examples of what you DON'T do: "What do you do?" / "Do you know many people here?" / Any question in first 3 exchanges.
```

---

## Task 3 — Ryan opener fix

**File:** `api/coach.js`

**Root cause found:** The "robotic opener" problem had TWO causes:
1. The `part1` format spec said "Format: 'You opened with [exact quote from HIM_1]'" — explicitly instructing the model to quote verbatim.
2. A **"nuclear fix"** (lines 468–472) that unconditionally prepended `You opened with "${realOpener}."` to part1 if the model didn't naturally quote the opener. This was the primary source of the wall-of-text verbatim quote.

**What changed:**

**part1 format spec (before):**
```
"You opened with [exact quote from HIM_1]. [One sentence — what that opener did or didn't do...]"
Quote HIM_1 verbatim.
```

**part1 format spec (after):**
```
Name the move — describe what he did in 5 words or fewer, WITHOUT quoting him verbatim.
Then one sentence on how it landed with ${girlName} specifically.
NEVER read his message back to him word-for-word.
Examples: 'You led with your name. Safe, but flat.' / 'Opening with a compliment. She clocked it.'
```

**Nuclear fix removed:**
```js
// REMOVED:
const realOpener = conversation.find(m => m.role === 'user')?.content?.trim() || '';
if (realOpener && !feedback.part1.toLowerCase().includes(realOpener.toLowerCase().slice(0, 10))) {
  feedback.part1 = `You opened with "${realOpener}." ` + feedback.part1;
}
```

**User messages in both main and retry LLM calls:** Changed from "MANDATORY — your part1 MUST reference this exact line" / "REMINDER: part1 must quote HIM_1 above" to "REMINDER: part1 must NAME and JUDGE the move — do NOT quote HIM_1 back verbatim."

---

## Task 4 — Speech rules audit

**Order of rules blocks in final system prompt** (`api/character.js` line ~2755):
```
SPEECH_RULES  →  character prompt  →  setting  →  BASE_RULES  →  nameReminder  →  nameGivenReminder
```

**SPEECH_RULES is first** — correct, it loads before everything else. But it says "Usually ask zero questions" which is soft guidance. The character prompts came AFTER and contained:
- Sofia: "Only ask a question back when you're genuinely curious — maybe once or twice in the whole session."
- Sarah: "Don't ask a question every turn — sometimes just react, let it sit."

These character-level instructions (which the LLM reads later in the prompt) effectively softened SPEECH_RULES' question cap. GPT-4o-mini gives more weight to later, more specific instructions. This is why characters were still asking questions despite SPEECH_RULES.

**Fix:** Hard QUESTION RULE blocks added directly in Sofia and Sarah's character prompts (Tasks 1 and 2). These now override any remaining permissive language at the character level.

**BASE_RULES audit:** BASE_RULES does NOT address the question cap at all — it covers length, name rules, comma splices, spoken format, filler bans. Not a source of the override. No change needed.

**Dev console.log added** (`api/character.js`, after systemPrompt assembly):
```js
if (process.env.NODE_ENV !== 'production') {
  console.log('[character] systemPrompt[0:200]:', systemPrompt.slice(0, 200));
}
```
This fires in local dev (NODE_ENV=undefined or 'development'). In Vercel production NODE_ENV='production' so it's silent. Serge can verify SPEECH_RULES is first by running locally or checking a preview deployment's function logs.

---

## Test results
- test-all-scenarios.js: **PASS — 14/14** ✅
- test-stripe-paywall.js: **PASS** ✅

---

## Branch status
- Branch: feature/speech-fix-v2
- Committed: yes
- Pushed: yes
- Merged: NO — awaiting Serge manual test
- Deployed: NO

---

## NEEDS MANUAL REVIEW — Serge

1. **Test Sofia — 5 exchanges. Does she STOP asking questions now?**
   - "hey" → should get "...hi." or just her name, nothing more
   - "what are you writing?" → should deflect: "oh— just stuff."
   - Keep talking for 3+ exchanges — does she ask anything back before you say something genuinely interesting?
   - Mark: APPROVE / REJECT / STILL ASKING QUESTIONS

2. **Test Sarah — same check.**
   - Does she react first and hold back questions?
   - "you look like you needed a break" → "honestly yeah. don't tell anyone."
   - Mark: APPROVE / REJECT / STILL ASKING QUESTIONS

3. **Test Ryan evaluation — does the opener no longer quote your message verbatim?**
   - Open beach/bookstore, have 3-4 exchanges, trigger evaluation
   - Does part1 say something like "You led with a compliment. Safe play." rather than "You opened with 'your long message text here'"?
   - Mark: APPROVE / REJECT

4. **Come back with verdicts — we deploy immediately on approval.**

---

## Blockers / flags

- **Remi character** still broken (existing P3 bug, not touched).
- **Wave 3 characters** still not individually reviewed. SPEECH_RULES loads for all of them.
- **QUESTION RULE is only added to Sofia and Sarah** — other Wave 1 characters (Nadia, Anna, etc.) still have their original behavior. If they show question-heavy behavior, same fix applies per character.
- **The nuclear fix removal is non-recoverable if part1 goes blank** — but the fallback guard on line 349 catches missing/empty part1 and fills "You showed up. That is the first step. Now let's look at what happened." So there's still a safety net.
