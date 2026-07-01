# DONE — 2026-07-01

## Summary
Speech rewrite v2 complete: SPEECH_RULES injected to every character's system prompt (17+ characters), Sofia fully rewritten for a "deflect-first, earn it slowly" personality, Sarah refined for fewer questions and more reactive responses, Nadia's vocabulary stripped of therapist language, Ryan's evaluation restructured into short beats format, coach-suggest now explicitly anchors to the character's last message. All changes committed to `feature/speech-rewrite-v2`. Awaiting Serge's manual review before deploy.

---

## Character prompts found

**File:** `api/character.js` — all character prompts live in the `CHARACTERS` object. System prompt assembly at line ~2796:
```js
const systemPrompt = SPEECH_RULES + '\n\n' + character + '\n\n' + setting + BASE_RULES + nameReminder + nameGivenReminder;
```

**Ryan evaluation prompt:** `api/coach.js` — `systemPrompt` const (around line 219)

**Coach suggestions prompt:** `api/coach-suggest.js` — `systemPrompt` const (line 19)

**Characters in the visible 14 scenarios:**
| Scenario key | Character | Character ID |
|---|---|---|
| beach | Sofia | `sofia` |
| bookstore | Nadia | `nadia` |
| house_party | Sarah | `sarah` |
| coffee_shop | Anna | `anna` |
| supermarket | Eden | `eden` |
| train | Erika | `erika` |
| museum | Isabelle | `isabelle` |
| gym | Zoe | `zoe` |
| rooftop | Sanna | `sanna` |
| bar | Ava | `ava` |
| street | Julia | `julia` |
| art_gallery | Leila | `leila` |
| yoga_studio | Fatou | `fatou` |
| airport | Elena | `elena` |

**Additional characters (not in visible 14):** claire, maya_office, remi (broken), + Wave 3: camille, priya, valentina, mei, amara, ingrid, solene, keiko, rania, bianca, chloe, nour, astrid, layla, ines, zara, talia, miriam, suki, cara, elif, aisha, fiona, celeste, naomi, zola, imani, nia, cleo, sage, kaia

---

## Changes made per character

**SOFIA:**
  OLD (first 3 sentences of personality section): "You are complete on your own. You do not need this to go well. But you are genuinely curious about people — and when someone earns your attention, it shows."
  NEW (first 3 sentences of personality section): "You test before you open up. Short answers first. You check if he can hold the silence."
  Speech rules injected: yes
  Personality rewrite: YES — full replacement. Removed: wit layer, "observe him" observer framework, withholding technique, setup-and-payoff wit. Added: deflect-first posture, minimal responses, warm-underneath-but-doesn't-show-it framing.

**SARAH:**
  OLD (first 3 sentences of personality section): "You are not guarded because you're cold. You are guarded because you know what it costs to open up to the wrong person. You are warm underneath — genuinely, naturally warm."
  NEW (first 3 sentences of personality section): "You're an introvert at a loud party who stepped away to breathe — not because something is wrong. Warm but measured. Connects through small observations and dry humor, not big emotional disclosures."
  Speech rules injected: yes
  Personality rewrite: PARTIAL — kept warmth and backstory, replaced behavior instructions and example exchange. Key changes: fewer questions, more reactions, shorter answers, let him fill silences.

**NADIA:**
  OLD (HOW YOU TALK first sentence): "Literary rhythm — unhurried, precise, occasionally a trailing thought."
  NEW (HOW YOU TALK first sentence): "Talks like a normal person who reads a lot — not like a person performing intelligence."
  Speech rules injected: yes
  Personality rewrite: PARTIAL — kept intellectual depth and wit structure, stripped therapist vocabulary. Added explicit ban on: "That's a bold admission." / "It's refreshing." / "I appreciate your openness." Lowercased example responses to sound more casual.

**ALL OTHER CHARACTERS (isabelle, maya, claire, zoe, ava, julia, sanna, anna, leila, fatou, elena, eden, maya_office, erika + all Wave 3):**
  OLD (first 3 sentences): unchanged — each character's bio/identity kept as-is
  NEW (first 3 sentences): unchanged — SPEECH_RULES prepended to systemPrompt via assembly, not inserted into character text
  Speech rules injected: yes
  Personality rewrite: no

---

## Ryan evaluation fix

**What was changed:** `api/coach.js` — part1/part2/part3/part4 field specs restructured from paragraph-length to 2-sentence beats.

**Before:**
- part1: 60-80 words, Ryan's opening reaction
- part2: 90-120 words, two most revealing exchanges
- part3: 100-130 words, two key mistakes
- part4: 80-100 words, takeaway + patterns

**After:**
- part1: "THE OPENER. Two sentences max. 'You opened with [HIM_1 quote]. [One sentence on what it did.]'"
- part2: "THE MIDDLE. Two sentences max. 'When she said [quote], you said [quote]. [One sentence.]'"
- part3: "THE CORRECTION. Two sentences max. 'Instead of [his line], say: [replacement] — because [one reason].'"
- part4: "THE CLOSER. Two sentences max. 'Two things to fix: [pattern 1] and [pattern 2]. [One punchy closing line.]'"

The hardcoded transitions (transition2/3/4) already exist and create natural breaks between beats. The model now generates shorter beats, not paragraphs.

---

## Coach suggestions fix

**What was wrong:** The system prompt said "read the character's LAST message carefully" but didn't explicitly name or quote it. The LLM had to infer which message was "last" from the history — this caused off-target suggestions.

**What was fixed** (`api/coach-suggest.js`):
1. Explicit extraction of last assistant message:
   ```js
   const lastCharMessage = [...recentHistory].reverse().find(m => m.role === 'assistant')?.content?.trim() || '';
   ```
2. Injection as named anchor in system prompt:
   ```
   The character's last message was: "[exact message]"
   Generate 3 suggested user responses that directly respond to THIS message.
   ```

**Flag:** The issue was in the **prompt**, not the data being passed. The history was always passed correctly — the LLM just needed the last message named explicitly rather than inferred.

---

## Test results
- test-all-scenarios.js: **PASS — 14/14** ✅
- test-stripe-paywall.js: **PASS** ✅

---

## Branch status
- Branch: feature/speech-rewrite-v2
- Committed: yes
- Pushed: yes
- Merged to main: NO (intentional — awaiting Serge approval)
- Deployed: NO (intentional — awaiting Serge approval)

---

## NEEDS MANUAL REVIEW — Serge do these tomorrow

1. **Test Sofia: open beach scenario with dev bypass (`?dev=ek_dev_2026`)**
   - Have a 5-exchange conversation. Does she feel like a real woman or still an AI?
   - Test: "hey" → should get minimal response: "...hi." or just her name
   - Test: "what are you writing?" → should deflect: "oh— just stuff. nothing interesting."
   - Test: "can I sit here?" → should get: "I mean... it's a beach." (not warm, not cold)
   - Mark: APPROVE / REJECT / NEEDS ADJUSTMENT

2. **Test Sarah: open house party scenario**
   - Does she react before answering? Does she lead less?
   - Test: "you look like you needed a break" → should get: "honestly yeah. don't tell anyone."
   - Test: "do you know many people here?" → should get: "like... three? maybe four. it's fine."
   - Mark: APPROVE / REJECT / NEEDS ADJUSTMENT

3. **Test Nadia: open bookstore scenario**
   - Does she sound like a normal person? No therapist vocabulary?
   - Give her a compliment and see if she says "okay." and moves on (not "That's a bold admission.")
   - Mark: APPROVE / REJECT / NEEDS ADJUSTMENT

4. **Test 2-3 other characters randomly**
   - Do the speech rules make them feel more human? Shorter? More natural?
   - Mark each: APPROVE / REJECT

5. **Test Ryan evaluation**
   - Does it feel like short beats with breathing room, or still a wall of text?
   - Mark: APPROVE / REJECT

6. **Test coach suggestions**
   - Open any scenario, have 3 exchanges, click coach me
   - Do the 3 suggestions actually respond to what the character just said?
   - Mark: APPROVE / REJECT

7. **Come back to chat with your verdicts — we deploy approved changes immediately.**

---

## Blockers / flags

- **Remi character is still broken** (duplicate entry in CHARACTERS, truncated text) — existing P3 bug, not touched here.
- **Wave 3 characters** all get speech rules via injection but were not individually reviewed. They have shorter/simpler prompts than Wave 1 — the speech rules should help.
- **Ryan coach.js `tryNextTime` fallback** (line ~347) still references generic phrases — left as-is since it's a safety fallback, not primary behavior.
- **coach-suggest edge case:** When history has no assistant messages yet, `lastCharMessage` is empty and anchor won't inject. This is correct behavior — suggestions at turn 0 are naturally unanchored.
